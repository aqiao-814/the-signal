import "server-only";
import { prisma } from "@/lib/prisma";

export async function getRecommendedPeople() {
  return prisma.trackedPerson.findMany({ orderBy: { name: "asc" } });
}

export async function getSelectedPersonIds(userId: string): Promise<string[]> {
  const rows = await prisma.selectedPerson.findMany({
    where: { userId },
    select: { trackedPersonId: true },
  });
  return rows.map((r) => r.trackedPersonId);
}

export async function countSelections(userId: string): Promise<number> {
  return prisma.selectedPerson.count({ where: { userId } });
}
