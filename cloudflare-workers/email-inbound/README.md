# Cloudflare Email Worker — `email-inbound`

Forwards incoming emails on `*@reply.rmpl.in-sync.co.in` to the Supabase
edge function `email-inbound-webhook`, which writes them to `email_inbox`.

## One-time setup (Cloudflare dashboard)

### 1. DNS — register the subdomain
Cloudflare Dashboard → `in-sync.co.in` → DNS → Records → **Add record**:

| Type | Name | Content | TTL |
|------|------|---------|-----|
| MX   | `reply.rmpl` | (use Cloudflare's Email Routing MX value — see step 2) | Auto |

(If `reply.rmpl.in-sync.co.in` already resolves to something else, point only the MX records there — A/AAAA can stay unaffected.)

### 2. Email Routing — enable for the domain
Cloudflare Dashboard → `in-sync.co.in` → **Email** → **Email Routing** → enable. Cloudflare will prompt you to add MX/SPF records — accept those (it'll add a few `*.cloudflare-email.net` MX records to the apex).

If you're worried about the apex MX changes affecting other email on `in-sync.co.in`, we can use a different parent domain instead — tell Claude.

### 3. Create the Worker
Cloudflare Dashboard → **Workers & Pages** → **Create** → **Hello World** → paste the contents of `worker.ts` from this folder. Name it `email-inbound`.

### 4. Set Worker secrets
Worker → **Settings** → **Variables and Secrets** → add as **Secrets** (encrypted):

| Name | Value |
|------|-------|
| `WEBHOOK_URL` | `https://ltlvhmwrrsromwuiybwu.supabase.co/functions/v1/email-inbound-webhook` |
| `INBOUND_EMAIL_SECRET` | (the long hex value provided by Claude — also stored in `.env`) |

### 5. Bind the Worker to inbound mail
Cloudflare Dashboard → **Email** → **Email Workers** → **Create** → pick `email-inbound`. Then **Email Routing** → **Routing Rules** → **Catch-all** → action: **Send to a Worker** → select `email-inbound`.

### 6. Test
Send an email from any address to `reply+test@reply.rmpl.in-sync.co.in`. Within a couple of seconds you should see a row in `email_inbox` (it'll be marked "untagged" since `test` isn't a real activity-log id).

## Notes

- The Worker only reads text/plain and text/html bodies. Attachments are not forwarded yet — they live in `attachments` only when the upstream parser provides them.
- The shared secret protects the webhook — never expose it in client-side code.
- If you want to switch reply domains later (e.g. to `replies.redefinemarcom.in`), update `REPLY_DOMAIN` in `supabase/functions/_shared/email-sender.ts` and re-bind the Worker on Cloudflare.
