"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "signup" | "signin";
type OAuthProvider = "google" | "github";

type AuthFormProps = {
  mode: AuthMode;
  configured: boolean;
  initialError?: string;
};

export function AuthForm({ mode, configured, initialError }: AuthFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(initialError ?? "");
  const [success, setSuccess] = useState(false);

  async function handleOAuth(provider: OAuthProvider) {
    setPending(true);
    setMessage("");
    setSuccess(false);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: new URL(
            "/auth/callback",
            window.location.origin,
          ).toString(),
        },
      });

      if (error) {
        setMessage(error.message);
        setPending(false);
      } else if (!data.url) {
        setMessage(`Couldn’t start ${provider === "google" ? "Google" : "GitHub"} sign-in. Please try again.`);
        setPending(false);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We couldn’t start sign-in. Please try again.",
      );
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const displayName = String(formData.get("displayName") ?? "").trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: new URL("/auth/callback", window.location.origin).toString(),
          },
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        if (!data.session) {
          setSuccess(true);
          setMessage("Check your inbox for a confirmation link to finish creating your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setMessage(error.message);
          return;
        }
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We couldn’t complete that request. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {!configured && (
        <div className="auth-message auth-message-error" role="alert">
          Add your Supabase project URL and publishable key to <code>.env.local</code> to enable authentication.
        </div>
      )}
      {message && (
        <div
          className={`auth-message ${success ? "auth-message-success" : "auth-message-error"}`}
          role={success ? "status" : "alert"}
        >
          {message}
        </div>
      )}
      <div className="oauth-buttons">
        <button
          className="oauth-button"
          disabled={pending || !configured}
          onClick={() => handleOAuth("google")}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.91 3.27-4.72 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.16v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.16a11 11 0 0 0 0 9.9l3.69-2.84Z" />
            <path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.05 14.96 1 12 1a11 11 0 0 0-9.84 6.05l3.69 2.84C6.72 7.29 9.14 5.36 12 5.36Z" />
          </svg>
          Continue with Google
        </button>
        <button
          className="oauth-button"
          disabled={pending || !configured}
          onClick={() => handleOAuth("github")}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.32-3.76-1.32-.5-1.29-1.24-1.63-1.24-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 .1.76 1.12 2.55 1.96.1-.73.39-1.22.71-1.5-2.48-.28-5.09-1.24-5.09-5.54 0-1.23.44-2.23 1.15-3.02-.12-.28-.5-1.43.11-2.98 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.44 3.05-1.15 3.05-1.15.61 1.55.23 2.7.11 2.98.72.79 1.15 1.79 1.15 3.02 0 4.31-2.61 5.25-5.1 5.53.4.35.76 1.02.76 2.06v3.07c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
          </svg>
          Continue with GitHub
        </button>
      </div>
      <div className="auth-divider"><span>or continue with email</span></div>
      {mode === "signup" && (
        <label className="auth-field">
          <span>Your name</span>
          <input
            autoComplete="name"
            name="displayName"
            placeholder="Jamie Parker"
            required
            maxLength={80}
          />
        </label>
      )}
      <label className="auth-field">
        <span>Email address</span>
        <input
          autoComplete="email"
          name="email"
          placeholder="you@example.com"
          type="email"
          required
          maxLength={254}
        />
      </label>
      <label className="auth-field">
        <span>Password</span>
        <input
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          name="password"
          placeholder="At least 8 characters"
          type="password"
          required
          minLength={8}
          maxLength={128}
        />
      </label>
      <button
        className="button button-dark auth-submit"
        disabled={pending || !configured}
        type="submit"
      >
        {pending
          ? "One moment..."
          : mode === "signup"
            ? "Create your free account"
            : "Sign in"}
        {!pending && <span aria-hidden="true">↗</span>}
      </button>
      <p className="auth-form-note">
        <span aria-hidden="true">✳</span> Free to start. No credit card needed.
      </p>
    </form>
  );
}
