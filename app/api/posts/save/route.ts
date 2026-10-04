import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isPostGenerationInput } from "@/lib/posts/options";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_LENGTH = 15 * 1024 * 1024;
const postStatuses = ["draft", "scheduled", "ready_to_publish"] as const;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSaveStatus(value: unknown): value is (typeof postStatuses)[number] {
  return typeof value === "string" && postStatuses.some((status) => status === value);
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_LENGTH) {
    return NextResponse.json({ error: "The generated image is too large to save." }, { status: 413 });
  }

  let body: unknown;

  try {
    const requestText = await request.text();
    if (requestText.length > MAX_REQUEST_LENGTH) {
      return NextResponse.json({ error: "The generated image is too large to save." }, { status: 413 });
    }
    body = JSON.parse(requestText);
  } catch {
    return NextResponse.json({ error: "Please submit valid post details and image." }, { status: 400 });
  }

  if (!isObject(body)) {
    return NextResponse.json({ error: "Some post settings are invalid. Review the form and try again." }, { status: 400 });
  }

  const saveBody = body as JsonObject & Parameters<typeof isPostGenerationInput>[0];
  if (!isPostGenerationInput(saveBody)) {
    return NextResponse.json({ error: "Some post settings are invalid. Review the form and try again." }, { status: 400 });
  }

  const status = body.status;
  const scheduledAt = body.scheduledAt;
  const caption = body.caption;
  const hashtags = body.hashtags;
  const imageDataUrl = body.imageDataUrl;

  if (!isSaveStatus(status)) {
    return NextResponse.json({ error: "Choose a valid save or publishing option." }, { status: 400 });
  }

  if (
    typeof caption !== "string" ||
    caption.length > 600 ||
    !Array.isArray(hashtags) ||
    hashtags.length > 20 ||
    !hashtags.every((tag) => typeof tag === "string" && tag.length <= 60)
  ) {
    return NextResponse.json({ error: "The post caption or hashtags are invalid." }, { status: 400 });
  }

  let scheduledAtIso: string | null = null;
  if (status === "scheduled") {
    if (typeof scheduledAt !== "string" || !Number.isFinite(Date.parse(scheduledAt))) {
      return NextResponse.json({ error: "Choose a valid date and time for this post." }, { status: 400 });
    }
    const scheduleDate = new Date(scheduledAt);
    if (scheduleDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Choose a schedule time in the future." }, { status: 400 });
    }
    scheduledAtIso = scheduleDate.toISOString();
  }

  if (typeof imageDataUrl !== "string") {
    return NextResponse.json({ error: "Generate a post image before saving." }, { status: 400 });
  }

  const imageMatch = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageDataUrl);
  if (!imageMatch) {
    return NextResponse.json({ error: "The generated image has an unsupported format." }, { status: 400 });
  }

  const contentType = imageMatch[1] as "image/jpeg" | "image/png" | "image/webp";
  const imageBytes = Buffer.from(imageMatch[2], "base64");
  if (
    imageBytes.byteLength === 0 ||
    imageBytes.byteLength > MAX_IMAGE_BYTES ||
    imageBytes.toString("base64") !== imageMatch[2]
  ) {
    return NextResponse.json({ error: "The generated image is empty, invalid, or larger than 10 MB." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in before saving this post." }, { status: 401 });
  }

  const { data: model, error: modelError } = await supabase
    .from("influencer_models")
    .select("id, name")
    .eq("id", saveBody.modelId)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .maybeSingle();

  if (modelError || !model) {
    return NextResponse.json({ error: "We couldn’t verify the selected creator. Refresh and try again." }, { status: 400 });
  }

  const postId = randomUUID();
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);
  const imagePath = `${user.id}/${postId}/image.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("social-posts")
    .upload(imagePath, imageBytes, { contentType, cacheControl: "31536000", upsert: false });

  if (uploadError) {
    console.error("Could not upload saved social post image:", uploadError.message);
    return NextResponse.json({ error: "We couldn’t store the post image. Please try again." }, { status: 500 });
  }

  const { data: savedPost, error: saveError } = await supabase
    .from("social_posts")
    .insert({
      id: postId,
      user_id: user.id,
      model_id: model.id,
      model_name: model.name,
      platform: saveBody.platform,
      format: saveBody.format,
      campaign: saveBody.campaign.trim(),
      product: saveBody.product.trim(),
      goal: saveBody.goal,
      scene: saveBody.scene,
      tone: saveBody.tone,
      call_to_action: saveBody.callToAction,
      language: saveBody.language,
      hashtag_count: saveBody.hashtagCount,
      caption: caption.trim(),
      hashtags,
      image_path: imagePath,
      status,
      scheduled_at: scheduledAtIso,
    })
    .select("id, status, scheduled_at")
    .single();

  if (saveError || !savedPost) {
    const { error: cleanupError } = await supabase.storage.from("social-posts").remove([imagePath]);
    if (cleanupError) {
      console.error("Could not clean up unsaved social post image:", cleanupError.message);
    }
    console.error("Could not save social post:", saveError?.message);
    return NextResponse.json({ error: "We couldn’t save this post. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    post: {
      id: savedPost.id,
      status: savedPost.status,
      scheduledAt: savedPost.scheduled_at,
    },
  });
}