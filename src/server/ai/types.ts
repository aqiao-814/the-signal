export type SentimentLabel = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";

export interface SummaryTweet {
  text: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  postedAt: string;
  topics: string[];
  url: string;
}

export interface SummaryReply {
  authorHandle: string;
  authorName?: string | null;
  text: string;
  likeCount: number;
  stance?: string;
}

export interface SummaryInput {
  person: { name: string; handle: string; title: string };
  editorialDate: string;
  tweets: SummaryTweet[];
  replies: SummaryReply[];
  metrics: {
    tweetCount: number;
    replyCount: number;
    totalLikes: number;
    totalReplies: number;
  };
}

export interface SummaryResult {
  headline: string;
  dek: string;
  body: string;
  sentiment: SentimentLabel;
  sentimentScore: number; // -1..1
  topics: string[];
  model: string;
}

export interface Summarizer {
  readonly id: string;
  summarize(input: SummaryInput): Promise<SummaryResult>;
}
