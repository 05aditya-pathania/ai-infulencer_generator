import type {
  CallToAction,
  CaptionTone,
  PostGoal,
  PostLanguage,
} from "./options";

const captionOpeners: Record<PostLanguage, Record<CaptionTone, string>> = {
  English: {
    Playful: "A little something to make your day brighter ✨",
    Confident: "Consider this your sign to make the next move.",
    Minimal: "The details make the difference.",
    Warm: "Made with care, and ready to find its way to you.",
    Editorial: "A study in thoughtful details and everyday ease.",
  },
  Spanish: {
    Playful: "Un pequeño detalle para alegrarte el día ✨",
    Confident: "Esta es tu señal para dar el siguiente paso.",
    Minimal: "Los detalles marcan la diferencia.",
    Warm: "Hecho con cariño y listo para acompañarte.",
    Editorial: "Detalles cuidados para disfrutar cada día.",
  },
  French: {
    Playful: "Une petite touche pour illuminer votre journée ✨",
    Confident: "C’est le moment de passer à l’action.",
    Minimal: "Les détails font toute la différence.",
    Warm: "Imaginé avec soin, prêt à vous accompagner.",
    Editorial: "Des détails choisis pour le quotidien.",
  },
  Hindi: {
    Playful: "आपके दिन को खास बनाने के लिए एक छोटी सी बात ✨",
    Confident: "यह अगला कदम उठाने का आपका संकेत है।",
    Minimal: "बारीकियाँ ही फर्क बनाती हैं।",
    Warm: "प्यार से बनाया गया, आपके लिए तैयार।",
    Editorial: "रोज़मर्रा के लिए सोच-समझकर चुनी गई खूबियाँ।",
  },
};

const goalLines: Record<PostLanguage, Record<PostGoal, string>> = {
  English: {
    "Product launch": "Meet {product} — a fresh favorite worth knowing.",
    "Drive sales": "Make room for {product} in your everyday.",
    "Grow awareness": "Get to know {product} and what makes it different.",
    Engagement: "What do you think about {product}? Tell us below.",
    Educate: "A closer look at {product}, and why the details matter.",
  },
  Spanish: {
    "Product launch": "Conoce {product}, una novedad que te encantará.",
    "Drive sales": "Haz espacio para {product} en tu día a día.",
    "Grow awareness": "Descubre {product} y lo que lo hace especial.",
    Engagement: "¿Qué te parece {product}? Cuéntanos abajo.",
    Educate: "Descubre {product} y cada detalle que lo hace especial.",
  },
  French: {
    "Product launch": "Découvrez {product}, une nouveauté à ne pas manquer.",
    "Drive sales": "Faites une place à {product} dans votre quotidien.",
    "Grow awareness": "Découvrez {product} et ce qui le rend unique.",
    Engagement: "Que pensez-vous de {product} ? Dites-le-nous.",
    Educate: "Découvrez {product} et les détails qui font la différence.",
  },
  Hindi: {
    "Product launch": "{product} से मिलिए — एक नई पसंद जो खास है।",
    "Drive sales": "अपने रोज़मर्रा में {product} को जगह दें।",
    "Grow awareness": "{product} और इसकी खासियतों को जानें।",
    Engagement: "{product} के बारे में आपकी क्या राय है? बताइए।",
    Educate: "{product} की खासियतों और बारीकियों को जानें।",
  },
};

const ctaLines: Record<PostLanguage, Record<CallToAction, string>> = {
  English: {
    "Shop now": "Shop now",
    "Discover more": "Discover more",
    "Save this post": "Save this post for later",
    "Tell us below": "Tell us in the comments",
    "Learn more": "Learn more",
    "No CTA": "",
  },
  Spanish: {
    "Shop now": "Compra ahora",
    "Discover more": "Descubre más",
    "Save this post": "Guarda esta publicación",
    "Tell us below": "Cuéntanos en los comentarios",
    "Learn more": "Descubre más",
    "No CTA": "",
  },
  French: {
    "Shop now": "Acheter maintenant",
    "Discover more": "Découvrir",
    "Save this post": "Enregistrer pour plus tard",
    "Tell us below": "Dites-nous en commentaire",
    "Learn more": "En savoir plus",
    "No CTA": "",
  },
  Hindi: {
    "Shop now": "अभी खरीदें",
    "Discover more": "और जानें",
    "Save this post": "बाद के लिए सेव करें",
    "Tell us below": "कमेंट में बताएं",
    "Learn more": "और जानकारी लें",
    "No CTA": "",
  },
};

export function buildPostCaption({
  campaign,
  product,
  goal,
  tone,
  callToAction,
  language,
}: {
  campaign: string;
  product: string;
  goal: PostGoal;
  tone: CaptionTone;
  callToAction: CallToAction;
  language: PostLanguage;
}) {
  const productName = product.trim() || campaign.trim() || "your next favorite";
  const goalLine = goalLines[language][goal].replace("{product}", productName);
  const ctaLine = ctaLines[language][callToAction];

  return [
    captionOpeners[language][tone],
    goalLine,
    campaign.trim() && campaign.trim() !== productName ? `#${campaign.trim().replace(/\s+/g, "")}` : "",
    ctaLine,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const hashtagByTopic: Record<string, string[]> = {
  product: ["#NewFind", "#MadeForYou", "#EverydayStyle", "#InTheDetails"],
  launch: ["#NewDrop", "#JustLaunched", "#MeetTheNew", "#LaunchDay"],
  beauty: ["#BeautyEdit", "#GlowRoutine", "#BeautyFinds", "#FeelGoodSkin"],
  fashion: ["#StyleInspo", "#OutfitDetails", "#WearItYourWay", "#StyleDaily"],
  wellness: ["#DailyRitual", "#WellnessJourney", "#SlowLiving", "#FeelGood"],
  default: ["#NewFavorite", "#DailyInspiration", "#MadeForToday", "#DiscoverMore"],
};

export function buildHashtags(product: string, campaign: string, count: number) {
  if (count === 0) {
    return [];
  }

  const text = `${product} ${campaign}`.toLowerCase();
  const topic = Object.keys(hashtagByTopic).find(
    (candidate) => candidate !== "default" && text.includes(candidate),
  );
  const generated = topic ? hashtagByTopic[topic] : hashtagByTopic.default;
  const sanitized = [product, campaign]
    .filter(Boolean)
    .map((value) => `#${value.replace(/[^a-z0-9]/gi, "")}`)
    .filter((tag) => tag.length > 1);
  const additional = [
    "#BrandStory",
    "#CreatorMade",
    "#DailyFinds",
    "#FreshPerspective",
    "#InspirationDaily",
    "#YourNextFavorite",
    "#CreativeLiving",
    "#TheGoodEdit",
    "#LoveTheDetails",
    "#MadeToInspire",
    "#StyleAndSubstance",
    "#DiscoverYourStyle",
    "#CampaignMoments",
    "#CreativeCommunity",
  ];

  return [...new Set([...sanitized, ...generated, ...additional])].slice(0, count);
}
