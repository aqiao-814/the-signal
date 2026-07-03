/**
 * One-shot database setup: boots a temporary embedded Postgres (PGlite) socket
 * server, applies Prisma migrations, seeds baseline data, then shuts down.
 *
 * Runs automatically before `npm run dev` (via the `predev` hook) so the
 * database file is always migrated + seeded before the app starts serving.
 */
import "./polyfills";
import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(ROOT, ".local-postgres", "pglite");
const PORT = Number(process.env.PGLITE_PORT ?? 5433);
const HOST = process.env.PGLITE_HOST ?? "127.0.0.1";
const prismaBin = path.resolve(
  ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

/**
 * Run the prisma CLI as an async child process. Must be async (not spawnSync)
 * because our in-process socket server needs the event loop free to serve the
 * child's database connection.
 */
function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(prismaBin, args, {
      stdio: "inherit",
      env: process.env,
      cwd: ROOT,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`prisma ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function main() {
  if (process.env.DB_RESET === "1") {
    console.log("[setup] resetting database (removing data dir) …");
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
  console.log("[setup] starting temporary database …");
  const db = await PGlite.create({ dataDir: DATA_DIR });
  await db.query("select 1");
  const server = new PGLiteSocketServer({
    db,
    host: HOST,
    port: PORT,
    maxConnections: 25,
  });
  await server.start();

  try {
    console.log("[setup] applying migrations …");
    await run(["migrate", "deploy"]);
    console.log("[setup] seeding …");
    await run(["db", "seed"]);
    console.log("[setup] ✓ database ready");
  } finally {
    await server.stop();
    await db.close();
  }
}

main().catch((err) => {
  console.error("[setup] failed:", err);
  process.exit(1);
});
