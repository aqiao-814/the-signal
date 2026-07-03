import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Money left in the X API account. The app talks to X with a single billing
 * account, so we model a shared dollar balance that is drawn down as live API
 * calls are made (each call costs X_COST_PER_CALL_USD). Also tracks per-account
 * spend.
 *
 * X does not expose real billing via the API, so this is an app-side balance
 * (starting value X_BUDGET_USD). Money is stored in whole cents (integers) on
 * the CreditPool row (`total`/`remaining`) and on `User.creditsUsed`.
 */
const BUDGET_CENTS = Math.max(
  0,
  Math.round(Number(process.env.X_BUDGET_USD ?? 2.77) * 100),
);
const COST_PER_CALL_CENTS = Math.max(
  0,
  Math.round(Number(process.env.X_COST_PER_CALL_USD ?? 0.03) * 100),
);

export interface MoneySnapshot {
  totalUsd: number;
  remainingUsd: number;
  costPerCallUsd: number;
}

export async function getCreditPool(): Promise<MoneySnapshot> {
  let pool = await prisma.creditPool.upsert({
    where: { id: "global" },
    create: { id: "global", total: BUDGET_CENTS, remaining: BUDGET_CENTS },
    update: {},
  });
  // Re-sync if the configured budget changed.
  if (pool.total !== BUDGET_CENTS) {
    pool = await prisma.creditPool.update({
      where: { id: "global" },
      data: { total: BUDGET_CENTS, remaining: BUDGET_CENTS },
    });
  }
  return {
    totalUsd: pool.total / 100,
    remainingUsd: pool.remaining / 100,
    costPerCallUsd: COST_PER_CALL_CENTS / 100,
  };
}

/** Draw down the balance for `calls` X API calls (and, if given, an account). */
export async function spendCredits(
  calls: number,
  userId?: string,
): Promise<void> {
  const n = Math.round(calls);
  if (!Number.isFinite(n) || n <= 0) return;
  const costCents = n * COST_PER_CALL_CENTS;
  if (costCents <= 0) return;

  await getCreditPool(); // ensure the row exists
  const pool = await prisma.creditPool.findUnique({ where: { id: "global" } });
  if (pool) {
    await prisma.creditPool.update({
      where: { id: "global" },
      data: { remaining: Math.max(0, pool.remaining - costCents) },
    });
  }

  if (userId) {
    await prisma.user
      .update({
        where: { id: userId },
        data: { creditsUsed: { increment: costCents } },
      })
      .catch(() => {
        /* user may not exist (background job) — ignore */
      });
  }
}

/** How much money (USD) this account has spent on X API calls. */
export async function getUserSpentUsd(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsUsed: true },
  });
  return (u?.creditsUsed ?? 0) / 100;
}
