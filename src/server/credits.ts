import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Shared X API credit budget. The app talks to X with a single token, so we
 * model a pooled number of API calls remaining (1 credit ≈ 1 X API call) and
 * decrement it as live calls are made. Also tracks per-account usage.
 *
 * Note: X does not expose real dollar/quota balances via the API, so this is an
 * app-side budget (starting value configurable via X_CREDIT_BUDGET).
 */
const BUDGET = Math.max(
  0,
  Math.round(Number(process.env.X_CREDIT_BUDGET ?? 100)),
);

export interface CreditSnapshot {
  total: number;
  remaining: number;
}

export async function getCreditPool(): Promise<CreditSnapshot> {
  const pool = await prisma.creditPool.upsert({
    where: { id: "global" },
    create: { id: "global", total: BUDGET, remaining: BUDGET },
    update: {},
  });
  return { total: pool.total, remaining: pool.remaining };
}

/** Spend `n` credits from the global pool (and, if given, an account). */
export async function spendCredits(n: number, userId?: string): Promise<void> {
  const spend = Math.round(n);
  if (!Number.isFinite(spend) || spend <= 0) return;

  const pool = await getCreditPool();
  await prisma.creditPool.update({
    where: { id: "global" },
    data: { remaining: Math.max(0, pool.remaining - spend) },
  });

  if (userId) {
    await prisma.user
      .update({
        where: { id: userId },
        data: { creditsUsed: { increment: spend } },
      })
      .catch(() => {
        /* user may not exist (e.g. background job) — ignore */
      });
  }
}

export async function getUserCreditsUsed(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsUsed: true },
  });
  return u?.creditsUsed ?? 0;
}
