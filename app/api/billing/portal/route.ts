import { NextResponse, type NextRequest } from "next/server";
import { getAppUrl, getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let appUrl: string;
  try {
    appUrl = getAppUrl();
  } catch (error) {
    console.error("Stripe billing portal is not configured:", error);
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
    return NextResponse.json({ error: "Please sign in to manage billing." }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile?.stripe_customer_id) {
    return NextResponse.json({ error: "There is no Stripe billing account to manage yet." }, { status: 404 });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (portalError) {
    console.error("Could not create Stripe billing portal session:", portalError);
    return NextResponse.json(
      { error: "We couldn’t open billing management. Check your Stripe customer portal configuration." },
      { status: 502 },
    );
  }
}
