/** Normalized shapes the rest of the app consumes, independent of the source. */

export interface NormalizedTweet {
  xTweetId: string;
  authorHandle: string;
  text: string;
  lang?: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  isReply: boolean;
  isRetweet: boolean;
  conversationId?: string;
  postedAt: string; // ISO 8601
  url: string;
  raw?: unknown;
}

export interface NormalizedReply {
  xTweetId: string;
  /** The tracked person's tweet this reply belongs to. */
  parentXTweetId: string;
  conversationId?: string;
  authorHandle: string;
  authorName?: string;
  text: string;
  likeCount: number;
  replyCount: number;
  postedAt: string; // ISO 8601
  url: string;
  raw?: unknown;
}

export interface PersonBundle {
  handle: string;
  xUserId?: string | null;
  tweets: NormalizedTweet[];
  replies: NormalizedReply[];
}

export interface FetchOptions {
  /** Only fetch content newer than this timestamp. */
  since?: Date;
  /** Soft cap on tweets fetched per person per run. */
  maxTweets?: number;
}

export interface PersonRef {
  handle: string;
  name: string;
  xUserId?: string | null;
}

/** A source of X content — either the live API or local fixtures. */
export interface IngestSource {
  readonly mode: "live" | "mock";
  fetchForPerson(person: PersonRef, opts?: FetchOptions): Promise<PersonBundle>;
  /** Cumulative number of X API calls made by this source (0 for mock). */
  callCount(): number;
}
