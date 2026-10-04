"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    setErrorMessage("");

    try {
      const { error } = await createClient().auth.signOut();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Couldn’t sign out. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="dashboard-signout">
      {errorMessage && <span role="alert">{errorMessage}</span>}
      <button className="auth-back-link" disabled={pending} onClick={handleSignOut} type="button">
        {pending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
