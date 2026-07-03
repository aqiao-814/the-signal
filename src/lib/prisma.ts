import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. In development, Next.js hot-reloading would
 * otherwise create a new client (and a new connection pool) on every change.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
