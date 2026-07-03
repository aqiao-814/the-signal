/**
 * Tiny structured logger. Pretty in development, single-line JSON in
 * production. No external deps so it works in every runtime.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = (process.env.LOG_LEVEL as Level) ?? "info";
const threshold = LEVELS[envLevel] ?? LEVELS.info;
const isProd = process.env.NODE_ENV === "production";

type Fields = Record<string, unknown>;

function emit(level: Level, scope: string, msg: string, fields?: Fields) {
  if (LEVELS[level] < threshold) return;
  const time = new Date().toISOString();

  if (isProd) {
    const line = JSON.stringify({ time, level, scope, msg, ...fields });
    (level === "error" ? console.error : console.log)(line);
    return;
  }

  const color = {
    debug: "\x1b[90m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
  }[level];
  const reset = "\x1b[0m";
  const prefix = `${color}${level.toUpperCase().padEnd(5)}${reset} \x1b[2m${scope}\x1b[0m`;
  const extra =
    fields && Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : "";
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  fn(`${prefix} ${msg}${extra}`);
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(scope: string): Logger;
}

export function createLogger(scope = "app"): Logger {
  return {
    debug: (m, f) => emit("debug", scope, m, f),
    info: (m, f) => emit("info", scope, m, f),
    warn: (m, f) => emit("warn", scope, m, f),
    error: (m, f) => emit("error", scope, m, f),
    child: (child) => createLogger(`${scope}:${child}`),
  };
}

export const logger = createLogger("signal");
