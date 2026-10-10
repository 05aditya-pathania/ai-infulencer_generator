import { AccountConnections } from "@/components/account-connections";
import { getZernioSetup } from "@/lib/zernio";
import { createClient } from "@/lib/supabase/server";

type AccountsPageProps = {
    searchParams: Promise<{
      connection?: string;
      reason?: string;
      oauthError?: string;
    }>;
};

const connectionFailureMessages: Record<string, string> = {
    state:
      "We couldn’t verify the connection attempt. Confirm APP_URL matches the exact site address you opened (including https and the domain), then try again.",
    callback:
      "We couldn’t connect because the platform didn’t return the expected account details. Check its connection settings and try again.",
  profile:
      "We couldn’t match the returned account to your signed-in Postly profile. Sign out and back in, then try again.",
  database:
      "We couldn’t save the account after platform authorization. Confirm the latest Supabase social accounts migration has been applied.",
    limit:
      "The Standard plan allows up to 5 connected social accounts. Disconnect one of your accounts or upgrade to Pro in Settings.",
  service:
      "We couldn’t verify the connected account with Zernio. Check the Zernio service and server logs, then try again.",
};

function getConnectionNotice(reason?: string, oauthError?: string) {
  if (reason !== "authorization") {
      return connectionFailureMessages[reason ?? ""] ??
        "We couldn’t finish connecting that account. You can safely try again.";
  }

  const code =
      oauthError && /^[a-z0-9_.-]{1,64}$/i.test(oauthError)
        ? oauthError.toLowerCase()
        : null;

  if (code === "no_youtube_channel") {
      return "Google authorization succeeded, but this Google account has no YouTube channel available to connect. Sign in with the Google account that owns your YouTube channel, or create a YouTube channel for this account at youtube.com, then try connecting YouTube again. If you already have a channel, confirm it is available under this exact Google login.";
  }

  if (code && /access_denied|user_denied|authorization_declined/.test(code)) {
      return "The social platform denied authorization. Retry and approve the requested access. If you already approved it, check that your platform account is eligible and has permission to use the connected app.";
  }

  if (
      code &&
      /invalid_scope|unauthorized_client|invalid_client|invalid_request|redirect_uri_mismatch/.test(code)
  ) {
      return `The social platform rejected the OAuth configuration (${code}). Check the platform/Zernio app permissions and callback URL settings.`;
  }

  if (code && /server_error|temporarily_unavailable/.test(code)) {
      return `The social platform is temporarily unavailable (${code}). Wait a moment and retry.`;
  }

  return code
      ? `The social platform rejected authorization (${code}). This is an OAuth/provider error, not a Postly account-save error. Check the platform app permissions and retry.`
      : "The social platform rejected authorization. Check the platform app permissions and retry.";
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: accounts, error } = user
    ? await supabase
        .from("social_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("connected_at", { ascending: false })
    : { data: [], error: null };
  const { data: profile } = user
    ? await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle()
    : { data: null };

  const setup = getZernioSetup();
  const connectionNotice =
    params.connection === "connected"
      ? "Your social account is connected."
      : params.connection === "failed"
        ? getConnectionNotice(params.reason, params.oauthError)
        : null;

  return (
    <div className="dashboard-page-content accounts-page">
      <section className="dashboard-welcome-copy">
        <span className="section-kicker">YOUR SOCIAL CHANNELS</span>
        <h1>Social accounts</h1>
        <p>Connect your channels securely and keep your social presence together in one place.</p>
        <p className="accounts-plan-limit">
          {profile?.plan === "standard"
            ? "Standard includes up to 5 connected social accounts; Pro includes unlimited accounts."
            : profile?.plan === "pro"
              ? "Your Pro plan includes unlimited connected social accounts."
              : "Upgrade to Standard for up to 5 connected accounts or Pro for unlimited accounts."}
        </p>
      </section>
      <AccountConnections
        accounts={accounts ?? []}
        connectionNotice={connectionNotice}
        databaseReady={!error}
        maxAccounts={profile?.plan === "standard" ? 5 : null}
        setupError={setup.configured ? null : setup.error}
      />
    </div>
  );
}
