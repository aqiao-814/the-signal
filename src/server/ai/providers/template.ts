import type {
  SentimentLabel,
  SummaryInput,
  SummaryReply,
  SummaryResult,
  Summarizer,
} from "../types";

/* ------------------------------------------------------------------ *
 * Sentiment + discussion analysis over the full sampled reply set.
 * ------------------------------------------------------------------ */
const POSITIVE = [
  "exactly",
  "so true",
  "100%",
  "great",
  "love this",
  "love it",
  "brilliant",
  "nails it",
  "well said",
  "underrated",
  "agree",
  "agreed",
  "impressive",
  "excited",
  "spot on",
  "elite",
  "based",
  "this is huge",
  "incredible",
  "amazing",
  "finally",
  "beautiful",
  "genius",
  "bullish",
  "let's go",
  "lfg",
  "respect",
  "insightful",
  "makes sense",
  "fair point",
  "good point",
  "goated",
];
const NEGATIVE = [
  "not convinced",
  "bold claim",
  "overhyped",
  "hype",
  "skeptical",
  "skeptic",
  "overblown",
  "doubt",
  "delusional",
  "disagree",
  "wrong",
  "nonsense",
  "concern",
  "concerning",
  "believe it when",
  "respectfully",
  "dead end",
  "cope",
  "grift",
  "scam",
  "disappointing",
  "underwhelming",
  "vaporware",
  "slop",
  "terrible",
  "awful",
  "worried",
  "dangerous",
  "hard pass",
  "yikes",
  "citation needed",
  "touch grass",
  "clown",
  "embarrassing",
];
/** Words that are opinions/filler, never good "topic" chips. */
const NON_TOPIC = new Set([
  "amazing",
  "agree",
  "agreed",
  "love",
  "great",
  "awesome",
  "based",
  "true",
  "right",
  "wrong",
  "nice",
  "cool",
  "good",
  "best",
  "better",
  "congrats",
  "congratulations",
  "thanks",
  "thank",
  "please",
  "exactly",
  "facts",
  "real",
  "fake",
  "goat",
  "king",
  "legend",
  "insane",
  "crazy",
  "wow",
  "lmao",
  "lmfao",
  "bruh",
  "sir",
  "hello",
  "please",
  "everyone",
  "someone",
  "anyone",
  "point",
  "people",
  "world",
  "today",
  "tomorrow",
  "always",
  "never",
  "everything",
  "something",
  "nothing",
  "anything",
]);

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "your",
  "with",
  "that",
  "this",
  "have",
  "has",
  "had",
  "was",
  "were",
  "will",
  "would",
  "can",
  "could",
  "should",
  "they",
  "them",
  "their",
  "there",
  "here",
  "what",
  "when",
  "why",
  "how",
  "who",
  "which",
  "from",
  "into",
  "than",
  "then",
  "just",
  "like",
  "get",
  "got",
  "one",
  "all",
  "any",
  "out",
  "its",
  "it's",
  "i'm",
  "you're",
  "don't",
  "doesn't",
  "isn't",
  "about",
  "really",
  "very",
  "much",
  "more",
  "most",
  "some",
  "even",
  "also",
  "still",
  "yeah",
  "yes",
  "lol",
  "haha",
  "gonna",
  "want",
  "need",
  "make",
  "made",
  "going",
  "think",
  "know",
  "say",
  "said",
  "way",
  "actually",
  "literally",
  "guys",
  "man",
  "bro",
  "these",
  "those",
  "over",
  "only",
  "because",
  "been",
  "being",
  "does",
  "did",
  "amp",
  "via",
  "im",
  "your",
  "youre",
  "dont",
  "cant",
  "wont",
  "isnt",
  "with",
  "will",
]);

/** Common capitalized words that aren't real subjects. */
const NOT_PROPER = new Set([
  "the",
  "a",
  "an",
  "i",
  "we",
  "you",
  "he",
  "she",
  "it",
  "they",
  "this",
  "that",
  "these",
  "those",
  "my",
  "our",
  "your",
  "his",
  "her",
  "their",
  "and",
  "but",
  "so",
  "if",
  "or",
  "no",
  "yes",
  "not",
  "today",
  "also",
  "just",
  "now",
  "why",
  "how",
  "what",
  "when",
  "who",
  "new",
  "good",
  "great",
  "amazing",
]);

function cleanText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^(?:@\w+\s+)+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect spam / bot / low-value replies so they don't pollute the brief. */
function isJunk(text: string): boolean {
  const raw = text.toLowerCase();
  const clean = cleanText(text);
  const letters = (clean.match(/[a-z]/gi) ?? []).length;
  if (letters < 10) return true; // emoji-only / too short to mean anything
  const patterns = [
    "dear",
    "urgent",
    "message alert",
    "online safety",
    "telegram",
    "whatsapp",
    "airdrop",
    "giveaway",
    "claim your",
    "dm me",
    "dm for",
    "check dm",
    "t.me/",
    "join my",
    "free crypto",
    "investment",
    "guaranteed profit",
    "binance",
    "seed phrase",
    "you won",
    "gift card",
    "click the link",
    "make $",
    "earn $",
    "per day",
    "financial freedom",
    "🎁",
    "💰",
  ];
  return patterns.some((p) => raw.includes(p));
}

function polarity(r: SummaryReply): number {
  const t = ` ${cleanText(r.text).toLowerCase()} `;
  let s = 0;
  if (r.stance === "supportive") s += 2;
  if (r.stance === "skeptical") s -= 2;
  for (const w of POSITIVE) if (t.includes(w)) s += 1;
  for (const w of NEGATIVE) if (t.includes(w)) s -= 1;
  return s;
}

function weight(r: SummaryReply): number {
  return 1 + Math.min(Math.log10(1 + Math.max(0, r.likeCount)), 3);
}

interface SentimentRead {
  label: SentimentLabel;
  score: number;
  supportRatio: number;
  opinionated: number;
  positives: SummaryReply[];
  negatives: SummaryReply[];
}

function readSentiment(replies: SummaryReply[]): SentimentRead {
  let posW = 0;
  let negW = 0;
  const positives: SummaryReply[] = [];
  const negatives: SummaryReply[] = [];
  for (const r of replies) {
    if (isJunk(r.text)) continue;
    const p = polarity(r);
    if (p > 0) {
      posW += weight(r);
      positives.push(r);
    } else if (p < 0) {
      negW += weight(r);
      negatives.push(r);
    }
  }
  positives.sort((a, b) => b.likeCount - a.likeCount);
  negatives.sort((a, b) => b.likeCount - a.likeCount);

  const denom = posW + negW;
  const supportRatio = denom === 0 ? 0.5 : posW / denom;
  const score = denom === 0 ? 0 : Number(((posW - negW) / denom).toFixed(2));
  const opinionated = positives.length + negatives.length;

  let label: SentimentLabel;
  if (opinionated < 3) label = "NEUTRAL";
  else if (supportRatio >= 0.62) label = "POSITIVE";
  else if (supportRatio <= 0.38) label = "NEGATIVE";
  else label = "MIXED";

  return { label, score, supportRatio, opinionated, positives, negatives };
}

export function analyzeSentiment(input: SummaryInput): {
  label: SentimentLabel;
  score: number;
} {
  const { label, score } = readSentiment(input.replies);
  return { label, score };
}

/** Proper-noun-ish subjects from a tweet (Optimus, ChatGPT, Fremont …). */
function properNouns(text: string): string[] {
  const cleaned = cleanText(text);
  const words = cleaned.split(/\s+/);
  const out: string[] = [];
  const seen = new Set<string>();
  words.forEach((w, i) => {
    const tok = w.replace(/[^A-Za-z0-9]/g, "");
    if (tok.length < 3) return;
    if (i === 0) return; // skip the sentence-initial capital
    if (!/^[A-Z][a-zA-Z0-9]+$/.test(tok)) return;
    const key = tok.toLowerCase();
    if (NOT_PROPER.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push(tok);
  });
  return out;
}

/** Meaningful lowercase keywords from arbitrary text. */
function keywords(text: string): string[] {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !NON_TOPIC.has(w));
}

/** What the crowd kept talking about (filtered of opinion words + junk). */
function discussionThemes(
  input: SummaryInput,
  nameParts: Set<string>,
): string[] {
  const counts = new Map<string, number>();
  for (const r of input.replies) {
    if (isJunk(r.text)) continue;
    const seen = new Set<string>();
    for (const w of keywords(r.text)) {
      if (nameParts.has(w) || seen.has(w)) continue;
      seen.add(w);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 3);
}

/* ------------------------------------------------------------------ *
 * Phrasing helpers
 * ------------------------------------------------------------------ */
function seeded(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function humanList(items: string[]): string {
  if (items.length === 0) return "a range of subjects";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function quote(text: string, max = 150): string | null {
  if (isJunk(text)) return null;
  const cleaned = cleanText(text);
  if (cleaned.length < 15) return null;
  const clause = (cleaned.split(/(?<=[.!?])\s|[—–]/)[0] ?? cleaned).trim();
  const out =
    clause.length > max ? clause.slice(0, max - 1).trim() + "…" : clause;
  return out.length < 12 ? null : out;
}

/** First reply in the list that yields a clean, quotable line. */
function firstQuotable(
  list: SummaryReply[],
): { reply: SummaryReply; text: string } | null {
  for (const reply of list) {
    const q = quote(reply.text);
    if (q) return { reply, text: q };
  }
  return null;
}

function moodPhrase(read: SentimentRead): string {
  if (read.opinionated < 4) return "hard to read from the early replies";
  const r = read.supportRatio;
  if (r >= 0.75) return "overwhelmingly positive";
  if (r >= 0.58) return "mostly supportive, with a vocal minority pushing back";
  if (r >= 0.42) return "split almost down the middle";
  if (r >= 0.25) return "mostly skeptical";
  return "largely critical";
}

const LEAD_VERBS = [
  "trained the spotlight on",
  "spent the day on",
  "leaned into",
  "made the case for",
  "kept hammering on",
];

const CLOSERS = [
  "another day of the timeline arguing about the future in real time.",
  "proof that, on X, the replies are half the story.",
  "a reminder that the discourse never really sleeps.",
  "exactly the kind of thread that sets the week's agenda.",
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ *
 * Compose
 * ------------------------------------------------------------------ */
export function composeArticle(input: SummaryInput): SummaryResult {
  const rnd = seeded(`${input.person.handle}:${input.editorialDate}`);
  const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]!;
  const name = input.person.name;
  const nameParts = new Set(
    `${name} ${input.person.handle}`.toLowerCase().split(/\s+/),
  );

  const sorted = [...input.tweets].sort(
    (a, b) => b.likeCount + b.retweetCount - (a.likeCount + a.retweetCount),
  );
  const lead = sorted.find((t) => quote(t.text)) ?? sorted[0];

  const read = readSentiment(input.replies);
  const themes = discussionThemes(input, nameParts);

  // Subject: prefer a proper noun from the lead tweet, then a keyword, then
  // the extracted tweet topic — never an opinion word.
  const leadSubjects = lead
    ? [...properNouns(lead.text), ...keywords(lead.text)]
    : [];
  const tweetTopicWords = input.tweets
    .flatMap((t) => t.topics)
    .filter((t) => !NON_TOPIC.has(t.toLowerCase()));
  const subject =
    leadSubjects[0] ?? tweetTopicWords[0] ?? themes[0] ?? "technology";

  const mood = moodPhrase(read);
  const hasReplies = input.replies.some((r) => !isJunk(r.text));

  // ---- Headline + dek ----
  const headline = lead
    ? `${name} ${pick(LEAD_VERBS)} ${subject}`.replace(/:$/, "")
    : `A quieter day for ${name}`;

  const dek = hasReplies
    ? `The reaction was ${mood}.`
    : `A lower-key day on the feed, with ${input.metrics.tweetCount} ${input.metrics.tweetCount === 1 ? "post" : "posts"}.`;

  // ---- Body ----
  const paras: string[] = [];

  if (lead) {
    const q = quote(lead.text);
    const opener = `Today, ${name} ${pick(LEAD_VERBS).replace(/:$/, "")} ${subject}.`;
    const stat = `${lead.likeCount.toLocaleString()} likes and ${lead.replyCount.toLocaleString()} replies`;
    paras.push(
      q
        ? `${opener} "${q}," they posted — a message that pulled in roughly ${stat} within hours.`
        : `${opener} Their most-talked-about post pulled in roughly ${stat} within hours.`,
    );
  } else {
    paras.push(
      `It was a quiet day for ${name}, with little new posted to the feed.`,
    );
  }

  if (read.opinionated >= 3) {
    const sup = firstQuotable(read.positives);
    const skep = firstQuotable(read.negatives);

    let p2 = `Reading through the replies, the mood was ${mood}.`;
    if (themes.length) {
      p2 += ` The discussion kept circling back to ${humanList(themes)}.`;
    }

    // Lead with the side that matches the overall mood; add the counterpoint.
    if (read.label === "NEGATIVE") {
      if (skep)
        p2 += ` "${skep.text}," wrote @${skep.reply.authorHandle}, capturing the criticism.`;
      if (sup)
        p2 += ` Some defended it — "${sup.text}," countered @${sup.reply.authorHandle}.`;
    } else if (read.label === "POSITIVE") {
      if (sup)
        p2 += ` "${sup.text}," wrote @${sup.reply.authorHandle}, echoing the enthusiasm.`;
      if (skep)
        p2 += ` Not everyone was sold — "${skep.text}," countered @${skep.reply.authorHandle}.`;
    } else {
      if (sup) p2 += ` "${sup.text}," wrote @${sup.reply.authorHandle}.`;
      if (skep)
        p2 += ` On the other side, "${skep.text}," countered @${skep.reply.authorHandle}.`;
    }
    paras.push(p2);
  } else if (hasReplies) {
    paras.push(
      `The replies stayed light and hard to read either way — no clear consensus formed.`,
    );
  }

  const otherSubjects = [
    ...new Set(tweetTopicWords.map((t) => t.toLowerCase())),
  ]
    .filter((t) => t !== subject.toLowerCase())
    .slice(0, 3);
  paras.push(
    otherSubjects.length > 0
      ? `Elsewhere, ${name} also touched on ${humanList(otherSubjects)}. Taken together, it was ${pick(CLOSERS)}`
      : `Taken together, it was ${pick(CLOSERS)}`,
  );

  // Chips: subject + discussion themes + tweet topics, de-duped.
  const chips = [
    ...new Set([subject, ...themes, ...tweetTopicWords].map((t) => t.trim())),
  ]
    .filter(Boolean)
    .slice(0, 5);

  return {
    headline: cap(headline),
    dek: cap(dek),
    body: paras.join("\n\n"),
    sentiment: read.label,
    sentimentScore: read.score,
    topics: chips.length ? chips : [subject],
    model: "template:signal-editor",
  };
}

export class TemplateSummarizer implements Summarizer {
  readonly id = "template";
  async summarize(input: SummaryInput): Promise<SummaryResult> {
    return composeArticle(input);
  }
}
