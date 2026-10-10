import { NextResponse, type NextRequest } from "next/server";
import { isActiveSubscription, isPaidPlan, subscriptionPlans } from "@/lib/billing/plans";
import { getAppUrl, getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let appUrl: string;
  try {
    appUrl = getAppUrl();
  } catch (error) {
    console.error("Stripe checkout is not configured:", error);
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  if (request.headers.get("origin") !== appUrl) {
    return NextResponse.json({ error: "The request origin could not be verified." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a subscription plan to continue." }, { status: 400 });
  }
  const planId =
    typeof body === "object" && body !== null && "plan" in body ? body.plan : null;
  if (!isPaidPlan(planId)) {
    return NextResponse.json({ error: "That subscription plan is not available." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in before choosing a plan." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan, subscription_status, stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("Could not load profile for Stripe checkout:", profileError?.message);
    return NextResponse.json({ error: "Your account details could not be loaded." }, { status: 500 });
  }
  if (isActiveSubscription(profile.subscription_status)) {
    return NextResponse.json(
      { error: "You already have an active subscription. Use Manage payment to update billing or cancel before choosing another plan." },
      { status: 409 },
    );
  }
  if (profile.stripe_subscription_id !== null) {
    return NextResponse.json(
      { error: "Your subscription change is still syncing with Stripe. Refresh Settings in a moment before starting another checkout." },
      { status: 409 },
    );
  }
  if (planId === "standard") {
    const { count, error: accountCountError } = await supabase
      .from("social_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (accountCountError) {
      console.error("Could not check the Standard plan account limit:", accountCountError.message);
      return NextResponse.json({ error: "We couldn’t check your connected account limit." }, { status: 500 });
    }
    if ((count ?? 0) > subscriptionPlans.standard.maxSocialAccounts) {
      return NextResponse.json(
        { error: "Standard allows up to 5 connected social accounts. Disconnect accounts until you have 5 or fewer, or choose Pro." },
        { status: 409 },
      );
    }
  }

  try {
    const stripe = getStripe();
    const plan = subscriptionPlans[planId];
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: plan.priceCents,
            recurring: { interval: "month" },
            product_data: { name: `Postly ${plan.name}` },
          },
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      customer: profile.stripe_customer_id ?? undefined,
      customer_email: profile.stripe_customer_id ? undefined : user.email,
      metadata: { user_id: user.id, plan: planId },
      subscription_data: { metadata: { user_id: user.id, plan: planId } },
      success_url: `${appUrl}/dashboard/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/settings?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout link. Try again." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not create Stripe Checkout session:", error);
    return NextResponse.json({ error: "We couldn’t start secure checkout. Please try again." }, { status: 502 });
  }
}
