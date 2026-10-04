export const genderOptions = ["Female", "Male"] as const;

export const bodyTypeOptions = [
  "Petite",
  "Athletic",
  "Slim",
  "Curvy",
  "Plus size",
  "Muscular",
] as const;

export const skinToneOptions = [
  { name: "Porcelain", color: "#f5dfd0" },
  { name: "Fair", color: "#e9c5aa" },
  { name: "Light", color: "#d8a77e" },
  { name: "Medium", color: "#bd825d" },
  { name: "Olive", color: "#9e704e" },
  { name: "Tan", color: "#855436" },
  { name: "Deep", color: "#613b2c" },
  { name: "Dark", color: "#39231e" },
] as const;

export const ageRangeOptions = [
  "18–24",
  "25–34",
  "35–44",
  "45–54",
  "55+",
] as const;

export const hairStyleOptions = [
  "Long waves",
  "Soft curls",
  "Straight",
  "Bob cut",
  "Braids",
  "Pixie",
  "Coils",
  "Slicked back",
] as const;

export const hairColorOptions = [
  "Jet black",
  "Dark brown",
  "Chestnut",
  "Honey blonde",
  "Platinum blonde",
  "Auburn",
  "Silver",
  "Colorful",
] as const;

export const eyeColorOptions = [
  "Brown",
  "Dark brown",
  "Hazel",
  "Green",
  "Blue",
  "Gray",
] as const;

export const vibeOptions = [
  { name: "Quiet luxury", emoji: "🕊️" },
  { name: "Streetwear", emoji: "🛹" },
  { name: "Soft & dreamy", emoji: "☁️" },
  { name: "Clean girl", emoji: "🍋" },
  { name: "Vintage soul", emoji: "🎞️" },
  { name: "Coastal cool", emoji: "🌊" },
  { name: "Bold & bright", emoji: "🌈" },
  { name: "Dark academia", emoji: "📚" },
] as const;

export const GENERATION_CREDIT_COST = 50;
export const STARTER_CREDITS = 300;

export type InfluencerTraits = {
  gender: (typeof genderOptions)[number];
  bodyType: (typeof bodyTypeOptions)[number];
  skinTone: (typeof skinToneOptions)[number]["name"];
  ageRange: (typeof ageRangeOptions)[number];
  hairStyle: (typeof hairStyleOptions)[number];
  hairColor: (typeof hairColorOptions)[number];
  eyeColor: (typeof eyeColorOptions)[number];
  vibe: (typeof vibeOptions)[number]["name"];
};

export function isInfluencerTraits(value: unknown): value is InfluencerTraits {
  if (!value || typeof value !== "object") {
    return false;
  }

  const traits = value as Record<string, unknown>;

  return (
    typeof traits.gender === "string" &&
    genderOptions.some((option) => option === traits.gender) &&
    typeof traits.bodyType === "string" &&
    bodyTypeOptions.some((option) => option === traits.bodyType) &&
    typeof traits.skinTone === "string" &&
    skinToneOptions.some((option) => option.name === traits.skinTone) &&
    typeof traits.ageRange === "string" &&
    ageRangeOptions.some((option) => option === traits.ageRange) &&
    typeof traits.hairStyle === "string" &&
    hairStyleOptions.some((option) => option === traits.hairStyle) &&
    typeof traits.hairColor === "string" &&
    hairColorOptions.some((option) => option === traits.hairColor) &&
    typeof traits.eyeColor === "string" &&
    eyeColorOptions.some((option) => option === traits.eyeColor) &&
    typeof traits.vibe === "string" &&
    vibeOptions.some((option) => option.name === traits.vibe)
  );
}
