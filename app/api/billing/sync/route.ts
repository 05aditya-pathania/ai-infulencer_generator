import Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";
import { isPaidPlan, subscriptionPlans } from "@/lib/billing/plans";
import { getAppUrl, getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

async function getPaidSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  userId: string,
  checkoutInvoiceId?: string,
) {
  const plan = subscription.metadata.plan;
  if (
    subscription.metadata.user_id !== userId ||
    !isPaidPlan(plan) ||
    subscription.status !== "active" ||
    subscription.items.data.length !== 1 ||
    subscription.items.data[0].price.unit_amount !== subscriptionPlans[plan].priceCents ||
    subscription.items.data[0].price.currency !== "usd" ||
    subscription.items.data[0].price.recurring?.interval !== "month"
  ) {
    return null;
  }

  const invoiceId = checkoutInvoiceId ?? getId(subscription.latest_invoice);
  if (!invoiceId) {
    return null;
  }
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const invoiceSubscriptionId =
    invoice.parent?.type === "subscription_details"
      ? getId(invoice.parent.subscription_details?.subscription)
      : undefined;
  if (
    invoice.status !== "paid" ||
    invoice.amount_paid < subscriptionPlans[plan].priceCents ||
    (invoice.billing_reason !== "subscription_create" &&
      invoice.billing_reason !== "subscription_cycle") ||
    getId(invoice.customer) !== getId(subscription.customer) ||
    invoiceSubscriptionId !== subscription.id
  ) {
    return null;
  }

  return { plan, invoice, customerId: getId(subscription.customer) };
}

export async function POST(request: NextRequest) {
  let appUrl: string;
  try {
    appUrl = getAppUrl();
  } catch (error) {
    console.error("Stripe payment sync is not configured:", error);
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }
  if (request.headers.get("origin") !== appUrl) {
    return NextResponse.json({ error: "The request origin could not be verified." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to sync your payment." }, { status: 401 });
  }

  let sessionId: string | undefined;
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && "sessionId" in body) {
      if (typeof body.sessionId !== "string" || !body.sessionId.startsWith("cs_")) {
        return NextResponse.json({ error: "The checkout session is invalid." }, { status: 400 });
      }
      sessionId = body.sessionId;
    }
  } catch {
    return NextResponse.json({ error: "Payment confirmation details are missing." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      console.error("Could not load profile for payment sync:", profileError?.message);
      return NextResponse.json({ error: "Your billing profile could not be loaded." }, { status: 500 });
    }

    let session: Stripe.Checkout.Session | null = null;
    if (sessionId) {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } else {
      const customers = profile.stripe_customer_id
        ? [{ id: profile.stripe_customer_id }]
        : user.email
          ? (await stripe.customers.list({ email: user.email, limit: 100 })).data
          : [];
      const sessionResults = await Promise.all(
        customers.map((customer) =>
          stripe.checkout.sessions.list({
            customer: customer.id,
            status: "complete",
            limit: 100,
          }),
        ),
      );
      session =
        sessionResults
          .flatMap((result) => result.data)
          .filter(
            (item) =>
              item.mode === "subscription" &&
              item.client_reference_id === user.id &&
              item.payment_status === "paid",
          )
          .sort((left, right) => right.created - left.created)[0] ?? null;
    }

    if (
      !session ||
      session.mode !== "subscription" ||
      session.client_reference_id !== user.id ||
      session.payment_status !== "paid"
    ) {
      return NextResponse.json(
        { error: "Stripe has not confirmed a paid subscription for this account yet. You can retry shortly." },
        { status: 409 },
      );
    }

    const subscriptionId = getId(session.subscription);
    if (!subscriptionId) {
      return NextResponse.json({ error: "Stripe did not return a valid subscription." }, { status: 502 });
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const payment = await getPaidSubscription(
      stripe,
      subscription,
      user.id,
      getId(session.invoice),
    );
    if (!payment) {
      return NextResponse.json(
        { error: "Stripe has not confirmed a paid invoice for this subscription yet. You can retry shortly." },
        { status: 409 },
      );
    }
    if (!payment.customerId) {
      return NextResponse.json({ error: "Stripe did not return a valid billing customer." }, { status: 502 });
    }

    const admin = createAdminClient();
    const { data: applied, error: applyError } = await admin.rpc(
      "apply_subscription_payment",
      {
        p_user_id: user.id,
        p_plan: payment.plan,
        p_customer_id: payment.customerId,
        p_subscription_id: subscription.id,
        p_invoice_id: payment.invoice.id,
      },
    );
    if (applyError) {
      console.error("Could not apply payment credits during payment sync:", applyError.message);
      return NextResponse.json(
        { error: "Payment was verified, but credits could not be applied. Check the Supabase billing migration and retry." },
        { status: 503 },
      );
    }
    if (!applied) {
      const { data: currentProfile, error: currentProfileError } = await admin
        .from("profiles")
        .select("stripe_customer_id, stripe_subscription_id")
        .eq("id", user.id)
        .maybeSingle();
      if (
        currentProfileError ||
        currentProfile?.stripe_customer_id !== payment.customerId ||
        currentProfile?.stripe_subscription_id !== subscription.id
      ) {
        return NextResponse.json(
          { error: "The paid subscription does not match this account's billing record. Contact support to reconcile it." },
          { status: 409 },
        );
      }
    }

    return NextResponse.json({ synced: true, creditsAdded: applied });
  } catch (error) {
    console.error("Could not sync Stripe payment:", error);
    return NextResponse.json({ error: "We couldn’t verify your payment with Stripe. Please retry shortly." }, { status: 502 });
  }
}
