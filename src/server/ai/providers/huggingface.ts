import { HttpError, RateLimitError, withRetry } from "@/server/x/http";
import type { SummaryInput, SummaryResult, Summarizer } from "../types";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { parseOrFallback, postJson } from "./shared";

// The Hugging Face Inference "router" exposes an OpenAI-compatible chat
// completions endpoint that fans out to whichever inference provider serves
// the requested model. Any instruct model works; override with AI_MODEL.
const ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

export class HuggingFaceSummarizer implements Summarizer {
  readonly id = "huggingface";
  constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_MODEL,
  ) {}

  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const raw = await withRetry(
      async () => {
        const res = await postJson(
          ENDPOINT,
          { authorization: `Bearer ${this.apiKey}` },
          {
            model: this.model,
            temperature: 0.7,
            max_tokens: 900,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: buildUserPrompt(input) },
            ],
          },
        );
        if (res.status === 429)
          throw new RateLimitError("huggingface rate limit");
        if (!res.ok)
          throw new HttpError(
            `huggingface ${res.status}`,
            res.status,
            await res.text().catch(() => ""),
          );
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return data.choices?.[0]?.message?.content ?? "";
      },
      { label: "huggingface.chat", retries: 2 },
    );

    return parseOrFallback(raw, input, `huggingface:${this.model}`);
  }
}
