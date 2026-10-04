import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type AuthPageProps = {
  searchParams: Promise<{
    mode?: string;
    error?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const mode = params.mode === "signin" ? "signin" : "signup";
  const errorMessage =
    params.error === "confirmation"
      ? "That confirmation link is missing, expired, or has already been used. Try signing in or request a new one."
      : params.error === "oauth"
        ? "Google or GitHub sign-in didn’t complete. Please try again."
      : undefined;
  const configured = Boolean(getSupabaseConfig());

  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (data?.claims?.sub) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="Postly home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>postly</span>
        </Link>
        <Link className="auth-back-link" href="/">Back to home</Link>
      </header>
      <div className="auth-content">
        <div className="auth-decoration auth-decoration-one">✳</div>
        <div className="auth-decoration auth-decoration-two">✦</div>
        <div className="auth-card">
          <div className="auth-card-mark"><span className="brand-mark"><span /><span /><span /></span></div>
          <p className="section-kicker">{mode === "signup" ? "YOUR NEXT CHAPTER STARTS HERE" : "GOOD TO HAVE YOU BACK"}</p>
          <h1>{mode === "signup" ? "Let’s make something." : "Welcome back."}</h1>
          <p className="auth-subtitle">
            {mode === "signup"
              ? "A calmer content routine is just a few clicks away."
              : "Your content calendar missed you."}
          </p>
          <AuthForm
            mode={mode}
            configured={configured}
            initialError={errorMessage}
          />
          <p className="auth-switch">
            {mode === "signup" ? "Already have an account?" : "New to Postly?"}{" "}
            <Link href={mode === "signup" ? "/auth?mode=signin" : "/auth?mode=signup"}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="auth-terms">
            By continuing, you agree to our <Link href="/#footer">Terms</Link> and{" "}
            <Link href="/#footer">Privacy Policy</Link>.
          </p>
        </div>
      </div>
      <footer className="auth-footer">Made for the humans behind the handles. <span>♥</span></footer>
    </main>
  );
}
