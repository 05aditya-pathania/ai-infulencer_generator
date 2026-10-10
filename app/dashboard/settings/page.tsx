import { PaymentManagement } from "@/components/payment-management";
import { createClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/billing/plans";

type SettingsPageProps = {
  searchParams: Promise<{
    checkout?: string | string[];
    session_id?: string | string[];
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [{ checkout, session_id: sessionId }, supabase] = await Promise.all([
    searchParams,
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profileQuery = user
    ? supabase
        .from("profiles")
        .select("plan, subscription_status, stripe_customer_id, stripe_subscription_id, credits")
        .eq("id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const scheduledQuery = user
    ? supabase
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gt("scheduled_at", new Date().toISOString())
    : Promise.resolve({ count: 0, error: null });
  const [{ data: profile, error: profileError }, { count: scheduledCount }] =
    await Promise.all([profileQuery, scheduledQuery]);
  const plan: PlanId =
    profile?.plan === "standard" || profile?.plan === "pro" ? profile.plan : "free";
  const checkoutResult =
    typeof checkout === "string" && (checkout === "success" || checkout === "cancelled")
      ? checkout
      : undefined;

  return (
    <div className="dashboard-page-content settings-page">
      <section className="dashboard-welcome-copy">
        <span className="section-kicker">MAKE POSTLY YOURS</span>
        <h1>Settings</h1>
        <p>Manage your subscription, payment method, and monthly creator credits.</p>
      </section>
      {profileError && (
        <p className="payment-notice is-error" role="alert">
          Subscription details could not be loaded. Apply the latest Supabase migration and try again.
        </p>
      )}
      <PaymentManagement
        checkoutResult={checkoutResult}
        checkoutSessionId={typeof sessionId === "string" ? sessionId : undefined}
        credits={profile?.credits ?? null}
        hasStripeCustomer={Boolean(profile?.stripe_customer_id)}
        hasStripeSubscription={Boolean(profile?.stripe_subscription_id)}
        plan={plan}
        scheduledPostCount={scheduledCount ?? 0}
        subscriptionStatus={profile?.subscription_status ?? "inactive"}
      />
    </div>
  );
}
