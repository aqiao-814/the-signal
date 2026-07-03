import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="container flex min-h-dvh flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Compass className="h-6 w-6" />
      </div>
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "default" }), "mt-6")}
      >
        Back home
      </Link>
    </main>
  );
}
