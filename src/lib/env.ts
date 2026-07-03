import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * Import this only from server code (Server Components, Server Actions, route
 * handlers, scripts). Client code should read `NEXT_PUBLIC_*` values directly.
 */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  X_API_BEARER_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  INGEST_MODE: z.enum(["mock", "live"]).default("mock"),

  AI_PROVIDER: z
    .enum(["template", "anthropic", "openai", "gemini", "huggingface"])
    .default("template"),
  AI_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  HUGGINGFACE_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

  CRON_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  INTERNAL_JOB_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  INNGEST_EVENT_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  INNGEST_SIGNING_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Invalid environment variables:\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the required values.`,
    );
  }
  return parsed.data;
}

// Validate once per server process.
export const env: ServerEnv = loadEnv();

/** Whether live X ingestion is possible (mode + credentials present). */
export const isLiveIngest =
  env.INGEST_MODE === "live" && Boolean(env.X_API_BEARER_TOKEN);

/** Whether a real (non-template) AI provider is configured. */
export const hasAiProvider =
  env.AI_PROVIDER !== "template" &&
  Boolean(
    (env.AI_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY) ||
    (env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY) ||
    (env.AI_PROVIDER === "gemini" && env.GEMINI_API_KEY) ||
    (env.AI_PROVIDER === "huggingface" && env.HUGGINGFACE_API_KEY),
  );
