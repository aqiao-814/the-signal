"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { avatarUrl } from "@/lib/constants";
import { saveSelections } from "@/app/actions";
import { cn } from "@/lib/utils";

export interface PickPerson {
  id: string;
  handle: string;
  name: string;
  title: string | null;
  bio: string | null;
  verified: boolean;
}

export function PersonPicker({
  people,
  initialSelectedIds,
  ctaLabel = "Continue to dashboard",
}: {
  people: PickPerson[];
  initialSelectedIds: string[];
  ctaLabel?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds),
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    setError(null);
    start(async () => {
      try {
        await saveSelections(Array.from(selected));
        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("Could not save your picks. Please try again.");
      }
    });
  }

  const count = selected.size;

  return (
    <div className="pb-28">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {people.map((person) => {
          const isSelected = selected.has(person.id);
          return (
            <motion.button
              key={person.id}
              type="button"
              onClick={() => toggle(person.id)}
              aria-pressed={isSelected}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-border/80 hover:bg-secondary/40",
              )}
            >
              <Avatar
                src={avatarUrl(person.handle)}
                name={person.name}
                size={48}
                ring={isSelected}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{person.name}</span>
                  {person.verified ? (
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  @{person.handle}
                </p>
                {person.title ? (
                  <p className="mt-1 line-clamp-1 text-xs font-medium text-foreground/70">
                    {person.title}
                  </p>
                ) : null}
                {person.bio ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {person.bio}
                  </p>
                ) : null}
              </div>
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent group-hover:border-muted-foreground",
                )}
              >
                <motion.span
                  initial={false}
                  animate={{
                    scale: isSelected ? 1 : 0.4,
                    opacity: isSelected ? 1 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                >
                  <Check className="h-3.5 w-3.5" />
                </motion.span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="container flex items-center justify-between gap-3 py-4">
          <div className="text-sm">
            <span className="font-semibold text-foreground">{count}</span>{" "}
            <span className="text-muted-foreground">
              {count === 1 ? "leader" : "leaders"} selected
            </span>
            {error ? (
              <span className="ml-2 text-destructive">{error}</span>
            ) : null}
          </div>
          <Button
            variant="gradient"
            size="lg"
            onClick={handleSave}
            disabled={pending}
          >
            {pending ? <Spinner /> : null}
            {count === 0 ? "Skip for now" : ctaLabel}
            {!pending ? <ArrowRight className="h-4 w-4" /> : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
