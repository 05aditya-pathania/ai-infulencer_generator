import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isPostGenerationInput, platforms as availablePlatforms, type SocialPlatform } from "@/lib/posts/options";
import {
  combinePostCaption,
  createZernioDraftPost,
  getZernioSetup,
  updateZernioDraftPost,
  updateZernioScheduledPost,
} from "@/lib/zernio";
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

function isPlatformSelection(value: unknown): value is SocialPlatform[] {
  return (
    Array.isArray(value) &&
    value.length <= availablePlatforms.length &&
    value.every(
      (platform, index) =>
        typeof platform === "string" &&
        availablePlatforms.some((item) => item.id === platform) &&
        value.indexOf(platform) === index,
    )
  );
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
  if (
    !isPlatformSelection(body.platforms) ||
    saveBody.platform !== (body.platforms[0] ?? null)
  ) {
    return NextResponse.json({ error: "Choose valid social platforms for this post." }, { status: 400 });
  }
  const selectedPlatforms = body.platforms;

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

  const { data: billingProfile, error: billingProfileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  if (billingProfileError || !billingProfile) {
    console.error("Could not load the account plan before creating a post:", billingProfileError?.message);
    return NextResponse.json({ error: "Your account plan could not be verified." }, { status: 500 });
  }

  if (status === "scheduled" && billingProfile.plan === "free") {
    const { count, error: scheduledCountError } = await supabase
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "scheduled")
      .gt("scheduled_at", new Date().toISOString());
    if (scheduledCountError) {
      console.error("Could not check the free scheduled-post limit:", scheduledCountError.message);
      return NextResponse.json({ error: "We couldn’t check your scheduled-post limit." }, { status: 500 });
    }
    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { error: "The Free plan allows up to 5 scheduled posts at one time. Upgrade to Standard or Pro for unlimited scheduled posts." },
        { status: 409 },
      );
    }
  }

  if (status !== "draft" && selectedPlatforms.length === 0) {
    return NextResponse.json(
      { error: "Connect and select at least one social platform before scheduling or publishing this post." },
      { status: 400 },
    );
  }

  let zernioTargets: { platform: string; accountId: string }[] = [];
  if (status !== "draft" && selectedPlatforms.length > 0) {
    const accountPlatforms = selectedPlatforms.map((platform) =>
      platform === "x" ? "twitter" : platform,
    );
    const { data: connectedAccounts, error: accountError } = await supabase
      .from("social_accounts")
      .select("platform, zernio_account_id")
      .eq("user_id", user.id)
      .in("platform", accountPlatforms);

    if (accountError) {
      console.error("Could not verify the selected social platforms:", accountError.message);
      return NextResponse.json({ error: "We couldn’t verify the selected social account." }, { status: 500 });
    }
    const connectedPlatformSet = new Set((connectedAccounts ?? []).map((account) => account.platform));
    const missingPlatforms = selectedPlatforms.filter((platform) =>
      !connectedPlatformSet.has(platform === "x" ? "twitter" : platform),
    );
    if (missingPlatforms.length > 0) {
      const labels = missingPlatforms
        .map((platform) => availablePlatforms.find((item) => item.id === platform)?.label ?? platform)
        .join(", ");
      return NextResponse.json(
        { error: `Connect every selected platform before scheduling or publishing this post. Not connected: ${labels}.` },
        { status: 400 },
      );
    }
    if (status === "scheduled") {
      const setup = getZernioSetup();
      if (!setup.configured) {
        return NextResponse.json({ error: setup.error }, { status: 503 });
      }
      zernioTargets = (connectedAccounts ?? []).map((account) => ({
        platform: account.platform,
        accountId: account.zernio_account_id,
      }));
    }
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
  const reservation = await supabase.rpc("reserve_post_creation", { p_post_id: postId });
  if (reservation.error) {
    if (reservation.error.message.includes("INSUFFICIENT_CREDITS")) {
      return NextResponse.json(
        { error: "You need 20 credits to create a new post. Add credits or subscribe to continue." },
        { status: 402 },
      );
    }
    console.error("Could not reserve credits for the new post:", reservation.error.message);
    return NextResponse.json({ error: "We couldn’t create this post. Please try again." }, { status: 500 });
  }

  const extension = contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);
  const imagePath = `${user.id}/${postId}/image.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("social-posts")
    .upload(imagePath, imageBytes, { contentType, cacheControl: "31536000", upsert: false });

  if (uploadError) {
    console.error("Could not upload saved social post image:", uploadError.message);
    const { error: refundError } = await supabase.rpc("refund_post_creation", { p_post_id: postId });
    if (refundError) {
      console.error("Could not refund credits after a post image upload failure:", refundError.message);
    }
    return NextResponse.json({ error: "We couldn’t store the post image. Please try again." }, { status: 500 });
  }

  const { data: savedPost, error: saveError } = await supabase
    .from("social_posts")
    .insert({
      id: postId,
      user_id: user.id,
      model_id: model.id,
      model_name: model.name,
      platform: selectedPlatforms[0] ?? null,
      platforms: selectedPlatforms,
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
      status: status === "scheduled" ? "draft" : status,
      scheduled_at: null,
    })
    .select("id, status, scheduled_at")
    .single();

  if (saveError || !savedPost) {
    const { error: cleanupError } = await supabase.storage.from("social-posts").remove([imagePath]);
    if (cleanupError) {
      console.error("Could not clean up unsaved social post image:", cleanupError.message);
    }
    const { error: refundError } = await supabase.rpc("refund_post_creation", { p_post_id: postId });
    if (refundError) {
      console.error("Could not refund credits after a post save failure:", refundError.message);
    }
    console.error("Could not save social post:", saveError?.message);
    return NextResponse.json({ error: "We couldn’t save this post. Please try again." }, { status: 500 });
  }

  if (status === "scheduled" && scheduledAtIso) {
    const { data: image, error: imageError } = await supabase.storage
      .from("social-posts")
      .createSignedUrl(imagePath, 60 * 60);
    if (imageError || !image?.signedUrl) {
      console.error("Could not prepare the new post image for Zernio:", imageError?.message);
      return NextResponse.json(
        { error: "Your post and image were saved as a draft, but the image could not be prepared for Zernio." },
        { status: 500 },
      );
    }

    let zernioPostId: string;
    try {
      zernioPostId = await createZernioDraftPost(savedPost.id, {
        content: combinePostCaption(caption.trim(), hashtags),
        mediaUrl: image.signedUrl,
        targets: zernioTargets,
      });
    } catch (error) {
      console.error("Could not create the post in Zernio:", error);
      const detail = error instanceof Error ? error.message : "Please try again.";
      return NextResponse.json(
        { error: `Your post and image were saved as a draft, but Zernio could not schedule it: ${detail}` },
        { status: 502 },
      );
    }

    const { data: mappedPost, error: mappingError } = await supabase
      .from("social_posts")
      .update({ zernio_post_id: zernioPostId })
      .eq("id", savedPost.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (mappingError || !mappedPost) {
      console.error("Could not save the new Zernio post mapping:", mappingError?.message ?? "No post row was updated.");
      return NextResponse.json(
        { error: "Zernio saved the post, but Postly couldn’t link it. Apply the latest Supabase migrations and try again." },
        { status: 500 },
      );
    }

    try {
      await updateZernioScheduledPost(
        zernioPostId,
        {
          content: combinePostCaption(caption.trim(), hashtags),
          mediaUrl: image.signedUrl,
          targets: zernioTargets,
        },
        scheduledAtIso,
      );
    } catch (error) {
      console.error("Could not schedule the new post with Zernio:", error);
      const detail = error instanceof Error ? error.message : "Please try again.";
      return NextResponse.json(
        { error: `Your post and image are saved as a draft, but Zernio could not schedule it: ${detail}` },
        { status: 502 },
      );
    }

    const { data: scheduledPost, error: scheduleError } = await supabase
      .from("social_posts")
      .update({ status: "scheduled", scheduled_at: scheduledAtIso })
      .eq("id", savedPost.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (scheduleError || !scheduledPost) {
      if (scheduleError?.message.includes("FREE_SCHEDULE_LIMIT_REACHED")) {
        try {
          await updateZernioDraftPost(
            zernioPostId,
            combinePostCaption(caption.trim(), hashtags),
          );
        } catch (unscheduleError) {
          console.error("Could not undo the over-limit Zernio schedule:", unscheduleError);
        }
        return NextResponse.json(
          { error: "The Free plan allows up to 5 scheduled posts at one time. Upgrade to Standard or Pro for unlimited scheduled posts." },
          { status: 409 },
        );
      }
      console.error("Zernio scheduled the new post, but Postly could not save its schedule:", scheduleError?.message ?? "No post row was updated.");
      return NextResponse.json(
        { error: "Zernio scheduled this post, but Postly couldn’t update its local status. Reload and retry from the saved draft." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    post: {
      id: savedPost.id,
      status,
      scheduledAt: status === "scheduled" ? scheduledAtIso : savedPost.scheduled_at,
    },
  });
}