import { NextResponse, type NextRequest } from "next/server";
import { isInfluencerTraits } from "@/lib/influencers/options";
import { buildInfluencerPrompts } from "@/lib/influencers/prompt";
import { createClient } from "@/lib/supabase/server";

const STORAGE_BUCKET = "influencer-models";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 28 * 1024 * 1024;

type SaveRequest = {
  name?: unknown;
  traits?: unknown;
  extraDetails?: unknown;
  portraitDataUrl?: unknown;
  fullBodyDataUrl?: unknown;
};

type ImageUpload = {
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpeg" | "png" | "webp";
};

function parseImageDataUrl(value: unknown, label: string): ImageUpload {
  if (typeof value !== "string") {
    throw new Error(`The ${label} image is missing. Generate a preview and try again.`);
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);

  if (!match) {
    throw new Error(`The ${label} image is invalid. Generate a new preview and try again.`);
  }

  const contentType = match[1] as ImageUpload["contentType"];
  const base64 = match[2];
  const bytes = Buffer.from(base64, "base64");

  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_IMAGE_BYTES ||
    bytes.toString("base64") !== base64
  ) {
    throw new Error(`The ${label} image is empty, invalid, or larger than 10 MB.`);
  }

  const extension = contentType === "image/jpeg" ? "jpeg" : contentType.slice("image/".length);

  return {
    bytes,
    contentType,
    extension: extension as ImageUpload["extension"],
  };
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "The generated images are too large to save." }, { status: 413 });
  }

  let body: SaveRequest;

  try {
    const requestText = await request.text();

    if (requestText.length > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "The generated images are too large to save." }, { status: 413 });
    }

    body = JSON.parse(requestText) as SaveRequest;
  } catch {
    return NextResponse.json({ error: "Please submit valid model details and images." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const extraDetails = typeof body.extraDetails === "string" ? body.extraDetails.trim() : "";

  if (name.length < 1 || name.length > 60) {
    return NextResponse.json(
      { error: "Enter an influencer name between 1 and 60 characters." },
      { status: 400 },
    );
  }

  if (extraDetails.length > 500 || !isInfluencerTraits(body.traits)) {
    return NextResponse.json(
      { error: "The model details are invalid. Update them and generate a new preview." },
      { status: 400 },
    );
  }

  let portrait: ImageUpload;
  let fullBody: ImageUpload;

  try {
    portrait = parseImageDataUrl(body.portraitDataUrl, "portrait");
    fullBody = parseImageDataUrl(body.fullBodyDataUrl, "full-body");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The generated images are invalid." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to save this influencer." }, { status: 401 });
  }

  const prompts = buildInfluencerPrompts(name, body.traits, extraDetails);
  const reservation = await supabase.rpc("reserve_influencer_generation", {
    p_name: name,
    p_traits: body.traits,
    p_prompt: prompts.combined,
  });

  if (reservation.error) {
    if (reservation.error.message.includes("INSUFFICIENT_CREDITS")) {
      return NextResponse.json(
        { error: "You need 50 credits to save this model. Add credits to continue." },
        { status: 402 },
      );
    }

    console.error("Could not reserve credits for saving influencer:", reservation.error.message);
    return NextResponse.json(
      { error: "We couldn’t save this model. Please try again." },
      { status: 500 },
    );
  }

  const reservationRow = reservation.data?.[0];

  if (!reservationRow?.generation_id) {
    console.error("Credit reservation for saving did not return a generation ID.");
    return NextResponse.json(
      { error: "We couldn’t save this model. Please try again." },
      { status: 500 },
    );
  }

  const generationId = reservationRow.generation_id;
  const portraitPath = `${user.id}/${generationId}/portrait.${portrait.extension}`;
  const fullBodyPath = `${user.id}/${generationId}/full-body.${fullBody.extension}`;
  const imagePaths = [portraitPath, fullBodyPath];

  try {
    const uploads = await Promise.allSettled([
      supabase.storage.from(STORAGE_BUCKET).upload(portraitPath, portrait.bytes, {
        contentType: portrait.contentType,
        cacheControl: "31536000",
        upsert: false,
      }),
      supabase.storage.from(STORAGE_BUCKET).upload(fullBodyPath, fullBody.bytes, {
        contentType: fullBody.contentType,
        cacheControl: "31536000",
        upsert: false,
      }),
    ]);

    const failedUpload = uploads.find(
      (result) => result.status === "rejected" || result.value.error,
    );

    if (failedUpload) {
      const message =
        failedUpload.status === "rejected"
          ? failedUpload.reason instanceof Error
            ? failedUpload.reason.message
            : "Could not save the generated images."
          : failedUpload.value.error?.message ?? "Could not save the generated images.";
      throw new Error(`Could not save the generated images: ${message}`);
    }

    const signedImages = await Promise.all(
      imagePaths.map(async (path) => {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(path, 60 * 60);

        if (error || !data?.signedUrl) {
          throw new Error(error?.message ?? "Could not open the saved model images.");
        }

        return data.signedUrl;
      }),
    );

    const { error: completionError } = await supabase.rpc(
      "complete_influencer_generation",
      {
        p_generation_id: generationId,
        p_portrait_path: portraitPath,
        p_full_body_path: fullBodyPath,
      },
    );

    if (completionError) {
      throw new Error(`Could not save the influencer record: ${completionError.message}`);
    }

    return NextResponse.json({
      model: {
        id: generationId,
        name,
        portraitUrl: signedImages[0],
        fullBodyUrl: signedImages[1],
      },
      remainingCredits: reservationRow.remaining_credits,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown model save error.";
    console.error("Could not save generated influencer:", reason);

    const { error: removeError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(imagePaths);

    if (removeError) {
      console.error("Could not remove failed influencer image uploads:", removeError.message);
    }

    const { data: refundedCredits, error: refundError } = await supabase.rpc(
      "refund_influencer_generation",
      {
        p_generation_id: generationId,
        p_failure_reason: reason,
      },
    );

    if (refundError) {
      console.error("Could not refund failed influencer save:", refundError.message);
      return NextResponse.json(
        {
          error:
            "Saving failed and the credit refund needs attention. Contact support with generation ID " +
            generationId,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: `The model could not be saved. Your 50 credits have been refunded. ${reason}`,
        ...(typeof refundedCredits === "number"
          ? { remainingCredits: refundedCredits }
          : {}),
      },
      { status: 500 },
    );
  }
}
