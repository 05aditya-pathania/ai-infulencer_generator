import type { InfluencerTraits } from "./options";

const outfitByVibe: Record<InfluencerTraits["vibe"], string> = {
  "Quiet luxury": "an elegant cream tailored set with understated gold jewelry",
  Streetwear: "a considered modern streetwear look with layered neutral pieces",
  "Soft & dreamy": "a flowing pastel outfit with light, delicate fabrics",
  "Clean girl": "a crisp minimalist outfit in fresh white and soft neutrals",
  "Vintage soul": "a beautifully styled vintage-inspired outfit with warm textures",
  "Coastal cool": "an effortless linen outfit in soft coastal tones",
  "Bold & bright": "a confident contemporary outfit with vibrant color accents",
  "Dark academia": "a refined dark academia outfit with rich, textured layers",
};

export function buildInfluencerPrompts(
  name: string,
  traits: InfluencerTraits,
  extraDetails: string,
) {
  const description = [
    `Create a fictional adult ${traits.gender.toLowerCase()} fashion and lifestyle creator named ${name}.`,
    `They are ${traits.ageRange} years old with a ${traits.bodyType.toLowerCase()} body type and ${traits.skinTone.toLowerCase()} skin.`,
    `They have ${traits.hairStyle.toLowerCase()} ${traits.hairColor.toLowerCase()} hair and ${traits.eyeColor.toLowerCase()} eyes.`,
    `Their personal style is ${traits.vibe.toLowerCase()}.`,
    `They are wearing ${outfitByVibe[traits.vibe]}.`,
    "Keep the same recognizable fictional person, face, hairstyle, makeup, outfit, and color palette in every image.",
    "High-end authentic creator photography, natural skin texture, flattering soft studio daylight, refined editorial art direction, sharp focus, beautifully composed, photorealistic.",
    "No text, no typography, no logos, no watermark, no borders, no collage, anatomically natural hands and face.",
  ].join(" ");
  const additionalDirection = extraDetails.trim();

  return {
    portrait: [
      description,
      "Create a chest-up portrait photograph with the face clearly visible and centered, warm relaxed expression, shoulders visible, clean softly colored studio background. Portrait image only.",
      additionalDirection,
    ]
      .filter(Boolean)
      .join(" "),
    fullBody: [
      description,
      "Create a full-length head-to-toe fashion photograph of this same individual, standing naturally with the entire body and both feet visible, relaxed confident pose, clean softly colored studio background. Full body image only.",
      additionalDirection,
    ]
      .filter(Boolean)
      .join(" "),
    combined: `${description}${additionalDirection ? ` ${additionalDirection}` : ""}`,
  };
}
