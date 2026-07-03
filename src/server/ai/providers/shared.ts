import { createLogger } from "@/lib/logger";
import type { SentimentLabel, SummaryInput, SummaryResult } from "../types";
import { composeArticle } from "./template";

const log = createLogger("ai");

const SENTIMENTS: SentimentLabel[] = [
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
  "MIXED",
];

/** Extract the first JSON object from a model response (tolerates fences). */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]! : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON found");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Parse a model's JSON into a validated SummaryResult. If anything is missing
 * or malformed, fall back to the deterministic template writer so the pipeline
 * never fails on a bad generation.
 */
export function parseOrFallback(
  raw: string,
  input: SummaryInput,
  model: string,
): SummaryResult {
  try {
    const obj = extractJson(raw) as Record<string, unknown>;
    const headline = String(obj.headline ?? "").trim();
    const body = String(obj.body ?? "").trim();
    if (!headline || body.length < 40) throw new Error("empty fields");

    const sentiment = SENTIMENTS.includes(obj.sentiment as SentimentLabel)
      ? (obj.sentiment as SentimentLabel)
      : "NEUTRAL";
    const scoreNum = Number(obj.sentimentScore);
    const sentimentScore = Number.isFinite(scoreNum)
      ? Math.max(-1, Math.min(1, scoreNum))
      : 0;
    const topics = Array.isArray(obj.topics)
      ? obj.topics.map(String).slice(0, 6)
      : [];

    return {
      headline: headline.slice(0, 140),
      dek: String(obj.dek ?? "")
        .trim()
        .slice(0, 200),
      body,
      sentiment,
      sentimentScore,
      topics,
      model,
    };
  } catch (err) {
    log.warn("model output unparseable; using template fallback", {
      model,
      error: (err as Error).message,
    });
    const fallback = composeArticle(input);
    return { ...fallback, model: `${model}+fallback` };
  }
}

/** POST JSON to a provider with a hard timeout. */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}
