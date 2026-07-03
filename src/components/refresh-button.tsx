"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { refreshMyFeed } from "@/app/actions";
import { cn } from "@/lib/utils";

export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function handleRefresh() {
    setDone(false);
    start(async () => {
      await refreshMyFeed();
      router.refresh();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    });
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleRefresh}
      disabled={pending}
      className={cn("gap-2", className)}
    >
      {pending ? (
        <Spinner />
      ) : done ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {pending ? "Refreshing…" : done ? "Updated" : "Refresh feed"}
    </Button>
  );
}
