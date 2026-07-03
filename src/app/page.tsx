import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Newspaper, Sparkles, Zap, Radar } from "lucide-react";
import { getSession } from "@/lib/session";
import { getCreditPool } from "@/server/credits";
import { Logo } from "@/components/logo";
import { CreditsMeter } from "@/components/credits-meter";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import {
  APP_NAME,
  APP_TAGLINE,
  RECOMMENDED_PEOPLE,
  avatarUrl,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Radar,
    title: "Reads the timeline for you",
    body: "We track what the most influential people in tech are posting on X — and the conversations they spark.",
  },
  {
    icon: Newspaper,
    title: "Written like real news",
    body: "Every day you get a concise brief that reads like Morning Brew or TechCrunch — not a wall of bullet points.",
  },
  {
    icon: Zap,
    title: "Sentiment at a glance",
    body: "Know instantly whether the room is bullish, skeptical, or divided on today's biggest threads.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  const pool = await getCreditPool();
  const faces = RECOMMENDED_PEOPLE.slice(0, 7);
  const names = RECOMMENDED_PEOPLE.map((p) => p.name.split(" ").pop());
  const tracking =
    names.length <= 2
      ? names.join(" and ")
      : `${names.slice(0, -1).join(", ")} & more`;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <header className="container flex h-16 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="container flex flex-col items-center pb-20 pt-16 text-center sm:pt-24">
        <Badge variant="outline" className="mb-6 gap-1.5 py-1">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          AI-written · updated daily
        </Badge>

        <h1 className="max-w-3xl text-balance font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Your personal <span className="highlight">tech newspaper</span>,
          written from the timeline.
        </h1>
        <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
          {APP_TAGLINE} {APP_NAME} follows the tech leaders you care about and
          turns their day on X into a brief worth reading.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ variant: "gradient", size: "lg" }),
              "w-full sm:w-auto",
            )}
          >
            Start reading free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full sm:w-auto",
            )}
          >
            I have an account
          </Link>
        </div>

        {/* Faces */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <div className="flex -space-x-3">
            {faces.map((p) => (
              <Avatar
                key={p.handle}
                src={avatarUrl(p.handle)}
                name={p.name}
                size={44}
                className="ring-2 ring-background"
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Tracking {tracking}.</p>
          <CreditsMeter
            remainingUsd={pool.remainingUsd}
            totalUsd={pool.totalUsd}
            className="mt-1"
          />
        </div>
      </section>

      <section className="container grid gap-4 pb-24 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} delay={i * 0.1} className="h-full">
            <div className="h-full rounded-2xl border border-border bg-card/60 p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          </Reveal>
        ))}
      </section>
    </main>
  );
}
