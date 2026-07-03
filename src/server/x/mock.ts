import type {
  IngestSource,
  NormalizedReply,
  NormalizedTweet,
  PersonBundle,
  PersonRef,
  FetchOptions,
} from "./types";
import { tweetUrl } from "@/lib/constants";
import { startOfUtcDay } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Deterministic RNG so fixtures are stable per (handle, day) but vary
 * across days — good for demos and idempotent re-ingestion.
 * ------------------------------------------------------------------ */
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private next: () => number;
  constructor(seed: string) {
    this.next = mulberry32(hashString(seed));
  }
  float() {
    return this.next();
  }
  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
  sample<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    const out: T[] = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(this.next() * copy.length), 1)[0]!);
    }
    return out;
  }
  bool(p = 0.5) {
    return this.next() < p;
  }
}

/* ------------------------------------------------------------------ *
 * Persona content — substantive, on-brand posts per tracked person.
 * ------------------------------------------------------------------ */
interface Post {
  text: string;
  topics: string[];
}

const PERSONA: Record<string, { influence: number; posts: Post[] }> = {
  elonmusk: {
    influence: 1.0,
    posts: [
      {
        text: "The pace of AI improvement is faster than people realize. Compute is the constraint, and we're bringing enormous capacity online.",
        topics: ["AI", "compute"],
      },
      {
        text: "Grok is getting smarter every week. The goal is maximally truth-seeking AI, even when the truth is uncomfortable.",
        topics: ["Grok", "AI"],
      },
      {
        text: "Full self-driving is fundamentally a real-world AI problem. Vision plus neural nets, no lidar crutches.",
        topics: ["FSD", "autonomy"],
      },
      {
        text: "Building a gigafactory for compute. The amount of energy needed to train frontier models is staggering.",
        topics: ["energy", "compute", "datacenters"],
      },
      {
        text: "Free speech is the bedrock of a functioning democracy. X will remain the town square.",
        topics: ["X", "free speech"],
      },
      {
        text: "Starship will make life multiplanetary. Making humanity a spacefaring civilization is the point.",
        topics: ["SpaceX", "Starship"],
      },
      {
        text: "Manufacturing is underrated. Prototypes are easy; production at scale is the hard part that separates real companies.",
        topics: ["manufacturing", "Tesla"],
      },
    ],
  },
  sama: {
    influence: 0.92,
    posts: [
      {
        text: "The next model is a real step change. It's the first time it feels like talking to a genuinely thoughtful colleague.",
        topics: ["models", "AGI"],
      },
      {
        text: "Compute is the currency of the future. We are going to need vastly more of it than the world currently plans for.",
        topics: ["compute", "infrastructure"],
      },
      {
        text: "We should distribute the benefits of AI as widely as possible. Abundance is the goal, not concentration.",
        topics: ["AI policy", "abundance"],
      },
      {
        text: "Cost per unit of intelligence has fallen ~10x a year. That trend reshapes every industry underneath it.",
        topics: ["cost", "scaling"],
      },
      {
        text: "Agents that can do real multi-step work reliably are close. This is the year they cross from demo to useful.",
        topics: ["agents", "productivity"],
      },
      {
        text: "Energy and chips are the two bottlenecks. Solve those and the software follows.",
        topics: ["energy", "chips"],
      },
    ],
  },
  karpathy: {
    influence: 0.8,
    posts: [
      {
        text: "The hottest new programming language is English. We are all prompt engineers now, whether we admit it or not.",
        topics: ["LLMs", "software"],
      },
      {
        text: "Spent the weekend training a nanoscale GPT from scratch. Nothing teaches you the stack like building it end to end.",
        topics: ["training", "education"],
      },
      {
        text: "RL from human feedback is doing a lot of heavy lifting, but the base model is where the real magic lives.",
        topics: ["RLHF", "pretraining"],
      },
      {
        text: "Context windows keep growing, but retrieval and memory design still matter enormously. Bigger isn't automatically better.",
        topics: ["context", "RAG"],
      },
      {
        text: "Agents are just LLMs in a loop with tools. The engineering challenge is the loop, not the model.",
        topics: ["agents", "tools"],
      },
      {
        text: "Data quality beats data quantity almost every time. Curation is the underrated superpower of great labs.",
        topics: ["data", "curation"],
      },
    ],
  },
  JenHsunHuang: {
    influence: 0.88,
    posts: [
      {
        text: "Accelerated computing is the reinvention of the entire stack. The more you buy, the more you save.",
        topics: ["GPUs", "accelerated computing"],
      },
      {
        text: "Demand for our latest architecture is extraordinary. Every industry is becoming a computing industry.",
        topics: ["demand", "GPUs"],
      },
      {
        text: "The data center is the new unit of computing. We design the whole thing — chips, systems, networking, software.",
        topics: ["datacenters", "systems"],
      },
      {
        text: "AI factories will generate intelligence the way power plants generate electricity. That is the coming decade.",
        topics: ["AI factories", "infrastructure"],
      },
      {
        text: "Robotics is the next trillion-dollar wave. Physical AI needs simulation, and simulation needs GPUs.",
        topics: ["robotics", "simulation"],
      },
    ],
  },
  demishassabis: {
    influence: 0.82,
    posts: [
      {
        text: "AI for science is the application I'm most excited about. Compressing decades of research into years is within reach.",
        topics: ["AI for science", "research"],
      },
      {
        text: "Our latest model shows real gains in reasoning and long-horizon planning. Benchmarks only tell part of the story.",
        topics: ["reasoning", "Gemini"],
      },
      {
        text: "AlphaFold changed structural biology. The next frontier is modelling entire cellular processes.",
        topics: ["AlphaFold", "biology"],
      },
      {
        text: "We need to build AGI responsibly and thoughtfully. Safety and ambition are not in tension — they're partners.",
        topics: ["AGI", "safety"],
      },
      {
        text: "Games taught us that agents can discover strategies humans never considered. Now we point that at the real world.",
        topics: ["agents", "RL"],
      },
    ],
  },
  ylecun: {
    influence: 0.78,
    posts: [
      {
        text: "LLMs are useful but they are not the road to human-level AI. We need world models that actually understand physics.",
        topics: ["world models", "AGI"],
      },
      {
        text: "Open source AI is safer, not more dangerous. Scrutiny by thousands of researchers beats security by obscurity.",
        topics: ["open source", "safety"],
      },
      {
        text: "Auto-regressive prediction is a dead end for reasoning. Objective-driven architectures are the future.",
        topics: ["architecture", "reasoning"],
      },
      {
        text: "The doom narratives are wildly overblown. We can barely get a robot to clear a dinner table.",
        topics: ["AI risk", "robotics"],
      },
      {
        text: "A house cat has more common-sense understanding of the world than any current LLM. Let that sink in.",
        topics: ["common sense", "world models"],
      },
    ],
  },
  AravSrinivas: {
    influence: 0.7,
    posts: [
      {
        text: "Search is being rebuilt from scratch around answers, not links. Users want the destination, not ten blue doors.",
        topics: ["search", "product"],
      },
      {
        text: "Shipped a big accuracy improvement to our answer engine today. Speed and citations are non-negotiable.",
        topics: ["product", "citations"],
      },
      {
        text: "Agents that browse, reason, and act on your behalf are the real unlock. We're building toward that relentlessly.",
        topics: ["agents", "browsing"],
      },
      {
        text: "The moat in AI products is taste, latency, and trust — not just the underlying model.",
        topics: ["product", "moats"],
      },
      {
        text: "Every knowledge worker will have a research assistant that never sleeps. That's the world we're shipping.",
        topics: ["productivity", "assistants"],
      },
    ],
  },
  DarioAmodei: {
    influence: 0.76,
    posts: [
      {
        text: "Interpretability is finally making real progress. Understanding what's happening inside models is essential for trust.",
        topics: ["interpretability", "safety"],
      },
      {
        text: "Scaling laws have held far longer than skeptics predicted. We should plan for models dramatically more capable soon.",
        topics: ["scaling", "safety"],
      },
      {
        text: "Powerful AI could compress a century of scientific progress into a decade — if we steer it carefully.",
        topics: ["AI benefits", "science"],
      },
      {
        text: "Responsible scaling means tying capabilities to concrete safety commitments. Voluntary isn't enough long-term.",
        topics: ["policy", "safety"],
      },
      {
        text: "The economic effects of AI will arrive faster than institutions are prepared for. We should start planning now.",
        topics: ["economy", "policy"],
      },
    ],
  },
  AndrewYNg: {
    influence: 0.74,
    posts: [
      {
        text: "AI is the new electricity. The biggest opportunities are in applying it to concrete problems, not chasing AGI headlines.",
        topics: ["applied AI", "economy"],
      },
      {
        text: "Agentic workflows are the most important trend in AI this year. Iterate, reflect, use tools — accuracy jumps.",
        topics: ["agents", "workflows"],
      },
      {
        text: "Don't wait for the perfect model. Build, measure, and improve. Speed of iteration is your real advantage.",
        topics: ["execution", "product"],
      },
      {
        text: "AI literacy should be as fundamental as reading. Every profession benefits from knowing how to use these tools.",
        topics: ["education", "literacy"],
      },
      {
        text: "Small teams with good data and clear metrics routinely beat big teams without them. Focus wins.",
        topics: ["data", "teams"],
      },
    ],
  },
};

const DEFAULT_PERSONA = {
  influence: 0.6,
  posts: [
    {
      text: "Thinking a lot about where AI goes next. The building blocks are here; execution is everything now.",
      topics: ["AI"],
    },
    {
      text: "Shipping beats theorizing. Put it in front of users and learn.",
      topics: ["product"],
    },
    {
      text: "The gap between demo and product is where most of the real work lives.",
      topics: ["engineering"],
    },
  ],
};

/* ------------------------------------------------------------------ *
 * Community reply personas + templates (clearly not the leaders).
 * ------------------------------------------------------------------ */
const REPLY_AUTHORS = [
  { handle: "devtaylor", name: "Taylor Chen" },
  { handle: "ml_priya", name: "Priya N." },
  { handle: "gpu_gus", name: "Gus Reinholt" },
  { handle: "skeptic_sam", name: "Sam Ortega" },
  { handle: "founderfay", name: "Fay Williams" },
  { handle: "researchraj", name: "Raj Malhotra" },
  { handle: "buildwithko", name: "Ko Tanaka" },
  { handle: "vc_dana", name: "Dana Brooks" },
  { handle: "prof_lin", name: "Dr. Wei Lin" },
  { handle: "indiehacker_max", name: "Max Feld" },
];

const REPLY_TEMPLATES: Record<string, string[]> = {
  supportive: [
    "This is exactly right. {topic} is moving faster than most people are pricing in.",
    "Been saying this for months — {topic} changes the whole calculus.",
    "100%. The {topic} angle is underrated and this nails it.",
  ],
  skeptical: [
    "Bold claim. I'll believe the {topic} timeline when I see it in production, not a demo.",
    "Respectfully, the {topic} hype is getting ahead of the reality on the ground.",
    "Not convinced. Every {topic} promise seems to slip six months to the right.",
  ],
  curious: [
    "Genuinely curious how you're thinking about {topic} costs at scale here.",
    "What does this mean for smaller teams that can't afford the {topic} bill?",
    "Interesting — does this hold up once you factor in {topic} latency?",
  ],
  addsInfo: [
    "Worth noting: we're seeing similar {topic} results internally, though the edge cases are brutal.",
    "For anyone new here, the {topic} bottleneck has been the story for two years now.",
    "Data point: our {topic} numbers roughly match this, with a big caveat on reliability.",
  ],
  witty: [
    "The {topic} discourse writing itself in this thread is elite.",
    "Screenshotting this for when the {topic} skeptics come back in six months.",
    "Every {topic} thread eventually becomes a debate about GPUs. Never fails.",
  ],
};

const STANCES = Object.keys(REPLY_TEMPLATES);

function fill(template: string, topic: string): string {
  return template.replace(/\{topic\}/g, topic);
}

/* ------------------------------------------------------------------ *
 * Generation
 * ------------------------------------------------------------------ */
function tweetIdFor(handle: string, day: Date, index: number): string {
  const ymd = `${day.getUTCFullYear()}${String(day.getUTCMonth() + 1).padStart(2, "0")}${String(day.getUTCDate()).padStart(2, "0")}`;
  const code = String(hashString(handle) % 10000).padStart(4, "0");
  return `17${ymd}${code}${String(index).padStart(2, "0")}`;
}

/** Build a full day of content for one person (deterministic per day). */
export function buildPersonDay(
  person: PersonRef,
  dayInput: Date,
): PersonBundle {
  const day = startOfUtcDay(dayInput);
  const persona = PERSONA[person.handle] ?? DEFAULT_PERSONA;
  const dayKey = day.toISOString().slice(0, 10);
  const rng = new Rng(`${person.handle}:${dayKey}`);

  const tweetCount = rng.int(3, 6);
  const chosen = rng.sample(
    persona.posts,
    Math.min(tweetCount, persona.posts.length),
  );

  const tweets: NormalizedTweet[] = [];
  const replies: NormalizedReply[] = [];

  chosen.forEach((post, i) => {
    const xTweetId = tweetIdFor(person.handle, day, i);
    const hour =
      8 + Math.floor((14 / Math.max(1, chosen.length)) * i) + rng.int(0, 1);
    const postedAt = new Date(day);
    postedAt.setUTCHours(hour, rng.int(0, 59), 0, 0);

    const influence = persona.influence;
    const likeCount = Math.round(
      rng.int(400, 9000) * influence * (1 + i * 0.1),
    );
    const replyCount = Math.round(rng.int(40, 700) * influence);
    const retweetCount = Math.round(likeCount * rng.float() * 0.18);
    const quoteCount = Math.round(retweetCount * 0.4);
    const viewCount = Math.round(likeCount * rng.int(60, 220));

    tweets.push({
      xTweetId,
      authorHandle: person.handle,
      text: post.text,
      lang: "en",
      likeCount,
      retweetCount,
      replyCount,
      quoteCount,
      viewCount,
      isReply: false,
      isRetweet: false,
      conversationId: xTweetId,
      postedAt: postedAt.toISOString(),
      url: tweetUrl(person.handle, xTweetId),
      raw: { source: "mock", topics: post.topics },
    });

    // Notable replies for this tweet.
    const nReplies = rng.int(2, 5);
    const authors = rng.sample(REPLY_AUTHORS, nReplies);
    authors.forEach((author, j) => {
      const stance = rng.pick(STANCES);
      const topic = rng.pick(post.topics);
      const template = rng.pick(REPLY_TEMPLATES[stance]!);
      const replyId = `${xTweetId}0${j}`;
      const replyTime = new Date(postedAt.getTime() + rng.int(3, 180) * 60_000);
      replies.push({
        xTweetId: replyId,
        parentXTweetId: xTweetId,
        conversationId: xTweetId,
        authorHandle: author.handle,
        authorName: author.name,
        text: fill(template, topic),
        likeCount: Math.round(rng.int(5, 1200) * influence),
        replyCount: rng.int(0, 40),
        postedAt: replyTime.toISOString(),
        url: tweetUrl(author.handle, replyId),
        raw: { source: "mock", stance, topic },
      });
    });
  });

  return { handle: person.handle, xUserId: person.xUserId, tweets, replies };
}

/** Mock ingest source — returns "today's" bundle, filtered by `since`. */
export class MockSource implements IngestSource {
  readonly mode = "mock" as const;

  callCount(): number {
    return 0;
  }

  async fetchForPerson(
    person: PersonRef,
    opts: FetchOptions = {},
  ): Promise<PersonBundle> {
    const bundle = buildPersonDay(person, new Date());
    if (opts.since) {
      const since = opts.since.getTime();
      bundle.tweets = bundle.tweets.filter(
        (t) => new Date(t.postedAt).getTime() > since,
      );
      const keptIds = new Set(bundle.tweets.map((t) => t.xTweetId));
      bundle.replies = bundle.replies.filter((r) =>
        keptIds.has(r.parentXTweetId),
      );
    }
    return bundle;
  }
}
