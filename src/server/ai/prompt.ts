import type { SummaryInput } from "./types";

/** Shared system prompt: enforce a tech-newsletter voice, not bullet points. */
export const SYSTEM_PROMPT = `You are the lead writer for "The Signal," a daily technology newspaper.
You turn a public figure's activity on X (Twitter) into a short, sharp news brief
that reads like Morning Brew or TechCrunch — a real article, not a summary of tweets.

Rules:
- Write in flowing prose. No bullet points, no lists, no "In this post..." meta-commentary.
- Lead with the most newsworthy thread of the day. Be specific and concrete.
- Cover: what they posted, the conversation it sparked, notable replies, and the overall sentiment.
- Use an engaged, editorial voice with personality — never generic AI phrasing like
  "In today's fast-paced world" or "It is important to note."
- 130-220 words in the body, 2-3 tight paragraphs.
- Never invent facts, numbers, or quotes beyond what the data provides.
- Respond with ONLY valid minified JSON, no markdown fences.`;

/** Build the user prompt (the day's data) and require a strict JSON shape. */
export function buildUserPrompt(input: SummaryInput): string {
  const tweets = input.tweets
    .slice(0, 8)
    .map(
      (t, i) =>
        `${i + 1}. "${t.text}" (${t.likeCount} likes, ${t.replyCount} replies)`,
    )
    .join("\n");

  const replies = input.replies
    .slice(0, 35)
    .map((r) => `- @${r.authorHandle}: "${r.text}" (${r.likeCount} likes)`)
    .join("\n");

  return `Write today's brief for ${input.person.name} (@${input.person.handle}, ${input.person.title}).
Date: ${input.editorialDate}
They posted ${input.metrics.tweetCount} times, drawing about ${input.metrics.totalReplies} replies and ${input.metrics.totalLikes} likes.

POSTS:
${tweets || "(no posts today)"}

REPLIES (a sample, most-liked first — read all of them):
${replies || "(no notable replies)"}

Analyze the discussion, don't just restate the post:
- Explain concretely what the post is actually about.
- Judge overall sentiment from the WHOLE reply set (weigh higher-liked replies more), and note whether the crowd agreed, was split, or pushed back.
- Name the specific points/themes people kept raising, and contrast a supportive take with a skeptical one.

Return JSON with exactly these fields:
{
  "headline": "punchy, specific, <= 90 chars",
  "dek": "one-sentence standfirst that adds context",
  "body": "the article prose, 2-3 paragraphs",
  "sentiment": "POSITIVE | NEUTRAL | NEGATIVE | MIXED",
  "sentimentScore": number between -1 and 1,
  "topics": ["3-5", "key", "topics"]
}`;
}
