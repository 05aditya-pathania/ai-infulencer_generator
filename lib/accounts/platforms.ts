export const socialPlatforms = [
  { id: "instagram", label: "Instagram", icon: "◎" },
  { id: "tiktok", label: "TikTok", icon: "♪" },
  { id: "linkedin", label: "LinkedIn", icon: "in" },
  { id: "facebook", label: "Facebook", icon: "f" },
  { id: "pinterest", label: "Pinterest", icon: "P" },
  { id: "twitter", label: "X (Twitter)", icon: "𝕏" },
  { id: "youtube", label: "YouTube", icon: "▶" },
] as const;

export type SocialPlatform = (typeof socialPlatforms)[number]["id"];

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return (
    typeof value === "string" &&
    socialPlatforms.some((platform) => platform.id === value)
  );
}
