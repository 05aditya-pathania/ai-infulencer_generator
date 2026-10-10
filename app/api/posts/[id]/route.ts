import { NextResponse } from "next/server";
import {
  combinePostCaption,
  createZernioDraftPost,
  getZernioSetup,
  updateZernioDraftPost,
  updateZernioScheduledPost,
} from "@/lib/zernio";
import { createClient } from "@/lib/supabase/server";

type UpdatePostBody = {
  status?: unknown;
  scheduledAt?: unknown;
  campaign?: unknown;
  product?: unknown;
  caption?: unknown;
  hashtags?: unknown;
};

function isObject(value: unknown): value is UpdatePostBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPlatformForZernio(platform: string) {
  return platform === "x" ? "twitter" : platform;
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

  const updates: {
    status: "draft" | "scheduled";
    scheduled_at: string | null;
    campaign?: string;
    product?: string;
    caption?: string;
    hashtags?: string[];
    zernio_post_id?: string;
  } = { status: body.status, scheduled_at: null };

  for (const field of ["campaign", "product"] as const) {
    const value = body[field];
    if (value !== undefined) {
      if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 80) {
        return NextResponse.json({ error: `${field === "campaign" ? "Campaign" : "Product"} must be between 1 and 80 characters.` }, { status: 400 });
      }
      updates[field] = value.trim();
    }
  }

  if (body.caption !== undefined) {
    if (typeof body.caption !== "string" || body.caption.length > 600) {
      return NextResponse.json({ error: "The post caption must be 600 characters or fewer." }, { status: 400 });
    }
    updates.caption = body.caption;
  }

  if (body.hashtags !== undefined) {
    if (
      !Array.isArray(body.hashtags) ||
      body.hashtags.length > 20 ||
      !body.hashtags.every((tag) => typeof tag === "string" && tag.length <= 60)
    ) {
      return NextResponse.json({ error: "Choose up to 20 hashtags, each 60 characters or fewer." }, { status: 400 });
    }
    updates.hashtags = body.hashtags;
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
    updates.scheduled_at = scheduledAt;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in before updating this post." }, { status: 401 });
  }

  const { data: post, error: postError } = await supabase
    .from("social_posts")
    .select("id, status, platform, platforms, caption, hashtags, image_path, zernio_post_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["draft", "scheduled"])
    .maybeSingle();

  if (postError) {
    console.error("Could not load social post before updating:", postError.message);
    if (
      postError.code === "42703" &&
      postError.message.includes("zernio_post_id")
    ) {
      return NextResponse.json(
        {
          error:
            "The database is missing the Zernio post ID column. Apply supabase/migrations/20261009000000_add_zernio_post_ids.sql in the Supabase SQL Editor, then retry.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "We couldn’t load this post. Please try again." }, { status: 500 });
  }
  if (!post) {
    return NextResponse.json({ error: "This post could not be found." }, { status: 404 });
  }

  if (body.status === "scheduled" && post.status !== "scheduled") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      console.error("Could not load the account plan before scheduling a post:", profileError?.message);
      return NextResponse.json({ error: "Your account plan could not be verified." }, { status: 500 });
    }
    if (profile.plan === "free") {
      const { count, error: countError } = await supabase
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gt("scheduled_at", new Date().toISOString());
      if (countError) {
        console.error("Could not check the free scheduled-post limit:", countError.message);
        return NextResponse.json({ error: "We couldn’t check your scheduled-post limit." }, { status: 500 });
      }
      if ((count ?? 0) >= 5) {
        return NextResponse.json(
          { error: "The Free plan allows up to 5 scheduled posts at one time. Upgrade to Standard or Pro for unlimited scheduled posts." },
          { status: 409 },
        );
      }
    }
  }

  let zernioPostId = post.zernio_post_id;
  const content = combinePostCaption(
    updates.caption ?? post.caption,
    updates.hashtags ?? post.hashtags,
  );

  if (body.status === "scheduled") {
    const setup = getZernioSetup();
    if (!setup.configured) {
      return NextResponse.json({ error: setup.error }, { status: 503 });
    }

    const selectedPlatforms = post.platforms.length
      ? post.platforms
      : post.platform
        ? [post.platform]
        : [];
    if (selectedPlatforms.length === 0) {
      return NextResponse.json(
        { error: "Connect and select at least one social platform before scheduling this post." },
        { status: 400 },
      );
    }

    const accountPlatforms = [...new Set(selectedPlatforms.map(getPlatformForZernio))];
    const { data: connectedAccounts, error: accountError } = await supabase
      .from("social_accounts")
      .select("platform, zernio_account_id")
      .eq("user_id", user.id)
      .in("platform", accountPlatforms);

    if (accountError) {
      console.error("Could not verify the post destination accounts:", accountError.message);
      return NextResponse.json({ error: "We couldn’t verify the selected social account." }, { status: 500 });
    }

    const targets = (connectedAccounts ?? []).map((account) => ({
      platform: account.platform,
      accountId: account.zernio_account_id,
    }));
    const connectedPlatformSet = new Set(targets.map((target) => target.platform));
    const missingPlatforms = accountPlatforms.filter((platform) => !connectedPlatformSet.has(platform));
    if (missingPlatforms.length > 0) {
      return NextResponse.json(
        { error: "Reconnect an account for every selected platform before scheduling this post." },
        { status: 400 },
      );
    }

    const { data: image, error: imageError } = await supabase.storage
      .from("social-posts")
      .createSignedUrl(post.image_path, 60 * 60);
    if (imageError || !image?.signedUrl) {
      console.error("Could not prepare the post image for Zernio:", imageError?.message);
      return NextResponse.json({ error: "We couldn’t prepare this post’s image for scheduling." }, { status: 500 });
    }

    try {
      if (!zernioPostId) {
        zernioPostId = await createZernioDraftPost(post.id, {
          content,
          mediaUrl: image.signedUrl,
          targets,
        });
        const { data: mappedPost, error: idError } = await supabase
          .from("social_posts")
          .update({ zernio_post_id: zernioPostId })
          .eq("id", post.id)
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle();
        if (idError || !mappedPost) {
          console.error("Could not save the Zernio post mapping:", idError?.message ?? "No post row was updated.");
          return NextResponse.json({ error: "Zernio saved the post, but Postly couldn’t link it. Apply the latest Supabase migrations and try again." }, { status: 500 });
        }
      }

      await updateZernioScheduledPost(
        zernioPostId,
        { content, mediaUrl: image.signedUrl, targets },
        scheduledAt!,
      );
    } catch (error) {
      console.error("Could not schedule the post with Zernio:", error);
      const detail = error instanceof Error ? error.message : "Please try again.";
      return NextResponse.json(
        { error: `Zernio could not schedule this post: ${detail}` },
        { status: 502 },
      );
    }
    updates.zernio_post_id = zernioPostId;
  } else if (zernioPostId) {
    const setup = getZernioSetup();
    if (!setup.configured) {
      return NextResponse.json({ error: setup.error }, { status: 503 });
    }
    try {
      await updateZernioDraftPost(zernioPostId, content);
    } catch (error) {
      console.error("Could not move the post back to a Zernio draft:", error);
      const detail = error instanceof Error ? error.message : "Please try again.";
      return NextResponse.json(
        { error: `Zernio could not unschedule this post: ${detail}` },
        { status: 502 },
      );
    }
    updates.zernio_post_id = zernioPostId;
  }

  const { data, error } = await supabase
    .from("social_posts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["draft", "scheduled"])
    .select("id, status, scheduled_at")
    .maybeSingle();

  if (error) {
    if (error.message.includes("FREE_SCHEDULE_LIMIT_REACHED")) {
      try {
        if (zernioPostId) {
          await updateZernioDraftPost(zernioPostId, content);
        }
      } catch (unscheduleError) {
        console.error("Could not undo the over-limit Zernio schedule:", unscheduleError);
      }
      return NextResponse.json(
        { error: "The Free plan allows up to 5 scheduled posts at one time. Upgrade to Standard or Pro for unlimited scheduled posts." },
        { status: 409 },
      );
    }
    console.error("Could not update social post:", error.message);
    return NextResponse.json({ error: "The Zernio schedule was updated, but Postly couldn’t save the change. Please reload and try again." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "This post could not be found." }, { status: 404 });
  }

  return NextResponse.json({
    post: { id: data.id, status: data.status, scheduledAt: data.scheduled_at },
  });
}
