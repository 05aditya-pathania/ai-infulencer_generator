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
  const freeScheduleCount =
    plan === "free" ? `${scheduledPostCount} of 5 scheduled` : null;

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
        <div className="payment-notice payment-notice-success" role="status">
          <span className="payment-notice-icon" aria-hidden="true">✓</span>
          <span>
          {syncStatus === "success"
              ? "Payment confirmed. Your subscription credits have been applied."
              : "Confirming your payment with Stripe and adding your credits…"}
          </span>
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
        <div className="payment-current-icon" aria-hidden="true">✦</div>
        <div className="payment-current-summary">
          <div className="payment-current-eyebrow">
            <span className="dashboard-panel-eyebrow">CURRENT SUBSCRIPTION</span>
            <span className={`payment-status-pill${active ? " is-active" : ""}`}>
              <span aria-hidden="true" />
              {active
                ? "Active"
                : hasStripeSubscription
                  ? subscriptionStatus.replaceAll("_", " ")
                  : "Free"}
            </span>
          </div>
          <h2>{plan === "free" ? "Free" : plan === "standard" ? "Standard" : "Pro"}</h2>
          <p>
            {active
              ? `Your ${plan === "standard" ? "Standard" : "Pro"} plan is ready to go.`
              : hasStripeSubscription
                ? `Subscription status: ${subscriptionStatus.replaceAll("_", " ")}.`
                : "Explore a plan to get more credits and creator tools."}
          </p>
        </div>
        <div className="payment-credit-balance">
          <span>AVAILABLE CREDITS</span>
          <strong>{credits?.toLocaleString() ?? "—"}</strong>
          <small>Added after each successful payment</small>
        </div>
        {hasStripeCustomer && (
          <button
            className="button button-outline payment-manage-button"
            disabled={pending !== null}
            onClick={() => void openBilling("/api/billing/portal", "portal")}
            type="button"
          >
            {pending === "portal" ? "Opening…" : "Manage payment"}
          </button>
        )}
      </section>

      {plan === "free" && (
        <div className="payment-free-limit">
          <span className="payment-limit-icon" aria-hidden="true">↗</span>
          <p>
            <strong>Free plan scheduling</strong>
            <span>Up to 5 scheduled posts at once. Standard and Pro include unlimited scheduling.</span>
          </p>
          {freeScheduleCount && <span className="payment-schedule-count">{freeScheduleCount}</span>}
        </div>
      )}

      <div className="payment-plans-heading">
        <div>
          <span className="dashboard-panel-eyebrow">SIMPLE, CREATOR-FRIENDLY PRICING</span>
          <h2>Choose your plan</h2>
        </div>
        <p>Pick the room you need to create and grow.</p>
      </div>
      <div className="payment-plan-grid">
        {(Object.keys(subscriptionPlans) as PaidPlanId[]).map((id) => {
          const item = subscriptionPlans[id];
          const isCurrent = active && plan === id;
          return (
            <article
              className={`payment-plan-card${id === "pro" ? " is-featured" : ""}${isCurrent ? " is-current" : ""}`}
              key={id}
            >
              <div className="payment-plan-topline">
                <span className="payment-plan-icon" aria-hidden="true">{id === "pro" ? "✦" : "✳"}</span>
                {id === "pro" && <span className="payment-popular-badge">MOST POPULAR</span>}
                {isCurrent && <span className="payment-current-badge">YOUR PLAN</span>}
              </div>
              <h3>{item.name}</h3>
              <p className="payment-plan-description">
                {id === "pro" ? "For creators ready to scale their content." : "Everything you need to build a consistent rhythm."}
              </p>
              <p className="payment-plan-price">
                <strong>{item.priceLabel}</strong>
                <span>/ month</span>
              </p>
              <div className="payment-plan-credit-highlight">
                <strong>{item.monthlyCredits.toLocaleString()}</strong>
                <span>credits refreshed each month</span>
              </div>
              <ul>
                <li><span aria-hidden="true">✓</span>50 credits per AI influencer</li>
                <li><span aria-hidden="true">✓</span>20 credits per new post</li>
                <li><span aria-hidden="true">✓</span>{item.maxSocialAccounts === null ? "Unlimited connected accounts" : `Up to ${item.maxSocialAccounts} connected accounts`}</li>
                <li><span aria-hidden="true">✓</span>Unlimited scheduled posts</li>
              </ul>
              <button
                className={`button ${id === "pro" ? "button-dark" : "button-outline"} payment-plan-action`}
                disabled={pending !== null || isCurrent}
                onClick={() =>
                  void openBilling(
                    hasStripeSubscription
                      ? "/api/billing/portal"
                      : "/api/billing/checkout",
                    hasStripeSubscription ? "portal" : id,
                  )
                }
                type="button"
              >
                {pending === id || (pending === "portal" && !isCurrent)
                  ? "Opening secure billing…"
                  : isCurrent
                    ? "Current plan"
                    : hasStripeSubscription
                      ? "Manage subscription"
                      : `Choose ${item.name}`}
              </button>
            </article>
          );
        })}
      </div>

    </div>
  );
}
