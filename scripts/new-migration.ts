/**
 * Create a new Prisma migration from the current schema without needing a
 * shadow database (PGlite is single-database, so `prisma migrate dev` can't be
 * used). Diffs the live database against the schema and writes a timestamped
 * migration folder, then applies it.
 *
 * Usage:  npm run db:migrate:new -- <name>
 * Requires the db server to be running (`npm run db:server`).
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const prismaBin = path.resolve(
  ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

const name = (process.argv[2] ?? "update").replace(/[^a-z0-9_]+/gi, "_");
const stamp = new Date()
  .toISOString()
  .replace(/[-:TZ.]/g, "")
  .slice(0, 14);
const dir = path.resolve(ROOT, "prisma", "migrations", `${stamp}_${name}`);

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const diff = spawnSync(
  prismaBin,
  [
    "migrate",
    "diff",
    "--from-url",
    url,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  { encoding: "utf8", env: process.env, cwd: ROOT },
);

if (diff.status !== 0) {
  console.error(diff.stderr);
  process.exit(1);
}

const sql = (diff.stdout ?? "").trim();
if (!sql || /^-- This is an empty migration\.?$/m.test(sql)) {
  console.log("[migrate] no schema changes detected — nothing to do.");
  process.exit(0);
}

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "migration.sql"), sql + "\n");
console.log(`[migrate] wrote ${path.relative(ROOT, dir)}/migration.sql`);

const deploy = spawnSync(prismaBin, ["migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  cwd: ROOT,
});
process.exit(deploy.status ?? 0);
