import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DashboardChrome } from "@/components/dashboard-chrome";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();

  if (!getSupabaseConfig()) {
    redirect("/auth?mode=signin");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth?mode=signin");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, email, credits")
    .eq("id", user.id)
    .maybeSingle();
  const { count: connectedAccountsCount, error: accountsError } = await supabase
    .from("social_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const metadataName =
    user.user_metadata.display_name ??
    user.user_metadata.full_name ??
    user.user_metadata.name ??
    user.user_metadata.user_name;
  const displayName =
    profile?.display_name ??
    (typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : "Creator");

  return (
    <DashboardChrome
      displayName={displayName}
      email={profile?.email ?? user.email ?? ""}
      credits={profile?.credits ?? null}
      profileError={Boolean(profileError)}
      connectedAccountsCount={
        accountsError ? null : (connectedAccountsCount ?? 0)
      }
    >
      {children}
    </DashboardChrome>
  );
}
