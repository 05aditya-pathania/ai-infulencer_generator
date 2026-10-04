import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPostGenerationInput, postFormats } from "@/lib/posts/options";

export const maxDuration = 300;

const CLOUDFLARE_AI_URL = "https://api.cloudflare.com/client/v4/accounts";
const CLOUDFLARE_IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
const MAX_REQUEST_LENGTH = 9_000_000;
const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;
const MAX_CREATOR_IMAGE_BYTES = 10 * 1024 * 1024;

type JsonObject = Record<string, unknown>;
type ImageReference = { bytes: Uint8Array; mediaType: string };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseError(value: unknown) {
  if (!isObject(value)) {
    return "Cloudflare returned an unexpected response.";
  }

  const errors = Array.isArray(value.errors) ? value.errors : [];
  const firstError = errors.find(isObject);
  const detail = typeof firstError?.message === "string"
    ? firstError.message
    : typeof value.detail === "string"
      ? value.detail
      : typeof value.message === "string"
        ? value.message
        : typeof value.error === "string"
          ? value.error
          : undefined;

  return detail?.slice(0, 400) ?? "Cloudflare returned an unexpected response.";
}

function parseReferenceDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);

  if (!match) {
    throw new Error("One of the reference images has an unsupported format.");
  }

  const mediaType = match[1];
  const base64 = match[2];
  const bytes = Buffer.from(base64, "base64");

  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_REFERENCE_BYTES ||
    bytes.toString("base64") !== base64
  ) {
    throw new Error("Each reference image must be a valid image up to 2 MB after compression.");
  }

  return { bytes, mediaType };
}

function makePrompt(input: {
  name: string;
  vibe: string;
  campaign: string;
  product: string;
  goal: string;
  scene: string;
  format: string;
  platform: string;
}) {
  const ratio = postFormats.find((item) => item.id === input.format)?.ratio ?? "1:1";
  return [
    `Create a polished, photorealistic social media campaign image for ${input.platform}.`,
    `Feature the same fictional AI creator named ${input.name}, with a ${input.vibe} aesthetic.`,
    `Campaign: ${input.campaign || "brand storytelling"}.`,
    `Product or subject: ${input.product || "a beautiful lifestyle moment"}.`,
    `Campaign goal: ${input.goal}.`,
    `Scene direction: ${input.scene}.`,
    `Compose the artwork in a ${ratio} aspect ratio for the ${input.format} post format.`,
    "Use reference image 1 for the selected creator's identity. Use reference images 2 onward for the supplied product, color palette, styling, and scene direction.",
    "Make the product and creator the clear focal points with intentional editorial lighting and a clean composition.",
    "Do not add captions, lettering, logos, watermarks, UI, frames, or collages; the post copy is added separately.",
  ].join(" ");
}

async function generateWithCloudflare(
  prompt: string,
  accountId: string,
  token: string,
  references: ImageReference[],
) {
  const form = new FormData();
  form.set("prompt", prompt);

  for (const [index, reference] of references.entries()) {
    const imageBuffer = new ArrayBuffer(reference.bytes.byteLength);
    new Uint8Array(imageBuffer).set(reference.bytes);
    form.append(
      "image",
      new Blob([imageBuffer], { type: reference.mediaType }),
      `reference-${index + 1}`,
    );
  }

  const response = await fetch(
    `${CLOUDFLARE_AI_URL}/${encodeURIComponent(accountId)}/ai/run/${CLOUDFLARE_IMAGE_MODEL}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
    },
  );
  const result: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(
      `Cloudflare returned HTTP ${response.status}: ${responseError(result)}`,
    );
  }

  const image = isObject(result) && isObject(result.result) ? result.result.image : undefined;

  if (typeof image !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    throw new Error("Cloudflare returned an invalid image response.");
  }

  return `data:image/png;base64,${image}`;
}

export async function POST(request: NextRequest) {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
    return NextResponse.json(
      { error: "Image generation is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to generate a post." }, { status: 401 });
  }

  const length = Number(request.headers.get("content-length"));

  if (Number.isFinite(length) && length > MAX_REQUEST_LENGTH) {
    return NextResponse.json(
      { error: "Reference images are too large. Use up to 3 images under 2 MB each." },
      { status: 413 },
    );
  }

  let requestText: string;
  let body: unknown;

  try {
    requestText = await request.text();
    if (requestText.length > MAX_REQUEST_LENGTH) {
      return NextResponse.json(
        { error: "Reference images are too large. Use up to 3 images under 2 MB each." },
        { status: 413 },
      );
    }
    body = JSON.parse(requestText);
  } catch {
    return NextResponse.json({ error: "Please submit valid post details." }, { status: 400 });
  }

  if (!isPostGenerationInput(body)) {
    return NextResponse.json(
      { error: "Some post settings are invalid. Review the form and try again." },
      { status: 400 },
    );
  }

  const { data: model, error: modelError } = await supabase
    .from("influencer_models")
    .select("id, name, traits, portrait_path")
    .eq("id", body.modelId)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .maybeSingle();

  if (modelError) {
    console.error("Could not load selected post creator:", modelError.message);
    return NextResponse.json(
      { error: "We couldn’t load the selected model. Please refresh and try again." },
      { status: 500 },
    );
  }

  if (!model || !model.portrait_path) {
    return NextResponse.json(
      { error: "Choose one of your saved models before generating a post." },
      { status: 400 },
    );
  }

  const { data: modelImage, error: signedUrlError } = await supabase.storage
    .from("influencer-models")
    .createSignedUrl(model.portrait_path, 60 * 60);

  if (signedUrlError || !modelImage?.signedUrl) {
    console.error("Could not create post-generation model reference URL:", signedUrlError?.message);
    return NextResponse.json(
      { error: "We couldn’t open the selected model image. Please try again." },
      { status: 500 },
    );
  }

  let references: ImageReference[];

  try {
    references = body.references.map(parseReferenceDataUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "A reference image is invalid." },
      { status: 400 },
    );
  }

  let creatorImage: Uint8Array;

  try {
    const response = await fetch(modelImage.signedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const contentType = response.headers.get("content-type")?.split(";")[0];
    const contentLength = Number(response.headers.get("content-length"));

    if (!response.ok || !contentType || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      throw new Error("The selected creator image could not be loaded.");
    }

    if (Number.isFinite(contentLength) && contentLength > MAX_CREATOR_IMAGE_BYTES) {
      throw new Error("The selected creator image is larger than 10 MB.");
    }

    creatorImage = new Uint8Array(await response.arrayBuffer());
    if (creatorImage.byteLength === 0 || creatorImage.byteLength > MAX_CREATOR_IMAGE_BYTES) {
      throw new Error("The selected creator image is empty or larger than 10 MB.");
    }

    references.unshift({ bytes: creatorImage, mediaType: contentType });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The selected creator image could not be loaded." },
      { status: 502 },
    );
  }

  const modelTraits = isObject(model.traits) ? model.traits : {};
  const vibe = typeof modelTraits.vibe === "string" ? modelTraits.vibe : "editorial";
  const postFormat = postFormats.find((format) => format.id === body.format);
  const prompt = makePrompt({
    name: model.name,
    vibe,
    campaign: body.campaign.trim(),
    product: body.product.trim(),
    goal: body.goal,
    scene: body.scene,
    format: postFormat?.label ?? "Single",
    platform: body.platform,
  });

  try {
    const ratio = postFormat?.ratio ?? "1:1";
    const imageUrl = await generateWithCloudflare(
      `${prompt} Output aspect ratio: ${ratio}.`,
      process.env.CLOUDFLARE_ACCOUNT_ID!,
      process.env.CLOUDFLARE_API_TOKEN!,
      references,
    );
    return NextResponse.json({
      imageUrl,
      modelName: model.name,
      aspectRatio: postFormat?.ratio ?? "1:1",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Cloudflare image-generation error.";
    console.error("Could not generate post image with Cloudflare:", reason);

    if (/output has been flagged/i.test(reason)) {
      const requestId = reason.match(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/i)?.[0];
      const reference = requestId ? ` Support reference: ${requestId}` : "";
      return NextResponse.json(
        {
          error: `Cloudflare’s safety filter rejected this prompt and image combination. Try a different clearly adult creator portrait and a neutral product brief; test without optional reference photos to identify the input that triggers the block.${reference}`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
