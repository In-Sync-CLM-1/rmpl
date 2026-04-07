export class GroqApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Groq API error: ${status}`);
    this.name = "GroqApiError";
    this.status = status;
    this.body = body;
  }
}

type GroqInput =
  | string
  | Array<{
      role: string;
      content:
        | string
        | Array<{
            type: string;
            text?: string;
            image_url?: string;
            detail?: string;
          }>;
    }>;

const GROQ_API_BASE = "https://api.groq.com/openai/v1";

export const GROQ_TEXT_MODEL =
  Deno.env.get("GROQ_TEXT_MODEL") ?? "openai/gpt-oss-20b";
export const GROQ_VISION_MODEL =
  Deno.env.get("GROQ_VISION_MODEL") ??
  "meta-llama/llama-4-scout-17b-16e-instruct";

function getGroqApiKey() {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return apiKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractOutputText(data: unknown) {
  if (isRecord(data) && typeof data.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }

  const output = isRecord(data) && Array.isArray(data.output) ? data.output : [];
  const textParts: string[] = [];

  for (const item of output) {
    const content = isRecord(item) && Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (isRecord(part) && part.type === "output_text" && typeof part.text === "string") {
        textParts.push(part.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

async function groqResponsesRequest(body: Record<string, unknown>) {
  const response = await fetch(`${GROQ_API_BASE}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getGroqApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new GroqApiError(response.status, await response.text());
  }

  return await response.json();
}

export async function groqTextResponse(options: {
  instructions: string;
  input: GroqInput;
  model?: string;
  maxOutputTokens?: number;
}) {
  const data = await groqResponsesRequest({
    model: options.model ?? GROQ_TEXT_MODEL,
    instructions: options.instructions,
    input: options.input,
    max_output_tokens: options.maxOutputTokens ?? 1024,
  });

  return extractOutputText(data);
}

export async function groqStructuredResponse<T>(options: {
  instructions: string;
  input: GroqInput;
  schemaName: string;
  schema: Record<string, unknown>;
  model?: string;
  maxOutputTokens?: number;
}) {
  const data = await groqResponsesRequest({
    model: options.model ?? GROQ_TEXT_MODEL,
    instructions: options.instructions,
    input: options.input,
    max_output_tokens: options.maxOutputTokens ?? 1024,
    text: {
      format: {
        type: "json_schema",
        name: options.schemaName,
        schema: options.schema,
      },
    },
  });

  const outputText = extractOutputText(data);
  if (!outputText) {
    throw new Error("No structured output returned from Groq");
  }

  return JSON.parse(outputText) as T;
}
