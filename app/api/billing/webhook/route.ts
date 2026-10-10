import Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";
import { isPaidPlan, subscriptionPlans } from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function matchesPaidPlan(subscription: Stripe.Subscription, plan: "standard" | "pro") {
  const items = subscription.items.data;
  return (
    items.length === 1 &&
    items[0].price.unit_amount === subscriptionPlans[plan].priceCents &&
    items[0].price.currency === "usd" &&
    items[0].price.recurring?.interval === "month"
  );
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook signature configuration is missing." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.subscription) {
        return NextResponse.json({ received: true });
      }
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata.user_id;
      const plan = subscription.metadata.plan;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      if (
        !userId ||
        session.client_reference_id !== userId ||
        !isPaidPlan(plan) ||
        !matchesPaidPlan(subscription, plan)
      ) {
        console.warn("Ignoring a completed Checkout session without valid Postly subscription metadata.", {
          sessionId: session.id,
          subscriptionId,
        });
        return NextResponse.json({ received: true });
      }

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("stripe_customer_id, stripe_subscription_id")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) {
        console.error("Could not load the profile for the completed Checkout session:", profileError.message);
        return NextResponse.json({ error: "Subscription profile could not be loaded." }, { status: 500 });
      }
      if (
        !profile ||
        (profile.stripe_customer_id && profile.stripe_customer_id !== customerId) ||
        (profile.stripe_subscription_id && profile.stripe_subscription_id !== subscriptionId)
      ) {
        return NextResponse.json({ received: true });
      }

      const entitled = subscription.status === "active" || subscription.status === "trialing";
      const { error } = await admin
        .from("profiles")
        .update({
          plan: entitled ? plan : "free",
          subscription_status: subscription.status,
          stripe_customer_id: customerId,
          stripe_subscription_id:
            subscription.status === "canceled" || subscription.status === "incomplete_expired"
              ? null
              : subscriptionId,
        })
        .eq("id", userId);
      if (error) {
        console.error("Could not save the completed Checkout subscription:", error.message);
        return NextResponse.json({ error: "Subscription profile could not be updated." }, { status: 500 });
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const subscriptionReference = invoice.parent?.subscription_details?.subscription;
      const subscriptionId =
        typeof subscriptionReference === "string"
          ? subscriptionReference
          : subscriptionReference?.id;
      if (!subscriptionId || invoice.parent?.type !== "subscription_details") {
        return NextResponse.json({ received: true });
      }

      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata.user_id;
      const plan = subscription.metadata.plan;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      if (
        !userId ||
        !isPaidPlan(plan) ||
        !matchesPaidPlan(subscription, plan) ||
        (invoice.billing_reason !== "subscription_create" &&
          invoice.billing_reason !== "subscription_cycle") ||
        invoice.amount_paid < subscriptionPlans[plan].priceCents ||
        (subscription.status !== "active" && subscription.status !== "trialing")
      ) {
        console.warn("Ignoring a paid invoice without an active, recognized Postly subscription.", {
          invoiceId: invoice.id,
          subscriptionId,
        });
        return NextResponse.json({ received: true });
      }

      const { error } = await admin.rpc("apply_subscription_payment", {
        p_user_id: userId,
        p_plan: plan,
        p_customer_id: customerId,
        p_subscription_id: subscriptionId,
        p_invoice_id: invoice.id,
      });
      if (error) {
        console.error("Could not apply subscription credits:", error.message);
        return NextResponse.json({ error: "Subscription payment could not be applied." }, { status: 500 });
      }
    } else if (
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated"
    ) {
      const eventSubscription = event.data.object;
      const subscription =
        event.type === "customer.subscription.updated"
          ? await getStripe().subscriptions.retrieve(eventSubscription.id)
          : eventSubscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const noLongerEntitled =
        event.type === "customer.subscription.deleted" ||
        (subscription.status !== "active" && subscription.status !== "trialing");

      if (noLongerEntitled) {
        const { error } = await admin
          .from("profiles")
          .update({
            plan: "free",
            subscription_status: subscription.status,
            stripe_subscription_id:
              subscription.status === "canceled" || subscription.status === "incomplete_expired"
                ? null
                : subscription.id,
          })
          .eq("stripe_subscription_id", subscription.id)
          .eq("stripe_customer_id", customerId);
        if (error) {
          console.error("Could not update the canceled subscription status:", error.message);
          return NextResponse.json({ error: "Subscription status could not be updated." }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
