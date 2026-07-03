import { HttpError, RateLimitError, withRetry } from "@/server/x/http";
import type { SummaryInput, SummaryResult, Summarizer } from "../types";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { parseOrFallback, postJson } from "./shared";

const DEFAULT_MODEL = "gemini-2.0-flash";

export class GeminiSummarizer implements Summarizer {
  readonly id = "gemini";
  constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_MODEL,
  ) {}

  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const raw = await withRetry(
      async () => {
        const res = await postJson(
          url,
          {},
          {
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              { role: "user", parts: [{ text: buildUserPrompt(input) }] },
            ],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: "application/json",
            },
          },
        );
        if (res.status === 429) throw new RateLimitError("gemini rate limit");
        if (!res.ok)
          throw new HttpError(
            `gemini ${res.status}`,
            res.status,
            await res.text().catch(() => ""),
          );
        const data = (await res.json()) as {
          candidates?: {
            content?: { parts?: { text?: string }[] };
          }[];
        };
        return (
          data.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("") ?? ""
        );
      },
      { label: "gemini.generate", retries: 2 },
    );

    return parseOrFallback(raw, input, `gemini:${this.model}`);
  }
}
