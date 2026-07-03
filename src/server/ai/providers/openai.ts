import { HttpError, RateLimitError, withRetry } from "@/server/x/http";
import type { SummaryInput, SummaryResult, Summarizer } from "../types";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { parseOrFallback, postJson } from "./shared";

const DEFAULT_MODEL = "gpt-4.1-mini";

export class OpenAISummarizer implements Summarizer {
  readonly id = "openai";
  constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_MODEL,
  ) {}

  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const raw = await withRetry(
      async () => {
        const res = await postJson(
          "https://api.openai.com/v1/chat/completions",
          { authorization: `Bearer ${this.apiKey}` },
          {
            model: this.model,
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: buildUserPrompt(input) },
            ],
          },
        );
        if (res.status === 429) throw new RateLimitError("openai rate limit");
        if (!res.ok)
          throw new HttpError(
            `openai ${res.status}`,
            res.status,
            await res.text().catch(() => ""),
          );
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return data.choices?.[0]?.message?.content ?? "";
      },
      { label: "openai.chat", retries: 2 },
    );

    return parseOrFallback(raw, input, `openai:${this.model}`);
  }
}
