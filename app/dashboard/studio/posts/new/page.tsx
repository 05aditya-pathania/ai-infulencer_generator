import Link from "next/link";
import { CreatePostComposer, type PostCreator } from "@/components/create-post-composer";
import { createClient } from "@/lib/supabase/server";
import type { SocialPlatform } from "@/lib/posts/options";

type NewPostPageProps = {
  searchParams: Promise<{ scheduleDate?: string | string[] }>;
};

function validScheduleDate(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? value
    : undefined;
}

export default async function NewPostPage({ searchParams }: NewPostPageProps) {
  const { scheduleDate: requestedScheduleDate } = await searchParams;
  const scheduledDate = validScheduleDate(requestedScheduleDate);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: models, error } = user
    ? await supabase
        .from("influencer_models")
        .select("id, name, traits, portrait_path")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(12)
    : { data: [], error: null };

  const { data: connectedAccounts, error: accountsError } = user
    ? await supabase
        .from("social_accounts")
        .select("platform")
        .eq("user_id", user.id)
    : { data: [], error: null };

  if (error) {
    throw new Error(`Could not load your saved creator models: ${error.message}`);
  }
  if (accountsError) {
    throw new Error(`Could not load your connected social accounts: ${accountsError.message}`);
  }

  const creators: PostCreator[] = await Promise.all(
    (models ?? []).map(async (model) => {
      const { data, error: imageError } = model.portrait_path
        ? await supabase.storage
            .from("influencer-models")
            .createSignedUrl(model.portrait_path, 60 * 60)
        : { data: null, error: null };

      if (imageError) {
        throw new Error(`Could not load the portrait for ${model.name}: ${imageError.message}`);
      }

      const traits =
        typeof model.traits === "object" &&
        model.traits !== null &&
        !Array.isArray(model.traits)
          ? model.traits
          : {};
      const vibe =
        "vibe" in traits && typeof traits.vibe === "string" ? traits.vibe : "Creator";

      return {
        id: model.id,
        name: model.name,
        vibe,
        portraitUrl: data?.signedUrl ?? "",
      };
    }),
  );

  const connectedPlatforms = [...new Set(
    (connectedAccounts ?? [])
      .map((account) => (account.platform === "twitter" ? "x" : account.platform))
      .filter((platform): platform is SocialPlatform =>
        ["instagram", "tiktok", "x", "linkedin", "pinterest", "facebook"].includes(platform),
      ),
  )];

  return (
    <div className="studio-page">
      <section className="studio-heading post-page-heading">
        <div>
          <Link className="studio-back-link" href="/dashboard/studio">← Back to AI Studio</Link>
          <span className="section-kicker">MAKE YOUR NEXT SCROLL-STOPPER</span>
          <h1>Create a new post</h1>
          <p>Shape the brief, set the scene, and let your creator bring the idea to life.</p>
        </div>
        <span className="post-engine-badge"><span /> POWERED BY FLUX.2 KLEIN</span>
      </section>

      <CreatePostComposer
        creators={creators}
        connectedPlatforms={connectedPlatforms}
        imageGenerationConfigured={Boolean(
          process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN,
        )}
        scheduledDate={scheduledDate}
      />
    </div>
  );
}
