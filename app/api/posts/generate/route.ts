import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPostGenerationInput, postFormats } from "@/lib/posts/options";

export const maxDuration = 300;

const LUMA_GENERATIONS_URL = "https://agents.lumalabs.ai/v1/generations";
const MAX_REQUEST_LENGTH = 9_000_000;
const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseError(value: unknown) {
  if (!isObject(value)) {
    return "Luma returned an unexpected response.";
  }

  const detail =
    typeof value.detail === "string"
      ? value.detail
      : typeof value.message === "string"
        ? value.message
        : typeof value.error === "string"
          ? value.error
          : undefined;

  return detail?.slice(0, 400) ?? "Luma returned an unexpected response.";
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

  return { data: base64, media_type: mediaType };
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

async function lumaRequest(url: string, key: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const responseText = await response.text();
  let result: unknown;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      response.ok
        ? "Luma returned invalid JSON."
        : `Luma returned HTTP ${response.status}: ${responseText.slice(0, 300)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Luma returned HTTP ${response.status}: ${responseError(result)}`);
  }

  if (!isObject(result)) {
    throw new Error("Luma returned an unexpected response.");
  }

  return result;
}

async function generateWithLuma(prompt: string, aspectRatio: string, references: JsonObject[]) {
  const key = process.env.LUMA_AGENTS_API_KEY;

  if (!key) {
    throw new Error(
      "Luma image generation is not configured. Set LUMA_AGENTS_API_KEY in the server environment.",
    );
  }

  const created = await lumaRequest(LUMA_GENERATIONS_URL, key, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "uni-1",
      type: "image",
      prompt,
      aspect_ratio: aspectRatio,
      output_format: "jpeg",
      image_ref: references,
    }),
  });

  const generationId = typeof created.id === "string" ? created.id : undefined;
  const state = typeof created.state === "string" ? created.state : undefined;

  if (!generationId) {
    throw new Error("Luma did not return a generation ID.");
  }

  let result = created;
  const deadline = Date.now() + 240_000;

  while (state !== "completed" && state !== "failed" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    result = await lumaRequest(
      `${LUMA_GENERATIONS_URL}/${encodeURIComponent(generationId)}`,
      key,
    );
    if (result.state === "completed" || result.state === "failed") {
      break;
    }
  }

  if (result.state === "failed") {
    const reason =
      typeof result.failure_reason === "string"
        ? result.failure_reason.slice(0, 300)
        : "Luma could not complete this image.";
    throw new Error(`Luma image generation failed: ${reason}`);
  }

  if (result.state !== "completed") {
    throw new Error("Luma image generation timed out. Please try again.");
  }

  const output = Array.isArray(result.output) ? result.output[0] : undefined;
  const imageUrl =
    isObject(output) && typeof output.url === "string" ? output.url : undefined;

  if (!imageUrl || !imageUrl.startsWith("https://")) {
    throw new Error("Luma completed generation without a valid image URL.");
  }

  return imageUrl;
}

export async function POST(request: NextRequest) {
  if (!process.env.LUMA_AGENTS_API_KEY) {
    return NextResponse.json(
      { error: "Luma image generation is not configured. Set LUMA_AGENTS_API_KEY on the server." },
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

  let references: JsonObject[];

  try {
    references = body.references.map(parseReferenceDataUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "A reference image is invalid." },
      { status: 400 },
    );
  }

  references.unshift({ url: modelImage.signedUrl });
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
    const imageUrl = await generateWithLuma(prompt, postFormat?.ratio ?? "1:1", references);
    return NextResponse.json({
      imageUrl,
      modelName: model.name,
      aspectRatio: postFormat?.ratio ?? "1:1",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Luma image-generation error.";
    console.error("Could not generate post image with Luma:", reason);
    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
