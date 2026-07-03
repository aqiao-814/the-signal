import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { SUMMARY_MODEL_LABEL } from "@/lib/constants";
import type { Summarizer } from "./types";
import { TemplateSummarizer } from "./providers/template";
import { AnthropicSummarizer } from "./providers/anthropic";
import { OpenAISummarizer } from "./providers/openai";
import { GeminiSummarizer } from "./providers/gemini";
import { HuggingFaceSummarizer } from "./providers/huggingface";

const log = createLogger("ai:factory");
let cached: Summarizer | null = null;

/**
 * Returns the configured summarizer. Providers are fully swappable via env;
 * if a provider is selected without an API key we degrade to the template
 * writer so summaries always generate.
 */
export function getSummarizer(): Summarizer {
  if (cached) return cached;
  const model = env.AI_MODEL || undefined;

  switch (env.AI_PROVIDER) {
    case "anthropic":
      if (env.ANTHROPIC_API_KEY) {
        cached = new AnthropicSummarizer(env.ANTHROPIC_API_KEY, model);
        break;
      }
      log.warn(
        "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY missing → template",
      );
      cached = new TemplateSummarizer();
      break;
    case "openai":
      if (env.OPENAI_API_KEY) {
        cached = new OpenAISummarizer(env.OPENAI_API_KEY, model);
        break;
      }
      log.warn("AI_PROVIDER=openai but OPENAI_API_KEY missing → template");
      cached = new TemplateSummarizer();
      break;
    case "gemini":
      if (env.GEMINI_API_KEY) {
        cached = new GeminiSummarizer(env.GEMINI_API_KEY, model);
        break;
      }
      log.warn("AI_PROVIDER=gemini but GEMINI_API_KEY missing → template");
      cached = new TemplateSummarizer();
      break;
    case "huggingface":
      if (env.HUGGINGFACE_API_KEY) {
        cached = new HuggingFaceSummarizer(env.HUGGINGFACE_API_KEY, model);
        break;
      }
      log.warn(
        "AI_PROVIDER=huggingface but HUGGINGFACE_API_KEY missing → template",
      );
      cached = new TemplateSummarizer();
      break;
    default:
      cached = new TemplateSummarizer();
  }

  log.info("summarizer ready", { provider: cached.id });
  return cached;
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.0-flash",
  huggingface: "meta-llama/Llama-3.1-8B-Instruct",
};

/** The summarizer/LLM currently in use (reflects env + whether a key is set). */
export function getEngineInfo(): {
  provider: string;
  label: string;
  model: string;
} {
  const provider = getSummarizer().id;
  const label = SUMMARY_MODEL_LABEL[provider] ?? provider;
  const model =
    provider === "template"
      ? "rule-based writer"
      : env.AI_MODEL || DEFAULT_MODELS[provider] || "default model";
  return { provider, label, model };
}

export type { Summarizer } from "./types";
