import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getRecommendedPeople, getSelectedPersonIds } from "@/server/people";
import { PersonPicker } from "@/components/person-picker";

export const metadata: Metadata = { title: "Choose who to follow" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const [people, selectedIds] = await Promise.all([
    getRecommendedPeople(),
    getSelectedPersonIds(user.id),
  ]);

  const isFirstRun = selectedIds.length === 0;

  return (
    <main className="container py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            {isFirstRun ? "Who should we follow for you?" : "Manage your feed"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Pick the tech leaders you want in your daily briefing. You can
            change this anytime — tap a card to add or remove it.
          </p>
        </div>

        <PersonPicker
          people={people.map((p) => ({
            id: p.id,
            handle: p.handle,
            name: p.name,
            title: p.title,
            bio: p.bio,
            verified: p.verified,
          }))}
          initialSelectedIds={selectedIds}
          ctaLabel={isFirstRun ? "Continue to dashboard" : "Save changes"}
        />
      </div>
    </main>
  );
}
