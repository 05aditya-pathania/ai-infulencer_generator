import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type StudioPageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const params = await searchParams;
  const view = params.view === "posts" ? "posts" : "models";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: models } = user
    ? await supabase
        .from("influencer_models")
        .select("id, name, portrait_path, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(6)
    : { data: [] };

  const signedModels = await Promise.all(
    (models ?? []).map(async (model) => {
      if (!model.portrait_path) {
        return { ...model, portraitUrl: null };
      }

      const { data } = await supabase.storage
        .from("influencer-models")
        .createSignedUrl(model.portrait_path, 60 * 60);

      return { ...model, portraitUrl: data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="studio-page">
      <section className="studio-heading">
        <div>
          <span className="section-kicker">YOUR CREATIVE PLAYGROUND</span>
          <h1>AI Studio</h1>
          <p>Make a model. Dream up a post. Keep your good ideas moving.</p>
        </div>
        <div className="studio-heading-actions">
          <Link className="button button-outline studio-post-button" href="/dashboard/studio/posts/new">
            <span aria-hidden="true">✎</span> Create new post
          </Link>
          <Link className="button button-dark studio-model-button" href="/dashboard/studio/models/new">
            <span aria-hidden="true">＋</span> Add new model
          </Link>
        </div>
      </section>

      <section aria-label="AI Studio tools" className="studio-tool-grid">
        <Link className="studio-tool-card studio-tool-model" href="/dashboard/studio/models/new">
          <span className="studio-tool-icon"><span>✧</span></span>
          <span className="studio-tool-copy"><strong>Create an AI model</strong><small>Build a unique fictional influencer from the details you choose.</small></span>
          <span className="studio-tool-arrow">↗</span>
        </Link>
        <Link className="studio-tool-card studio-tool-post" href="/dashboard/studio/posts/new">
          <span className="studio-tool-icon"><span>✎</span></span>
          <span className="studio-tool-copy"><strong>Create a new post</strong><small>Bring your next idea to life with your AI creative sidekick.</small></span>
          <span className="studio-tool-arrow">↗</span>
        </Link>
      </section>

      <section className="studio-library">
        <div className="studio-library-heading">
          <div>
            <span className="dashboard-panel-eyebrow">YOUR WORKSPACE</span>
            <h2>{view === "models" ? "Models & posts" : "Generated posts"}</h2>
          </div>
          <div aria-label="Studio items" className="studio-tabs">
            <Link aria-current={view === "models" ? "page" : undefined} className={view === "models" ? "active" : ""} href="/dashboard/studio?view=models">
              My models <span>{signedModels.length}</span>
            </Link>
            <Link aria-current={view === "posts" ? "page" : undefined} className={view === "posts" ? "active" : ""} href="/dashboard/studio?view=posts">
              Generated posts
            </Link>
          </div>
        </div>

        {view === "models" && signedModels.length > 0 ? (
          <div className="studio-model-grid">
            {signedModels.map((model) => (
              <article className="studio-model-card" key={model.id}>
                {model.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`Portrait of ${model.name}`} className="studio-model-image" src={model.portraitUrl} />
                ) : (
                  <div className="studio-model-image studio-model-image-empty">✧</div>
                )}
                <div className="studio-model-card-details"><span className="studio-model-status">✦ AI MODEL</span><strong>{model.name}</strong></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="studio-library-empty">
            <div aria-hidden="true" className="studio-empty-art"><span>✧</span><span>✳</span><div><i /><i /><i /></div></div>
            <span className="dashboard-panel-eyebrow">{view === "models" ? "A BLANK CANVAS, A MILLION POSSIBILITIES" : "YOUR NEXT STORY IS WAITING"}</span>
            <h3>{view === "models" ? "Your first model starts with a little imagination." : "Your post collection starts here."}</h3>
            <p>{view === "models" ? "Choose the details, shape their style, and meet the character you create." : "Create a model first, then turn your ideas into your first AI-assisted post."}</p>
            <Link className="button button-dark dashboard-small-button" href={view === "models" ? "/dashboard/studio/models/new" : "/dashboard/studio?view=models"}>
              {view === "models" ? "Create your first model" : "Explore your models"} <span>↗</span>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
