"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getSelectedPersonIds } from "@/server/people";
import { runPersonPipeline } from "@/server/pipeline";
import { getIngestSource } from "@/server/x/source";
import { spendCredits } from "@/server/credits";
import { createLogger } from "@/lib/logger";

const log = createLogger("actions");

const idsSchema = z.array(z.string().min(1)).max(200);

/** Replace the user's full set of selected people (used by onboarding). */
export async function saveSelections(personIds: string[]) {
  const user = await requireUser();
  const requested = idsSchema.parse(personIds);

  const valid = await prisma.trackedPerson.findMany({
    where: { id: { in: requested } },
    select: { id: true },
  });
  const finalIds = valid.map((v) => v.id);

  await prisma.$transaction([
    prisma.selectedPerson.deleteMany({
      where: {
        userId: user.id,
        trackedPersonId: { notIn: finalIds.length ? finalIds : ["__none__"] },
      },
    }),
    ...finalIds.map((id) =>
      prisma.selectedPerson.upsert({
        where: {
          userId_trackedPersonId: { userId: user.id, trackedPersonId: id },
        },
        create: { userId: user.id, trackedPersonId: id },
        update: {},
      }),
    ),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { count: finalIds.length };
}

/** Toggle a single person in/out of the user's selection (optimistic UI). */
export async function toggleSelection(personId: string) {
  const user = await requireUser();
  z.string().min(1).parse(personId);

  const existing = await prisma.selectedPerson.findUnique({
    where: {
      userId_trackedPersonId: { userId: user.id, trackedPersonId: personId },
    },
  });

  if (existing) {
    await prisma.selectedPerson.delete({ where: { id: existing.id } });
    revalidatePath("/dashboard");
    revalidatePath("/onboarding");
    return { selected: false };
  }

  const person = await prisma.trackedPerson.findUnique({
    where: { id: personId },
    select: { id: true },
  });
  if (!person) throw new Error("Unknown person");

  await prisma.selectedPerson.create({
    data: { userId: user.id, trackedPersonId: personId },
  });
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { selected: true };
}

/**
 * Ingest + regenerate summaries for the current user's people, on demand.
 * Fast in mock mode; safe to re-run (idempotent).
 */
export async function refreshMyFeed() {
  const user = await requireUser();
  const ids = await getSelectedPersonIds(user.id);

  // Meter X API usage by counting the calls made during this refresh.
  const source = getIngestSource();
  const callsBefore = source.callCount();

  let refreshed = 0;
  for (const id of ids) {
    try {
      await runPersonPipeline(id);
      refreshed += 1;
    } catch (err) {
      log.error("refresh failed for person", {
        id,
        error: (err as Error).message,
      });
    }
  }

  const spent = source.callCount() - callsBefore;
  await spendCredits(spent, user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastRefreshedAt: new Date() },
  });

  revalidatePath("/dashboard");
  return { refreshed, creditsSpent: spent };
}
