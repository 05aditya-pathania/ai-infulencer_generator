"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { socialPlatforms } from "@/lib/accounts/platforms";

type SocialAccount =
  Database["public"]["Tables"]["social_accounts"]["Row"];

type AccountConnectionsProps = {
  accounts: SocialAccount[];
  connectionNotice: string | null;
  databaseReady: boolean;
  setupError: string | null;
  maxAccounts: number | null;
};

async function getResponseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as
    | { error?: unknown }
    | null;
  return typeof body?.error === "string" ? body.error : fallback;
}

function getSafeProfileUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function AccountConnections({
  accounts,
  connectionNotice,
  databaseReady,
  setupError,
  maxAccounts,
}: AccountConnectionsProps) {
  const router = useRouter();
  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);
  const [pendingAccount, setPendingAccount] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function connect(platform: string) {
    setPendingPlatform(platform);
    setActionError(null);
    try {
      const response = await fetch("/api/accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      if (!response.ok) {
        setActionError(
          await getResponseError(response, "We couldn’t start that connection."),
        );
        setPendingPlatform(null);
        return;
      }
      const body = (await response.json()) as { authUrl?: unknown };
      if (typeof body.authUrl !== "string") {
        setActionError("Zernio did not return an authorization link. Please try again.");
        setPendingPlatform(null);
        return;
      }
      window.location.assign(body.authUrl);
    } catch {
      setActionError("We couldn’t reach the connection service. Please try again.");
      setPendingPlatform(null);
    }
  }

  async function disconnect(account: SocialAccount) {
    setPendingAccount(account.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setActionError(
          await getResponseError(response, "We couldn’t disconnect this account."),
        );
        setPendingAccount(null);
        return;
      }
      router.refresh();
      setPendingAccount(null);
    } catch {
      setActionError("We couldn’t reach the connection service. Please try again.");
      setPendingAccount(null);
    }
  }

  return (
    <div className="accounts-content">
      {connectionNotice && (
        <p
          className={`accounts-notice${connectionNotice.startsWith("We couldn’t") ? " is-error" : ""}`}
          role="status"
        >
          {connectionNotice}
        </p>
      )}

      {setupError && (
        <div className="accounts-setup-notice" role="status">
          <strong>Account connections need setup</strong>
          <p>
            Add the required server-side configuration (<code>{setupError}</code>) to
            your <code>.env.local</code> or deployment environment, then restart or
            redeploy Postly.
          </p>
        </div>
      )}

      {!databaseReady && (
        <div className="accounts-setup-notice is-error" role="alert">
          <strong>Your account storage is not ready</strong>
          <p>
            Apply the latest SQL migration in <code>supabase/migrations</code> to
            create the social account tables and try again.
          </p>
        </div>
      )}

      {actionError && (
        <p className="accounts-notice is-error" role="alert">
          {actionError}
        </p>
      )}

      <section aria-labelledby="accounts-connect-heading" className="accounts-panel">
        <div className="accounts-panel-heading">
          <div>
            <span className="dashboard-panel-eyebrow">CONNECT A CHANNEL</span>
            <h2 id="accounts-connect-heading">Choose a social platform</h2>
          </div>
          <span className="accounts-secure-label"><span /> Secure connection</span>
        </div>
        <p className="accounts-panel-intro">
          You’ll authorize Postly through Zernio and the platform’s official sign-in.
          Postly never asks for or stores your social password.
        </p>
        <p className="accounts-panel-intro">
          If a provider sign-in button does nothing, open Postly in Chrome or Edge
          instead of an embedded browser such as VS Code’s Simple Browser. Embedded
          browsers can block Google sign-in windows.
        </p>
        <p className="accounts-panel-intro">
          You can connect more than one account for the same platform. Choose
          “Add another” to authorize an additional profile.
        </p>
        <div className="accounts-platform-grid">
          {socialPlatforms.map((platform) => {
            const connectedCount = accounts.filter(
              (account) => account.platform === platform.id,
            ).length;

            return (
              <article className="accounts-platform-card" key={platform.id}>
                <span
                  aria-hidden="true"
                  className={`accounts-platform-icon platform-${platform.id}`}
                >
                  {platform.icon}
                </span>
                <div className="accounts-platform-copy">
                  <strong>{platform.label}</strong>
                  <span>
                    {connectedCount > 0
                      ? `${connectedCount} connected`
                      : "Connect a profile"}
                  </span>
                </div>
                <button
                  className="button button-dark accounts-connect-button"
                  disabled={
                    pendingPlatform !== null ||
                    pendingAccount !== null ||
                    (maxAccounts !== null && accounts.length >= maxAccounts)
                  }
                  onClick={() => void connect(platform.id)}
                  type="button"
                >
                  {pendingPlatform === platform.id
                    ? "Opening…"
                    : maxAccounts !== null && accounts.length >= maxAccounts
                      ? "Limit reached"
                    : connectedCount > 0
                      ? "Add another"
                      : "Connect"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="accounts-connected-heading" className="accounts-panel accounts-connected-panel">
        <div className="accounts-panel-heading">
          <div>
            <span className="dashboard-panel-eyebrow">YOUR CONNECTED CHANNELS</span>
            <h2 id="accounts-connected-heading">Connected accounts</h2>
          </div>
          <span className="accounts-total">{accounts.length} connected</span>
        </div>
        {accounts.length === 0 ? (
          <div className="accounts-empty-state">
            <span aria-hidden="true">◎</span>
            <strong>Your social accounts will appear here</strong>
            <p>Connect one of the platforms above to get started.</p>
          </div>
        ) : (
          <ul className="accounts-connected-list">
            {accounts.map((account) => {
              const platform = socialPlatforms.find(
                (item) => item.id === account.platform,
              );
              const profileName =
                account.display_name || account.username || platform?.label || "Social account";
              const profileUrl = getSafeProfileUrl(account.profile_url);

              return (
                <li className="accounts-connected-item" key={account.id}>
                  <span
                    aria-hidden="true"
                    className={`accounts-platform-icon platform-${account.platform}`}
                  >
                    {platform?.icon ?? "◎"}
                  </span>
                  <span className="accounts-connected-copy">
                    <strong>{profileName}</strong>
                    <small>
                      {platform?.label ?? account.platform}
                      {account.username && account.display_name
                        ? ` · ${account.username}`
                        : ""}
                    </small>
                  </span>
                  {profileUrl && (
                    <a
                      aria-label={`View ${profileName} profile`}
                      className="accounts-profile-link"
                      href={profileUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View profile ↗
                    </a>
                  )}
                  <button
                    className="accounts-disconnect-button"
                    disabled={pendingAccount !== null || pendingPlatform !== null}
                    onClick={() => void disconnect(account)}
                    type="button"
                  >
                    {pendingAccount === account.id ? "Disconnecting…" : "Disconnect"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
