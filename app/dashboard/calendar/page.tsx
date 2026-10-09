import {
  ScheduledPostCalendar,
  type CalendarDraftPost,
  type CalendarScheduledPost,
} from "@/components/scheduled-post-calendar";
import { createClient } from "@/lib/supabase/server";

type CalendarPageProps = {
  searchParams: Promise<{ month?: string | string[] }>;
};

function validMonth(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    return undefined;
  }

  const [year, month] = value.split("-").map(Number);
  return month >= 1 && month <= 12 && year >= 1 ? value : undefined;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const { month: requestedMonth } = await searchParams;
  const month = validMonth(requestedMonth) ?? new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1) - 24 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, monthNumber, 1) + 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_posts")
    .select(
      "id, model_name, platform, platforms, format, campaign, product, goal, scene, tone, call_to_action, language, caption, hashtags, image_path, scheduled_at",
    )
    .eq("status", "scheduled")
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load your scheduled posts: ${error.message}`);
  }

  const { data: drafts, error: draftsError } = await supabase
    .from("social_posts")
    .select(
      "id, model_name, platform, platforms, format, campaign, product, goal, scene, tone, call_to_action, language, caption, hashtags, image_path, created_at",
    )
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (draftsError) {
    throw new Error(`Could not load your post drafts: ${draftsError.message}`);
  }

  const loadedScheduledPosts = await Promise.all(
    (data ?? []).map(async (post) => {
      if (!post.scheduled_at) {
        return null;
      }

      const { data: image, error: imageError } = await supabase.storage
        .from("social-posts")
        .createSignedUrl(post.image_path, 60 * 60);

      if (imageError) {
        throw new Error(`Could not load the image for scheduled post ${post.campaign}: ${imageError.message}`);
      }

      return {
        id: post.id,
        modelName: post.model_name,
        platform: post.platform,
        platforms: post.platforms,
        format: post.format,
        campaign: post.campaign,
        product: post.product,
        goal: post.goal,
        scene: post.scene,
        tone: post.tone,
        callToAction: post.call_to_action,
        language: post.language,
        caption: post.caption,
        hashtags: post.hashtags,
        imageUrl: image.signedUrl,
        scheduledAt: post.scheduled_at,
      };
    }),
  );
  const posts: CalendarScheduledPost[] = loadedScheduledPosts.filter(
    (post): post is CalendarScheduledPost => post !== null,
  );

  const draftPosts: CalendarDraftPost[] = await Promise.all(
    (drafts ?? []).map(async (draft) => {
      const { data: image, error: imageError } = await supabase.storage
        .from("social-posts")
        .createSignedUrl(draft.image_path, 60 * 60);

      if (imageError) {
        throw new Error(`Could not load the image for draft ${draft.campaign}: ${imageError.message}`);
      }

      return {
        id: draft.id,
        modelName: draft.model_name,
        platform: draft.platform,
        platforms: draft.platforms,
        format: draft.format,
        campaign: draft.campaign,
        product: draft.product,
        goal: draft.goal,
        scene: draft.scene,
        tone: draft.tone,
        callToAction: draft.call_to_action,
        language: draft.language,
        caption: draft.caption,
        hashtags: draft.hashtags,
        imageUrl: image.signedUrl,
        createdAt: draft.created_at,
      };
    }),
  );

  return <ScheduledPostCalendar draftPosts={draftPosts} month={month} posts={posts} />;
}
