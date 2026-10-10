"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isActiveSubscription,
  subscriptionPlans,
  type PlanId,
  type PaidPlanId,
} from "@/lib/billing/plans";

type PaymentManagementProps = {
  plan: PlanId;
  subscriptionStatus: string;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  scheduledPostCount: number;
  checkoutResult?: string;
  checkoutSessionId?: string;
  credits: number | null;
};

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as
    | { error?: unknown }
    | null;
  return typeof body?.error === "string" ? body.error : fallback;
}

export function PaymentManagement({
  plan,
  subscriptionStatus,
  hasStripeCustomer,
  hasStripeSubscription,
  scheduledPostCount,
  checkoutResult,
  checkoutSessionId,
  credits,
}: PaymentManagementProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"standard" | "pro" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "pending" | "success" | "error">(
    checkoutResult === "success" ? "pending" : "idle",
  );
  const syncStarted = useRef(false);
  const active = isActiveSubscription(subscriptionStatus) && plan !== "free";
  const freeScheduleCount = plan === "free" ? `${scheduledPostCount} / 5` : null;

  const syncPayment = useCallback(async () => {
    setSyncStatus("pending");
    setError(null);
    try {
      const response = await fetch("/api/billing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          checkoutSessionId ? { sessionId: checkoutSessionId } : {},
        ),
      });
      if (!response.ok) {
        setError(await responseError(response, "We couldn’t confirm your payment yet."));
        setSyncStatus("error");
        return;
      }
      setSyncStatus("success");
      router.refresh();
    } catch {
      setError("We couldn’t reach the billing service. Please retry shortly.");
      setSyncStatus("error");
    }
  }, [checkoutSessionId, router]);

  useEffect(() => {
    if (checkoutResult === "success" && !syncStarted.current) {
      syncStarted.current = true;
      void syncPayment();
    }
  }, [checkoutResult, syncPayment]);

  async function openBilling(path: string, action: "standard" | "pro" | "portal") {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(action === "portal" ? {} : { body: JSON.stringify({ plan: action }) }),
      });
      if (!response.ok) {
        setError(await responseError(response, "We couldn’t start billing. Please try again."));
        setPending(null);
        return;
      }
      const result = (await response.json()) as { url?: unknown };
      if (typeof result.url !== "string") {
        setError("The billing service did not return a link. Please try again.");
        setPending(null);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("We couldn’t reach the billing service. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="payment-management">
      {checkoutResult === "success" && syncStatus !== "error" && (
        <div className="payment-notice" role="status">
          {syncStatus === "success"
            ? "Payment confirmed. Your subscription credits have been applied."
            : "Confirming your payment with Stripe and adding your credits…"}
        </div>
      )}
      {checkoutResult === "success" && syncStatus === "error" && (
        <div className="payment-notice is-error" role="alert">
          <span>{error}</span>{" "}
          <button
            className="payment-sync-retry"
            onClick={() => void syncPayment()}
            type="button"
          >
            Retry payment sync
          </button>
        </div>
      )}
      {checkoutResult === "cancelled" && (
        <p className="payment-notice" role="status">Checkout was canceled. No subscription was started.</p>
      )}
      {error && checkoutResult !== "success" && (
        <p className="payment-notice is-error" role="alert">{error}</p>
      )}

      <section className="payment-current-panel">
        <div>
          <span className="dashboard-panel-eyebrow">CURRENT SUBSCRIPTION</span>
          <h2>{plan === "free" ? "Free plan" : `${plan === "standard" ? "Standard" : "Pro"} plan`}</h2>
          <p>
            {active
              ? `Subscription status: ${subscriptionStatus.replaceAll("_", " ")}.`
              : hasStripeSubscription
                ? `Subscription status: ${subscriptionStatus.replaceAll("_", " ")}. Update payment details to activate your plan.`
                : "No active paid subscription."}
            {" "}Credits available: <strong>{credits?.toLocaleString() ?? "—"}</strong>.
          </p>
        </div>
        {hasStripeCustomer && (
          <button
            className="button button-dark"
            disabled={pending !== null}
            onClick={() => void openBilling("/api/billing/portal", "portal")}
            type="button"
          >
            {pending === "portal" ? "Opening…" : "Manage payment"}
          </button>
        )}
      </section>

      {plan === "free" && (
        <p className="payment-free-limit">
          Free plan autopost limit: up to 5 scheduled posts at one time. Standard and Pro include unlimited scheduled posts.
          {freeScheduleCount && ` You currently have ${freeScheduleCount} scheduled.`}
        </p>
      )}

      <div className="payment-plan-grid">
        {(Object.keys(subscriptionPlans) as PaidPlanId[]).map((id) => {
          const item = subscriptionPlans[id];
          const isCurrent = active && plan === id;
          return (
            <article className={`payment-plan-card${id === "pro" ? " is-featured" : ""}`} key={id}>
              <span className="dashboard-panel-eyebrow">{id === "pro" ? "FOR GROWING CREATORS" : "GET STARTED"}</span>
              <h2>{item.name}</h2>
              <p className="payment-plan-price">{item.priceLabel}<span> / month</span></p>
              <ul>
                <li>{item.monthlyCredits.toLocaleString()} credits each paid month</li>
                <li>50 credits per AI influencer</li>
                <li>20 credits per new post</li>
                <li>{item.maxSocialAccounts === null ? "Unlimited connected social accounts" : `Up to ${item.maxSocialAccounts} connected social accounts`}</li>
                <li>Unlimited scheduled posts</li>
              </ul>
              <button
                className={id === "pro" ? "button button-dark" : "button button-outline"}
                disabled={pending !== null || active || hasStripeSubscription}
                onClick={() => void openBilling("/api/billing/checkout", id)}
                type="button"
              >
                {pending === id ? "Opening secure checkout…" : isCurrent ? "Current plan" : active || hasStripeSubscription ? "Manage current plan" : `Choose ${item.name}`}
              </button>
            </article>
          );
        })}
      </div>

      {(active || hasStripeSubscription) && (
        <p className="payment-manage-hint">
          {active
            ? "You already have an active subscription. Use Manage payment to update billing or cancel before choosing another plan."
            : "A subscription is still active or syncing. Use Manage payment to update its billing, or wait for cancellation to finish before choosing another plan."}
        </p>
      )}
    </div>
  );
}
