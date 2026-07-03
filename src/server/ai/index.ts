import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
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

export type { Summarizer } from "./types";
