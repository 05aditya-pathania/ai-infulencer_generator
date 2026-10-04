import Link from "next/link";
import { InfluencerBuilder } from "@/components/influencer-builder";
import { createClient } from "@/lib/supabase/server";

export default async function NewInfluencerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="studio-page">
      <section className="studio-heading model-builder-page-heading">
        <div>
          <Link className="studio-back-link" href="/dashboard/studio">← Back to AI Studio</Link>
          <span className="section-kicker">DREAM UP SOMEONE NEW</span>
          <h1>Create an AI model</h1>
          <p>A little imagination, a few details, and meet the creator you dreamed up.</p>
        </div>
        <div className="model-builder-heading-credit">
          <span>✧</span>
          <strong>{profile?.credits ?? "—"}</strong>
          <small>credits available</small>
        </div>
      </section>

      <InfluencerBuilder
        imageGenerationConfigured={Boolean(process.env.POLLINATIONS_API_KEY)}
        initialCredits={profile?.credits ?? null}
      />
    </div>
  );
}
