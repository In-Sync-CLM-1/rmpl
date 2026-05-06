// Cloudflare Email Worker — receives email at *@reply.rmpl.in-sync.co.in
// and forwards a parsed JSON payload to the Supabase email-inbound-webhook.
//
// Deploy:
//   1. In Cloudflare dashboard → Email → Email Routing → enable for the domain
//      rmpl.in-sync.co.in. Cloudflare will tell you which MX/SPF records to add.
//      Add an MX record for the subdomain `reply.rmpl.in-sync.co.in` pointing
//      to the same Cloudflare mail server.
//   2. Cloudflare → Workers & Pages → Create → "Hello World" → paste this code.
//   3. Name the Worker something like `email-inbound`.
//   4. Worker → Settings → Variables and Secrets → add the two env vars below
//      (set them as Secrets, not plain Variables, so they're encrypted):
//        - WEBHOOK_URL=https://ltlvhmwrrsromwuiybwu.supabase.co/functions/v1/email-inbound-webhook
//        - INBOUND_EMAIL_SECRET=<the long hex value provided by Claude>
//   5. Cloudflare → Email Routing → Email Workers → bind this Worker to the
//      catch-all `*@reply.rmpl.in-sync.co.in`.
//
// Limits: payload bodies over a few MB will be skipped (Cloudflare gives Workers
// a streaming reader, but we only read text bodies here).

interface Env {
  WEBHOOK_URL: string;
  INBOUND_EMAIL_SECRET: string;
}

interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

async function streamToString(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

function splitMime(raw: string): { headers: Record<string, string>; body: string } {
  const sep = raw.indexOf("\r\n\r\n");
  const splitAt = sep >= 0 ? sep : raw.indexOf("\n\n");
  const headerBlock = splitAt >= 0 ? raw.slice(0, splitAt) : raw;
  const body = splitAt >= 0 ? raw.slice(splitAt + (sep >= 0 ? 4 : 2)) : "";
  const headers: Record<string, string> = {};
  let currentKey = "";
  for (const rawLine of headerBlock.split(/\r?\n/)) {
    if (/^[ \t]/.test(rawLine) && currentKey) {
      headers[currentKey] += " " + rawLine.trim();
      continue;
    }
    const colon = rawLine.indexOf(":");
    if (colon < 0) continue;
    currentKey = rawLine.slice(0, colon).trim().toLowerCase();
    headers[currentKey] = rawLine.slice(colon + 1).trim();
  }
  return { headers, body };
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBase64(input: string): string {
  try {
    return atob(input.replace(/[\r\n]/g, ""));
  } catch {
    return input;
  }
}

interface MimePart {
  headers: Record<string, string>;
  body: string;
}

function parseMultipart(raw: string, boundary: string): MimePart[] {
  const marker = "--" + boundary;
  const segments = raw.split(marker);
  const parts: MimePart[] = [];
  for (const seg of segments) {
    if (!seg || seg.startsWith("--")) continue;
    const trimmed = seg.replace(/^\r?\n/, "");
    const { headers, body } = splitMime(trimmed);
    parts.push({ headers, body: body.replace(/\r?\n--$/, "") });
  }
  return parts;
}

function decodeBody(headers: Record<string, string>, body: string): string {
  const enc = (headers["content-transfer-encoding"] || "").toLowerCase();
  if (enc === "quoted-printable") return decodeQuotedPrintable(body);
  if (enc === "base64") return decodeBase64(body);
  return body;
}

function pickByContentType(parts: MimePart[], contentType: string): string | null {
  for (const p of parts) {
    const ct = (p.headers["content-type"] || "").toLowerCase();
    if (ct.startsWith(contentType)) return decodeBody(p.headers, p.body);
    // Recurse into nested multipart (e.g. multipart/alternative)
    if (ct.startsWith("multipart/")) {
      const m = ct.match(/boundary="?([^";]+)"?/);
      if (m) {
        const inner = parseMultipart(p.body, m[1]);
        const found = pickByContentType(inner, contentType);
        if (found) return found;
      }
    }
  }
  return null;
}

function extractFromName(from: string): string | null {
  const m = from.match(/^([^<]+)<[^>]+>$/);
  if (!m) return null;
  return m[1].replace(/^"|"$/g, "").trim() || null;
}

function parseReferences(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    let raw = "";
    try {
      raw = await streamToString(message.raw);
    } catch (err) {
      console.error("Failed to read email body:", err);
      message.setReject("Could not read message body");
      return;
    }

    const { headers, body } = splitMime(raw);
    const contentType = (headers["content-type"] || "").toLowerCase();

    let textBody: string | null = null;
    let htmlBody: string | null = null;

    if (contentType.startsWith("multipart/")) {
      const m = contentType.match(/boundary="?([^";]+)"?/);
      if (m) {
        const parts = parseMultipart(body, m[1]);
        textBody = pickByContentType(parts, "text/plain");
        htmlBody = pickByContentType(parts, "text/html");
      }
    } else if (contentType.startsWith("text/html")) {
      htmlBody = decodeBody(headers, body);
    } else {
      textBody = decodeBody(headers, body);
    }

    const payload = {
      from: message.from,
      from_name: extractFromName(headers.from || message.from),
      to: message.to,
      subject: headers.subject || null,
      text: textBody,
      html: htmlBody,
      message_id: headers["message-id"] || null,
      in_reply_to: headers["in-reply-to"] || null,
      references: parseReferences(headers.references),
      raw_headers: headers,
    };

    try {
      const res = await fetch(env.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Inbound-Secret": env.INBOUND_EMAIL_SECRET,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Webhook rejected:", res.status, text);
        message.setReject(`Webhook returned ${res.status}`);
      }
    } catch (err) {
      console.error("Webhook fetch failed:", err);
      message.setReject("Could not deliver to webhook");
    }
  },
};
