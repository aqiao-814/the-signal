import { withRetry } from "@/server/x/http";
import { HttpError, RateLimitError } from "@/server/x/http";
import type { SummaryInput, SummaryResult, Summarizer } from "../types";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { parseOrFallback, postJson } from "./shared";

const DEFAULT_MODEL = "claude-haiku-4-5";

export class AnthropicSummarizer implements Summarizer {
  readonly id = "anthropic";
  constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_MODEL,
  ) {}

  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const raw = await withRetry(
      async () => {
        const res = await postJson(
          "https://api.anthropic.com/v1/messages",
          {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
          {
            model: this.model,
            max_tokens: 900,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: buildUserPrompt(input) }],
          },
        );
        if (res.status === 429)
          throw new RateLimitError("anthropic rate limit");
        if (!res.ok)
          throw new HttpError(
            `anthropic ${res.status}`,
            res.status,
            await res.text().catch(() => ""),
          );
        const data = (await res.json()) as {
          content?: { type: string; text?: string }[];
        };
        return data.content?.map((c) => c.text ?? "").join("") ?? "";
      },
      { label: "anthropic.messages", retries: 2 },
    );

    return parseOrFallback(raw, input, `anthropic:${this.model}`);
  }
}
