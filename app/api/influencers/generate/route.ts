import { NextResponse, type NextRequest } from "next/server";
import { isInfluencerTraits } from "@/lib/influencers/options";
import { buildInfluencerPrompts } from "@/lib/influencers/prompt";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const POLLINATIONS_IMAGE_URL = "https://gen.pollinations.ai/image";
const POLLINATIONS_MODEL =
  process.env.POLLINATIONS_IMAGE_MODEL?.trim() || "tongyi-mai/z-image-turbo";

class PollinationsApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PollinationsApiError";
  }
}

type GenerationRequest = {
  name?: unknown;
  traits?: unknown;
  extraDetails?: unknown;
};

async function generateImage(
  prompt: string,
  width: number,
  height: number,
  seed: number,
  pollinationsApiKey: string,
) {
  const url = new URL(`${POLLINATIONS_IMAGE_URL}/${encodeURIComponent(prompt)}`);
  url.searchParams.set("model", POLLINATIONS_MODEL);
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("seed", String(seed));
  url.searchParams.set("nologo", "true");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${pollinationsApiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(150_000),
  });

  if (!response.ok) {
    const responseBody = (await response.text()).trim();
    let providerMessage: string | undefined;
    let providerCode: string | undefined;

    try {
      const parsed: unknown = JSON.parse(responseBody);

      if (typeof parsed === "object" && parsed !== null) {
        const error = "error" in parsed ? parsed.error : undefined;

        if (typeof error === "object" && error !== null) {
          providerMessage =
            "message" in error && typeof error.message === "string"
              ? error.message.slice(0, 300)
              : undefined;
          providerCode =
            "code" in error && typeof error.code === "string"
              ? error.code
              : undefined;
        }
      }
    } catch {
      providerMessage = responseBody.slice(0, 300) || undefined;
    }

    if (response.status === 403 && providerCode === "FORBIDDEN") {
      throw new PollinationsApiError(
        response.status,
        `Pollinations denied this key access to the "${POLLINATIONS_MODEL}" image model. This is a Pollinations key/account permission issue, not a Postly credit issue. Use a server-side secret key (sk_*) with image-model access. If you already use one, confirm the model is enabled for your Pollinations account or contact Pollinations support. Your Postly credits were refunded.`,
        providerCode,
      );
    }

    throw new PollinationsApiError(
      response.status,
      providerMessage
        ? `Pollinations returned HTTP ${response.status}: ${providerMessage}`
        : `Pollinations returned HTTP ${response.status}.`,
      providerCode,
    );
  }

  const contentType = response.headers.get("content-type")?.split(";")[0];

  if (!contentType || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    const detail = (await response.text()).trim().slice(0, 300);
    throw new Error(
      detail
        ? `Pollinations did not return a supported image: ${detail}`
        : "Pollinations did not return a supported image.",
    );
  }

  const contentLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    throw new Error("The generated image is larger than 10 MB.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("The generated image is empty or larger than 10 MB.");
  }

  return { bytes, contentType };
}

export async function POST(request: NextRequest) {
  const pollinationsApiKey = process.env.POLLINATIONS_API_KEY;

  if (!pollinationsApiKey) {
    return NextResponse.json(
      {
        error:
          "Image generation needs a Pollinations API key. Add POLLINATIONS_API_KEY to your server environment and restart the app. No credits were used.",
      },
      { status: 503 },
    );
  }

  if (!pollinationsApiKey.startsWith("sk_")) {
    return NextResponse.json(
      {
        error:
          "POLLINATIONS_API_KEY must contain a Pollinations server-side secret key (sk_*). Put the key in that variable, not POLLINATIONS_IMAGE_MODEL. No credits were used.",
      },
      { status: 503 },
    );
  }

  if (/^(?:sk|pk)_/.test(POLLINATIONS_MODEL)) {
    return NextResponse.json(
      {
        error:
          "POLLINATIONS_IMAGE_MODEL must contain a Pollinations image model ID, not an API key. Put the server-side key in POLLINATIONS_API_KEY and set the model to tongyi-mai/z-image-turbo (or another image model ID). No credits were used.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to create an influencer." }, { status: 401 });
  }

  let body: GenerationRequest;

  try {
    const requestText = await request.text();

    if (requestText.length > 12_000) {
      return NextResponse.json({ error: "The request is too large." }, { status: 413 });
    }

    body = JSON.parse(requestText) as GenerationRequest;
  } catch {
    return NextResponse.json({ error: "Please submit valid creator details." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const extraDetails =
    typeof body.extraDetails === "string" ? body.extraDetails.trim() : "";

  if (name.length < 1 || name.length > 60) {
    return NextResponse.json(
      { error: "Enter an influencer name between 1 and 60 characters." },
      { status: 400 },
    );
  }

  if (extraDetails.length > 500) {
    return NextResponse.json(
      { error: "Additional prompt details must be 500 characters or fewer." },
      { status: 400 },
    );
  }

  if (!isInfluencerTraits(body.traits)) {
    return NextResponse.json(
      { error: "Choose a valid option for each influencer attribute." },
      { status: 400 },
    );
  }

  const prompts = buildInfluencerPrompts(name, body.traits, extraDetails);
  try {
    const seed = Math.floor(Math.random() * 2_147_483_647);
    const images = await Promise.all([
      generateImage(prompts.portrait, 768, 1024, seed, pollinationsApiKey),
      generateImage(prompts.fullBody, 768, 1152, seed, pollinationsApiKey),
    ]);
    return NextResponse.json({
      preview: {
        name,
        traits: body.traits,
        extraDetails,
        portraitDataUrl: `data:${images[0].contentType};base64,${Buffer.from(images[0].bytes).toString("base64")}`,
        fullBodyDataUrl: `data:${images[1].contentType};base64,${Buffer.from(images[1].bytes).toString("base64")}`,
      },
    });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown influencer generation error.";
    const pollinationsOutOfCredits =
      error instanceof PollinationsApiError &&
      (error.status === 402 ||
        /not enough (pollen|credits)|insufficient (pollen|credits|balance)/i.test(reason));
    const pollinationsModelForbidden =
      error instanceof PollinationsApiError &&
      error.status === 403 &&
      error.code === "FORBIDDEN";

    console.error(
      pollinationsOutOfCredits
        ? "Pollinations API account has insufficient Pollen."
        : pollinationsModelForbidden
          ? "Pollinations API key is not permitted to use the configured image model."
        : "Influencer generation failed:",
      reason,
    );

    return NextResponse.json(
      {
        error: pollinationsOutOfCredits
          ? "Your Pollinations API key needs more Pollen. Add Pollen to your Pollinations account, then try again. No Postly credits were charged."
          : pollinationsModelForbidden
            ? `Pollinations denied this key access to the "${POLLINATIONS_MODEL}" image model. Use a server-side key with image-model access or contact Pollinations support. No Postly credits were charged.`
            : `The preview could not be generated. No Postly credits were charged. ${reason}`,
      },
      { status: pollinationsOutOfCredits || pollinationsModelForbidden ? 503 : 502 },
    );
  }
}
