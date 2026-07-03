/**
 * Embedded PostgreSQL for local development.
 *
 * PGlite is a real PostgreSQL build compiled to WASM that runs in-process —
 * no system PostgreSQL, no Docker, no SysV shared memory, no credentials.
 * We expose it over the Postgres wire protocol on a TCP socket so that Prisma
 * (and `psql`) connect to it exactly like a normal Postgres server.
 *
 * Start with:  npm run db:server   (kept alive; Ctrl-C to stop)
 */
import "./polyfills";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", ".local-postgres", "pglite");
const HOST = process.env.PGLITE_HOST ?? "127.0.0.1";
const PORT = Number(process.env.PGLITE_PORT ?? 5433);

async function main() {
  console.log(`[db] booting embedded PostgreSQL (PGlite) …`);
  console.log(`[db] data dir: ${DATA_DIR}`);

  const db = await PGlite.create({ dataDir: DATA_DIR });
  // Touch the DB so the cluster is fully initialized before accepting clients.
  await db.query("select 1");

  const server = new PGLiteSocketServer({
    db,
    host: HOST,
    port: PORT,
    // PGlite is a single instance; queries are queued, but allow many
    // concurrent client connections (Prisma opens a small pool).
    maxConnections: 25,
  });

  await server.start();
  console.log(`[db] ready — postgres://postgres@${HOST}:${PORT}/postgres`);

  const shutdown = async (signal: string) => {
    console.log(`\n[db] received ${signal}, shutting down …`);
    try {
      await server.stop();
      await db.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[db] fatal:", err);
  process.exit(1);
});
