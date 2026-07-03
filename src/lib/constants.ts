/** App-wide constants and the default roster of tracked tech leaders. */

export const APP_NAME = "The Signal";
export const APP_TAGLINE = "Your AI-written tech newspaper, from the timeline.";
export const APP_DESCRIPTION =
  "The Signal reads what the most influential people in technology are posting on X and writes you a concise, daily news brief — the story, the discussion, and the sentiment.";

export interface SeedPerson {
  handle: string; // canonical X handle (no @)
  name: string;
  title: string;
  bio: string;
  verified: boolean;
}

/** Avatar URL for a handle (proxied real X avatar, falls back client-side). */
export function avatarUrl(handle: string): string {
  return `https://unavatar.io/twitter/${handle}?fallback=https://api.dicebear.com/9.x/glass/png?seed=${encodeURIComponent(
    handle,
  )}`;
}

/** Public X profile URL for a handle. */
export function profileUrl(handle: string): string {
  return `https://x.com/${handle}`;
}

/** Public X status URL. */
export function tweetUrl(handle: string, tweetId: string): string {
  return `https://x.com/${handle}/status/${tweetId}`;
}

/**
 * Default recommendations shown during onboarding. These are seeded as
 * TrackedPerson rows so users can immediately select any combination.
 */
export const RECOMMENDED_PEOPLE: SeedPerson[] = [
  {
    handle: "elonmusk",
    name: "Elon Musk",
    title: "CEO, Tesla & SpaceX · Owner of X",
    bio: "Building electric cars, rockets, and posting through it. Frequent commentary on AI, energy, and free speech.",
    verified: true,
  },
  {
    handle: "sama",
    name: "Sam Altman",
    title: "CEO, OpenAI",
    bio: "Leads OpenAI. Posts on AGI, compute, and the future of AI infrastructure.",
    verified: true,
  },
];

export const SUMMARY_MODEL_LABEL: Record<string, string> = {
  template: "Signal Editor",
  anthropic: "Claude",
  openai: "GPT",
  gemini: "Gemini",
  huggingface: "Hugging Face",
};
