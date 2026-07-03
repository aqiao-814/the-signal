import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  MessageSquare,
  FileText,
  RefreshCw,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { getPersonDetail } from "@/server/person-detail";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SentimentBadge } from "@/components/sentiment-badge";
import { SummaryArticle } from "@/components/summary-article";
import { TweetItem } from "@/components/tweet-item";
import { ReplyItem } from "@/components/reply-item";
import { EmptyState } from "@/components/empty-state";
import { RefreshButton } from "@/components/refresh-button";
import { avatarUrl, profileUrl } from "@/lib/constants";
import { coverageLabel } from "@/server/schedule";
import { cn, formatEditorialDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const detail = await getPersonDetail(handle);
  return { title: detail ? `${detail.person.name}'s brief` : "Not found" };
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  await requireUser();
  const { handle } = await params;
  const detail = await getPersonDetail(handle);
  if (!detail) notFound();

  const { person, latest, tweets, notableReplies, history, coverage } = detail;

  return (
    <main className="container max-w-3xl py-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to briefing
      </Link>

      {/* Profile header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar
          src={avatarUrl(person.handle)}
          name={person.name}
          size={72}
          ring
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold tracking-tight">
              {person.name}
            </h1>
            {person.verified ? (
              <Sparkles className="h-4 w-4 text-accent" />
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">@{person.handle}</p>
          {person.title ? (
            <p className="mt-0.5 text-sm font-medium text-foreground/80">
              {person.title}
            </p>
          ) : null}
        </div>
        <a
          href={profileUrl(person.handle)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Profile on X
          <ExternalLink className="h-4 w-4" />
        </a>
      </header>

      {person.bio ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {person.bio}
        </p>
      ) : null}

      {!latest ? (
        <div className="mt-8">
          <EmptyState
            icon={RefreshCw}
            title="No brief yet"
            description="We haven't written a summary for this person yet. Refresh your feed to generate one."
            action={<RefreshButton />}
          />
        </div>
      ) : (
        <>
          {/* The brief */}
          <article className="mt-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SentimentBadge sentiment={latest.sentiment} />
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {coverage
                  ? `Covers ${coverageLabel(coverage.from, coverage.to)}`
                  : formatEditorialDate(latest.summaryDate)}
              </span>
            </div>
            <h2 className="text-balance font-serif text-3xl font-semibold leading-tight tracking-tight">
              {latest.headline}
            </h2>
            {latest.dek ? (
              <p className="mt-2 text-balance text-lg text-muted-foreground">
                {latest.dek}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-4 border-y border-border py-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                {latest.tweetCount} posts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                {latest.replyCount} replies
              </span>
              {latest.model ? (
                <span className="ml-auto font-mono text-[11px] opacity-70">
                  {latest.model}
                </span>
              ) : null}
            </div>

            <div className="mt-6">
              <SummaryArticle body={latest.body} />
            </div>

            {latest.topics.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {latest.topics.map((t) => (
                  <Badge key={t} variant="outline" className="font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : null}
          </article>

          {/* Behind the brief */}
          {tweets.length > 0 ? (
            <section className="mt-10">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Most-liked posts
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                The top posts this briefing is built from.
              </p>
              <div className="space-y-3">
                {tweets.map((t) => (
                  <TweetItem
                    key={t.id}
                    text={t.text}
                    likeCount={t.likeCount}
                    retweetCount={t.retweetCount}
                    replyCount={t.replyCount}
                    postedAt={t.postedAt}
                    url={t.url}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {notableReplies.length > 0 ? (
            <section className="mt-10">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Notable replies
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                The most-liked replies across all of {person.name}&apos;s posts
                today.
              </p>
              <div className="space-y-3">
                {notableReplies.map((r) => (
                  <ReplyItem
                    key={r.id}
                    authorHandle={r.authorHandle}
                    authorName={r.authorName}
                    text={r.text}
                    likeCount={r.likeCount}
                    postedAt={r.postedAt}
                    url={r.url}
                    replyingTo={{ text: r.tweet.text, url: r.tweet.url }}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* History */}
          {history.length > 1 ? (
            <section className="mt-10">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Earlier briefs
              </h3>
              <div className="space-y-2">
                {history.slice(1).map((h) => (
                  <div
                    key={h.id}
                    className="flex items-baseline justify-between gap-4 rounded-lg border border-border/60 bg-card/40 px-4 py-3"
                  >
                    <p className="truncate text-sm font-medium">{h.headline}</p>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatEditorialDate(h.summaryDate)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
