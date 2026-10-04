"use client";

import { useEffect, useState } from "react";

type CreditsBadgeProps = {
  initialCredits: number | null;
};

export function CreditsBadge({ initialCredits }: CreditsBadgeProps) {
  const [credits, setCredits] = useState(initialCredits);

  useEffect(() => {
    function handleCreditsUpdated(event: Event) {
      const nextCredits = (event as CustomEvent<unknown>).detail;

      if (typeof nextCredits === "number" && Number.isInteger(nextCredits)) {
        setCredits(nextCredits);
      }
    }

    window.addEventListener("postly:credits-updated", handleCreditsUpdated);
    return () => window.removeEventListener("postly:credits-updated", handleCreditsUpdated);
  }, []);

  if (credits === null) {
    return null;
  }

  return (
    <div aria-label={`${credits} credits remaining`} className="dashboard-credit-badge">
      <span aria-hidden="true">✧</span>
      <strong>{credits.toLocaleString()}</strong>
      <small>credits</small>
    </div>
  );
}
