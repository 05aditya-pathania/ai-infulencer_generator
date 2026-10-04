export const platforms = [
  { id: "instagram", label: "Instagram", icon: "◎" },
  { id: "tiktok", label: "TikTok", icon: "♪" },
  { id: "x", label: "X", icon: "𝕏" },
  { id: "linkedin", label: "LinkedIn", icon: "in" },
  { id: "pinterest", label: "Pinterest", icon: "℘" },
  { id: "facebook", label: "Facebook", icon: "f" },
] as const;

export const postFormats = [
  { id: "single", label: "Single", ratio: "1:1" },
  { id: "carousel", label: "Carousel", ratio: "1:1" },
  { id: "story", label: "Story / Reel", ratio: "9:16" },
  { id: "landscape", label: "Landscape", ratio: "16:9" },
] as const;

export const postGoals = [
  "Product launch",
  "Drive sales",
  "Grow awareness",
  "Engagement",
  "Educate",
] as const;

export const visualScenes = [
  "Urban",
  "Studio",
  "Nature",
  "Beach",
  "Home",
  "Abstract",
  "Street",
] as const;

export const captionTones = [
  "Playful",
  "Confident",
  "Minimal",
  "Warm",
  "Editorial",
] as const;

export const callToActions = [
  "Shop now",
  "Discover more",
  "Save this post",
  "Tell us below",
  "Learn more",
  "No CTA",
] as const;

export const postLanguages = [
  "English",
  "Spanish",
  "French",
  "Hindi",
] as const;

export type SocialPlatform = (typeof platforms)[number]["id"];
export type PostFormat = (typeof postFormats)[number]["id"];
export type PostGoal = (typeof postGoals)[number];
export type VisualScene = (typeof visualScenes)[number];
export type CaptionTone = (typeof captionTones)[number];
export type CallToAction = (typeof callToActions)[number];
export type PostLanguage = (typeof postLanguages)[number];

export type PostGenerationInput = {
  modelId: string;
  platform: SocialPlatform;
  format: PostFormat;
  campaign: string;
  product: string;
  goal: PostGoal;
  scene: VisualScene;
  tone: CaptionTone;
  callToAction: CallToAction;
  language: PostLanguage;
  hashtagCount: number;
  references: string[];
};

export function isPostGenerationInput(value: unknown): value is PostGenerationInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Record<string, unknown>;
  return (
    typeof input.modelId === "string" &&
    input.modelId.length <= 64 &&
    typeof input.platform === "string" &&
    platforms.some(({ id }) => id === input.platform) &&
    typeof input.format === "string" &&
    postFormats.some(({ id }) => id === input.format) &&
    typeof input.campaign === "string" &&
    input.campaign.length <= 80 &&
    typeof input.product === "string" &&
    input.product.length <= 80 &&
    typeof input.goal === "string" &&
    postGoals.some((goal) => goal === input.goal) &&
    typeof input.scene === "string" &&
    visualScenes.some((scene) => scene === input.scene) &&
    typeof input.tone === "string" &&
    captionTones.some((tone) => tone === input.tone) &&
    typeof input.callToAction === "string" &&
    callToActions.some((cta) => cta === input.callToAction) &&
    typeof input.language === "string" &&
    postLanguages.some((language) => language === input.language) &&
    typeof input.hashtagCount === "number" &&
    Number.isInteger(input.hashtagCount) &&
    input.hashtagCount >= 0 &&
    input.hashtagCount <= 20 &&
    Array.isArray(input.references) &&
    input.references.length <= 3 &&
    input.references.every((reference) => typeof reference === "string")
  );
}
