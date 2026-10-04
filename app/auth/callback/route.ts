import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!getSupabaseConfig()) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    const error = request.nextUrl.searchParams.has("error")
      ? "oauth"
      : "confirmation";
    return NextResponse.redirect(
      new URL(`/auth?mode=signin&error=${error}`, request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/auth?mode=signin&error=confirmation", request.url),
    );
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
