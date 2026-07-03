import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { getIngestSource } from "./source";
import type { FetchOptions, PersonBundle } from "./types";

const log = createLogger("x:ingest");

export interface IngestPerson {
  id: string;
  handle: string;
  name: string;
  xUserId?: string | null;
}

export interface IngestResult {
  handle: string;
  tweets: number;
  replies: number;
  conversations: number;
}

/**
 * Fetch + persist one person's recent activity. Idempotent: tweets and replies
 * are keyed by their X id, so re-running only refreshes metrics.
 */
export async function ingestPerson(
  person: IngestPerson,
  opts: FetchOptions = {},
): Promise<IngestResult> {
  const source = getIngestSource();
  const bundle = await source.fetchForPerson(
    { handle: person.handle, name: person.name, xUserId: person.xUserId },
    { maxTweets: 25, ...opts },
  );
  return persistBundle(person, bundle);
}

/** Persist a bundle already fetched (used by the seeder for historical days). */
export async function persistBundle(
  person: IngestPerson,
  bundle: PersonBundle,
): Promise<IngestResult> {
  // Backfill the resolved X user id if we learned it.
  if (bundle.xUserId && !person.xUserId) {
    await prisma.trackedPerson.update({
      where: { id: person.id },
      data: { xUserId: bundle.xUserId },
    });
  }

  const conversationIds = new Set<string>();
  for (const t of bundle.tweets) {
    if (t.conversationId) conversationIds.add(t.conversationId);
  }

  // Ensure conversation rows exist and map xConversationId -> row id.
  const convMap = new Map<string, string>();
  for (const xConversationId of conversationIds) {
    const root = bundle.tweets.find(
      (t) => t.conversationId === xConversationId,
    );
    const conv = await prisma.conversation.upsert({
      where: { xConversationId },
      create: {
        xConversationId,
        trackedPersonId: person.id,
        rootTweetXId: root?.xTweetId,
        lastActivityAt: root ? new Date(root.postedAt) : new Date(),
      },
      update: {},
    });
    convMap.set(xConversationId, conv.id);
  }

  // Upsert tweets; remember xTweetId -> row id for reply linking.
  const tweetRowByXId = new Map<string, string>();
  for (const t of bundle.tweets) {
    const conversationId = t.conversationId
      ? convMap.get(t.conversationId)
      : undefined;
    const row = await prisma.tweet.upsert({
      where: { xTweetId: t.xTweetId },
      create: {
        xTweetId: t.xTweetId,
        trackedPersonId: person.id,
        conversationId,
        authorHandle: t.authorHandle,
        text: t.text,
        lang: t.lang,
        likeCount: t.likeCount,
        retweetCount: t.retweetCount,
        replyCount: t.replyCount,
        quoteCount: t.quoteCount,
        viewCount: t.viewCount,
        isReply: t.isReply,
        isRetweet: t.isRetweet,
        url: t.url,
        postedAt: new Date(t.postedAt),
        raw: t.raw as object,
      },
      update: {
        likeCount: t.likeCount,
        retweetCount: t.retweetCount,
        replyCount: t.replyCount,
        quoteCount: t.quoteCount,
        viewCount: t.viewCount,
        conversationId,
      },
    });
    tweetRowByXId.set(t.xTweetId, row.id);
  }

  // Upsert replies (skip any whose parent tweet we don't know).
  let replyCount = 0;
  for (const r of bundle.replies) {
    let parentId = tweetRowByXId.get(r.parentXTweetId);
    if (!parentId) {
      const existing = await prisma.tweet.findUnique({
        where: { xTweetId: r.parentXTweetId },
        select: { id: true },
      });
      parentId = existing?.id;
    }
    if (!parentId) continue;

    const conversationId = r.conversationId
      ? convMap.get(r.conversationId)
      : undefined;

    await prisma.reply.upsert({
      where: { xTweetId: r.xTweetId },
      create: {
        xTweetId: r.xTweetId,
        tweetId: parentId,
        conversationId,
        trackedPersonId: person.id,
        authorHandle: r.authorHandle,
        authorName: r.authorName,
        text: r.text,
        likeCount: r.likeCount,
        replyCount: r.replyCount,
        url: r.url,
        postedAt: new Date(r.postedAt),
        raw: r.raw as object,
      },
      update: { likeCount: r.likeCount, replyCount: r.replyCount },
    });
    replyCount += 1;
  }

  // Refresh conversation aggregate counts.
  for (const [xConversationId, convId] of convMap) {
    const [tweets, replies, latest] = await Promise.all([
      prisma.tweet.count({ where: { conversationId: convId } }),
      prisma.reply.count({ where: { conversationId: convId } }),
      prisma.reply.findFirst({
        where: { conversationId: convId },
        orderBy: { postedAt: "desc" },
        select: { postedAt: true },
      }),
    ]);
    await prisma.conversation.update({
      where: { xConversationId },
      data: {
        tweetCount: tweets,
        replyCount: replies,
        lastActivityAt: latest?.postedAt ?? undefined,
      },
    });
  }

  const result: IngestResult = {
    handle: person.handle,
    tweets: bundle.tweets.length,
    replies: replyCount,
    conversations: convMap.size,
  };
  log.debug("ingested", { ...result });
  return result;
}
