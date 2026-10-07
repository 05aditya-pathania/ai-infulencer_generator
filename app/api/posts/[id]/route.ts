import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UpdatePostBody = {
  status?: unknown;
  scheduledAt?: unknown;
};

function isObject(value: unknown): value is UpdatePostBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "This post could not be found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please submit valid post details." }, { status: 400 });
  }

  if (!isObject(body) || (body.status !== "draft" && body.status !== "scheduled")) {
    return NextResponse.json({ error: "Choose draft or scheduled for this post." }, { status: 400 });
  }

  let scheduledAt: string | null = null;
  if (body.status === "scheduled") {
    if (typeof body.scheduledAt !== "string" || !Number.isFinite(Date.parse(body.scheduledAt))) {
      return NextResponse.json({ error: "Choose a valid date and time for this post." }, { status: 400 });
    }
    const scheduleDate = new Date(body.scheduledAt);
    if (scheduleDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Choose a schedule time in the future." }, { status: 400 });
    }
    scheduledAt = scheduleDate.toISOString();
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in before updating this post." }, { status: 401 });
  }

  if (body.status === "scheduled") {
    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .select("platform, platforms")
      .eq("id", id)
      .eq("user_id", user.id)
      .in("status", ["draft", "scheduled"])
      .maybeSingle();

    if (postError) {
      console.error("Could not load post destination before scheduling:", postError.message);
      return NextResponse.json({ error: "We couldn’t verify this post’s destination." }, { status: 500 });
    }
    const selectedPlatforms = post?.platforms.length
      ? post.platforms
      : post?.platform
        ? [post.platform]
        : [];
    if (selectedPlatforms.length === 0) {
      return NextResponse.json(
        { error: "Connect and select at least one social platform before scheduling this post." },
        { status: 400 },
      );
    }

    const accountPlatforms = selectedPlatforms.map((platform) =>
      platform === "x" ? "twitter" : platform,
    );
    const { data: connectedAccounts, error: accountError } = await supabase
      .from("social_accounts")
      .select("platform")
      .eq("user_id", user.id)
      .in("platform", accountPlatforms);

    if (accountError) {
      console.error("Could not verify the post destination accounts:", accountError.message);
      return NextResponse.json({ error: "We couldn’t verify the selected social account." }, { status: 500 });
    }
    const connectedPlatformSet = new Set((connectedAccounts ?? []).map((account) => account.platform));
    const hasMissingPlatform = accountPlatforms.some((platform) => !connectedPlatformSet.has(platform));
    if (hasMissingPlatform) {
      return NextResponse.json(
        { error: "Reconnect an account for every selected platform before scheduling this post." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("social_posts")
    .update({ status: body.status, scheduled_at: scheduledAt })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["draft", "scheduled"])
    .select("id, status, scheduled_at")
    .maybeSingle();

  if (error) {
    console.error("Could not update social post:", error.message);
    return NextResponse.json({ error: "We couldn’t update this post. Please try again." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "This post could not be found." }, { status: 404 });
  }

  return NextResponse.json({
    post: { id: data.id, status: data.status, scheduledAt: data.scheduled_at },
  });
}
