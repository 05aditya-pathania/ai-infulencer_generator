export const subscriptionPlans = {
  standard: {
    id: "standard",
    name: "Standard",
    priceCents: 999,
    monthlyCredits: 2000,
    maxSocialAccounts: 5,
    scheduledPosts: "Unlimited",
    priceLabel: "$9.99",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 2999,
    monthlyCredits: 10000,
    maxSocialAccounts: null,
    scheduledPosts: "Unlimited",
    priceLabel: "$29.99",
  },
} as const;

export type PaidPlanId = keyof typeof subscriptionPlans;
export type PlanId = "free" | PaidPlanId;

export function isPaidPlan(value: unknown): value is PaidPlanId {
  return value === "standard" || value === "pro";
}

export function isActiveSubscription(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}
