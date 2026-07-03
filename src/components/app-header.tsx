import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  user: { name?: string | null; email: string };
}

export function AppHeader({ user }: AppHeaderProps) {
  const display = user.name?.trim() || user.email.split("@")[0];
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between gap-2">
        <Link href="/dashboard" className="shrink-0">
          <Logo />
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            href="/onboarding"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Manage feed</span>
          </Link>
          <span className="hidden max-w-[9rem] truncate px-2 text-sm text-muted-foreground md:inline">
            {display}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
