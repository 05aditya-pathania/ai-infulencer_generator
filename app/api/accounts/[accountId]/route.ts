import { NextResponse, type NextRequest } from "next/server";
import { disconnectZernioAccount, getZernioSetup, ZernioApiError } from "@/lib/zernio";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type DisconnectContext = {
  params: Promise<{ accountId: string }>;
};

export async function DELETE(request: NextRequest, { params }: DisconnectContext) {
  const setup = getZernioSetup();
  if (!setup.configured) {
    return NextResponse.json({ error: setup.error }, { status: 503 });
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(setup.appUrl).origin) {
    return NextResponse.json({ error: "The request origin could not be verified." }, { status: 403 });
  }

  if (!getSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { accountId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) {
    return NextResponse.json({ error: "That connected account was not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in before disconnecting an account." }, { status: 401 });
  }

  const { data: account, error: accountError } = await supabase
    .from("social_accounts")
    .select("id, zernio_account_id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    return NextResponse.json({ error: "That connected account was not found." }, { status: 404 });
  }

  try {
    await disconnectZernioAccount(account.zernio_account_id);
  } catch (error) {
    if (!(error instanceof ZernioApiError) || error.status !== 404) {
      console.error("Could not disconnect the Zernio social account:", error);
      return NextResponse.json(
        { error: "Zernio could not disconnect this account. Please try again." },
        { status: 502 },
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("social_accounts")
    .delete()
    .eq("id", account.id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Could not remove the disconnected social account:", deleteError.message);
    return NextResponse.json(
      { error: "The account was disconnected, but Postly could not refresh your account list. Reload and try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ disconnected: true });
}
