import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isSocialPlatform } from "@/lib/accounts/platforms";
import {
  getOrCreateZernioProfile,
  getZernioConnectUrl,
  getZernioSetup,
} from "@/lib/zernio";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function hasSameOrigin(request: NextRequest, appUrl: string) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(appUrl).origin;
}

export async function POST(request: NextRequest) {
  const setup = getZernioSetup();
  if (!setup.configured) {
    return NextResponse.json({ error: setup.error }, { status: 503 });
  }

  if (!hasSameOrigin(request, setup.appUrl)) {
    return NextResponse.json({ error: "The request origin could not be verified." }, { status: 403 });
  }

  if (!getSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a social platform to connect." }, { status: 400 });
  }

  const platform =
    typeof body === "object" && body !== null && "platform" in body
      ? body.platform
      : null;
  const returnToStudioPost =
    typeof body === "object" &&
    body !== null &&
    "returnTo" in body &&
    body.returnTo === "studio-post";
  if (!isSocialPlatform(platform)) {
    return NextResponse.json({ error: "That social platform is not supported." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in before connecting an account." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("zernio_profile_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("Could not load the Postly profile for Zernio:", profileError?.message);
    return NextResponse.json(
      { error: "Your account profile could not be loaded. Apply the latest Supabase migrations and try again." },
      { status: 500 },
    );
  }

  try {
    const zernioProfileId = await getOrCreateZernioProfile(user.id);
    if (zernioProfileId !== profile.zernio_profile_id) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({ zernio_profile_id: zernioProfileId })
        .eq("id", user.id)
        .select("id")
        .maybeSingle();

      if (updateError || !updatedProfile) {
        console.error("Could not save the Zernio profile mapping:", updateError?.message);
        return NextResponse.json(
          { error: "Your social connection workspace could not be saved. Please try again." },
          { status: 500 },
        );
      }
    }

    const state = randomBytes(32).toString("base64url");
    const callbackUrl = new URL("/api/accounts/callback", setup.appUrl);
    callbackUrl.searchParams.set("state", state);
    if (returnToStudioPost) {
      callbackUrl.searchParams.set("return_to", "studio-post");
    }
    if (encodeURIComponent(callbackUrl.toString()).length > 258) {
      return NextResponse.json(
        { error: "The configured app URL is too long to start an X authorization flow." },
        { status: 400 },
      );
    }

    const authUrl = await getZernioConnectUrl(
      platform,
      zernioProfileId,
      callbackUrl.toString(),
    );

    const cookieStore = await cookies();
    cookieStore.set(`postly_zernio_state_${platform}`, state, {
      httpOnly: true,
      secure: setup.secureCookies,
      sameSite: "lax",
      path: "/api/accounts/callback",
      maxAge: 10 * 60,
    });

    return NextResponse.json(
      { authUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not start a Zernio social connection:", error);
    return NextResponse.json(
      { error: "Zernio could not start this connection. Check the API key and Zernio account, then try again." },
      { status: 502 },
    );
  }
}
