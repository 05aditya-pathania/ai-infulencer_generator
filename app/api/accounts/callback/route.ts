import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSocialPlatform,
  type SocialPlatform,
} from "@/lib/accounts/platforms";
import {
  findZernioProfile,
  getZernioAccount,
  getZernioSetup,
} from "@/lib/zernio";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type ConnectionFailureReason =
  | "authorization"
  | "state"
  | "callback"
  | "profile"
  | "database"
  | "service";

function getSafeOAuthErrorCode(params: URLSearchParams) {
  const code = params.get("error_reason") ?? params.get("error");
  if (code && /^[a-z0-9_.-]{1,64}$/i.test(code)) {
    return code.toLowerCase();
  }

  const description = params.get("error_description")?.toLowerCase() ?? "";
  const knownCode = [
    "access_denied",
    "user_denied",
    "authorization_declined",
    "invalid_scope",
    "unauthorized_client",
    "invalid_client",
    "invalid_request",
    "redirect_uri_mismatch",
    "server_error",
    "temporarily_unavailable",
  ].find((candidate) => description.includes(candidate));

  return knownCode ?? null;
}

function accountsPage(
  setup: { appUrl: string },
  result: "connected" | "failed",
  reason?: ConnectionFailureReason,
  oauthError?: string | null,
  returnToStudioPost = false,
) {
  const url = new URL(
    returnToStudioPost ? "/dashboard/studio/posts/new" : "/dashboard/accounts",
    setup.appUrl,
  );
  url.searchParams.set("connection", result);
  if (reason) {
    url.searchParams.set("reason", reason);
  }
  if (oauthError) {
    url.searchParams.set("oauthError", oauthError);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const setup = getZernioSetup();
  if (!setup.configured) {
    return NextResponse.json({ error: setup.error }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const connectedValue = params.get("connected");
  const platformValue = connectedValue ?? params.get("platform");
  if (!state) {
    return accountsPage(setup, "failed", "state");
  }
  if (!isSocialPlatform(platformValue)) {
    return accountsPage(setup, "failed", "callback");
  }
  const platform: SocialPlatform = platformValue;

  const cookieStore = await cookies();
  const cookieName = `postly_zernio_state_${platform}`;
  const expectedState = cookieStore.get(cookieName)?.value;
  cookieStore.delete(cookieName);

  if (!expectedState || expectedState !== state) {
    return accountsPage(setup, "failed", "state");
  }

  if (params.has("error")) {
    const oauthError = getSafeOAuthErrorCode(params);
    console.error("The social platform rejected OAuth authorization:", {
      code: oauthError ?? "unrecognized",
    });
    return accountsPage(setup, "failed", "authorization", oauthError);
  }
  if (connectedValue !== null && connectedValue !== platform) {
    return accountsPage(setup, "failed", "callback");
  }

  if (!getSupabaseConfig()) {
    return NextResponse.redirect(new URL("/auth?mode=signin", setup.appUrl));
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.redirect(new URL("/auth?mode=signin", setup.appUrl));
  }

  const accountId = params.get("accountId");
  const callbackProfileId = params.get("profileId");
  if (!accountId || !callbackProfileId) {
    return accountsPage(setup, "failed", "callback");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("zernio_profile_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Could not load the Postly profile for the Zernio callback:", profileError.message);
    return accountsPage(setup, "failed", "database");
  }
  if (
    !profile?.zernio_profile_id ||
    profile.zernio_profile_id !== callbackProfileId
  ) {
    console.error("The Zernio callback profile did not match the signed-in user.");
    return accountsPage(setup, "failed", "profile");
  }

  try {
    const verifiedProfileId = await findZernioProfile(user.id);
    if (verifiedProfileId !== callbackProfileId) {
      console.error("The Zernio profile ID was not owned by the signed-in Postly user.");
      return accountsPage(setup, "failed", "profile");
    }

    const account = await getZernioAccount(profile.zernio_profile_id, accountId);
    if (!account || account.platform !== platform) {
      console.error("Zernio callback account could not be verified in its profile.");
      return accountsPage(setup, "failed", "service");
    }

    const { error: insertError } = await supabase.from("social_accounts").insert({
      user_id: user.id,
      zernio_account_id: account.id,
      platform,
      username: account.username,
      display_name: account.displayName,
      profile_url: account.profileUrl,
    });

    if (insertError?.code === "23505") {
      const { data: existingAccount, error: existingError } = await supabase
        .from("social_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("zernio_account_id", account.id)
        .maybeSingle();
      if (existingError || !existingAccount) {
        console.error("Could not verify an existing Postly social account:", existingError?.message);
        return accountsPage(setup, "failed", "database");
      }
    } else if (insertError) {
      console.error("Could not save the connected social account:", insertError.message);
      return accountsPage(setup, "failed", "database");
    }

    return accountsPage(
      setup,
      "connected",
      undefined,
      undefined,
      params.get("return_to") === "studio-post",
    );
  } catch (error) {
    console.error("Could not verify the Zernio connection:", error);
    return accountsPage(setup, "failed", "service");
  }
}
