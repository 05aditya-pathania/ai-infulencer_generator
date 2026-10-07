"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  buildHashtags,
  buildPostCaption,
} from "@/lib/posts/copy";
import { PostActionPanel } from "@/components/post-action-panel";
import {
  callToActions,
  captionTones,
  platforms,
  postFormats,
  postGoals,
  postLanguages,
  visualScenes,
  type CaptionTone,
  type CallToAction,
  type PostFormat,
  type PostGoal,
  type PostLanguage,
  type PostGenerationInput,
  type SocialPlatform,
  type VisualScene,
} from "@/lib/posts/options";

export type PostCreator = {
  id: string;
  name: string;
  vibe: string;
  portraitUrl: string;
};

type PostPreview = {
  imageUrl: string;
  caption: string;
  hashtags: string[];
  modelName: string;
  aspectRatio: string;
};

type ReferenceImage = {
  id: string;
  dataUrl: string;
  previewUrl: string;
  fileName: string;
};

type SaveStatus = "draft" | "scheduled" | "ready_to_publish";

type SaveNotice = {
  status: SaveStatus;
  scheduledAt: string | null;
  platforms: SocialPlatform[];
};

type CreatePostComposerProps = {
  creators: PostCreator[];
  connectedPlatforms: SocialPlatform[];
  imageGenerationConfigured: boolean;
};

function toLocalDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function waitForBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read reference image."));
    reader.onerror = () => reject(new Error("Could not read reference image."));
    reader.readAsDataURL(blob);
  });
}

async function prepareReferenceImage(file: File): Promise<ReferenceImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a valid image file.");
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Each source image must be 12 MB or smaller.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not prepare this image.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.78),
  );

  if (!blob || blob.size > 2 * 1024 * 1024) {
    throw new Error("Could not compress this image below 2 MB. Choose a smaller reference.");
  }

  const dataUrl = await waitForBlob(blob);
  return {
    id: crypto.randomUUID(),
    dataUrl,
    previewUrl: dataUrl,
    fileName: file.name,
  };
}

function platformHandle(name: string) {
  return `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) || "yourcreator"}`;
}

export function CreatePostComposer({
  creators,
  connectedPlatforms,
  imageGenerationConfigured,
}: CreatePostComposerProps) {
  const [modelId, setModelId] = useState(creators[0]?.id ?? "");
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    connectedPlatforms[0] ? [connectedPlatforms[0]] : [],
  );
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [format, setFormat] = useState<PostFormat>("single");
  const [campaign, setCampaign] = useState("");
  const [product, setProduct] = useState("");
  const [goal, setGoal] = useState<PostGoal>("Product launch");
  const [scene, setScene] = useState<VisualScene>("Studio");
  const [tone, setTone] = useState<CaptionTone>("Playful");
  const [callToAction, setCallToAction] = useState<CallToAction>("Shop now");
  const [language, setLanguage] = useState<PostLanguage>("English");
  const [hashtagCount, setHashtagCount] = useState(5);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [actionMode, setActionMode] = useState<"publish" | "schedule">("publish");
  const [scheduleTime, setScheduleTime] = useState(() =>
    toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [preview, setPreview] = useState<PostPreview | null>(null);
  const [caption, setCaption] = useState("");
  const [isConnectingPlatform, setIsConnectingPlatform] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveDialogRef = useRef<HTMLDialogElement>(null);

  const selectedCreator = creators.find((creator) => creator.id === modelId);
  const platform = selectedPlatforms[0] ?? null;
  const visiblePlatforms = showAllPlatforms
    ? platforms
    : platforms.filter((item) => connectedPlatforms.includes(item.id));
  const selectedPlatformsAreConnected =
    selectedPlatforms.length > 0 &&
    selectedPlatforms.every((item) => connectedPlatforms.includes(item));
  const platformToConnect =
    selectedPlatforms.find((item) => !connectedPlatforms.includes(item)) ?? null;
  const platformToConnectDetails = platforms.find((item) => item.id === platformToConnect);
  const platformToConnectCanBeConnected = platformToConnect !== null;
  const hashtags = useMemo(
    () => buildHashtags(product, campaign, hashtagCount),
    [campaign, hashtagCount, product],
  );
  const captionText = caption || (campaign || product
    ? buildPostCaption({ campaign, product, goal, tone, callToAction, language })
    : "Your caption will take shape as you build your brief.");

  useEffect(() => {
    if (saveNotice && saveDialogRef.current && !saveDialogRef.current.open) {
      saveDialogRef.current.showModal();
    }
  }, [saveNotice]);

  function dismissSaveNotice() {
    if (saveDialogRef.current?.open) {
      saveDialogRef.current.close();
    }
    setSaveNotice(null);
  }

  function togglePlatform(selected: SocialPlatform) {
    setSelectedPlatforms((current) =>
      current.includes(selected)
        ? current.filter((item) => item !== selected)
        : [...current, selected],
    );
  }

  async function handleReferenceFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    setErrorMessage("");

    if (references.length + files.length > 3) {
      setErrorMessage("Choose up to 3 reference images.");
      return;
    }

    try {
      const prepared = await Promise.all(files.map(prepareReferenceImage));
      setReferences((current) => [...current, ...prepared]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load a reference image.");
    }
  }

  function removeReference(id: string) {
    setReferences((current) => current.filter((reference) => reference.id !== id));
  }

  async function connectSelectedPlatform() {
    if (!platformToConnect) {
      return;
    }

    setIsConnectingPlatform(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformToConnect === "x" ? "twitter" : platformToConnect,
          returnTo: "studio-post",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { authUrl?: unknown; error?: unknown }
        | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "We couldn’t start this social account connection.",
        );
      }
      if (typeof payload?.authUrl !== "string") {
        throw new Error("The connection service did not return an authorization link.");
      }

      window.location.assign(payload.authUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn’t start this social account connection.",
      );
      setIsConnectingPlatform(false);
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setPreview(null);
    setCaption("");

    if (!selectedCreator) {
      setErrorMessage("Create and save an AI model before making a post.");
      return;
    }

    setIsGenerating(true);

    const input: PostGenerationInput = {
      modelId,
      platform,
      format,
      campaign,
      product,
      goal,
      scene,
      tone,
      callToAction,
      language,
      hashtagCount,
      references: references.map((reference) => reference.dataUrl),
    };

    try {
      const response = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as {
        error?: string;
        imageUrl?: string;
        modelName?: string;
        aspectRatio?: string;
      };

      if (!response.ok || !payload.imageUrl) {
        throw new Error(payload.error ?? "We couldn’t generate your post. Please try again.");
      }

      const nextCaption = buildPostCaption({
        campaign,
        product,
        goal,
        tone,
        callToAction,
        language,
      });
      setCaption(nextCaption);
      setPreview({
        imageUrl: payload.imageUrl,
        caption: nextCaption,
        hashtags,
        modelName: payload.modelName ?? selectedCreator.name,
        aspectRatio: payload.aspectRatio ?? "1:1",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn’t generate your post. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSavePost(status: SaveStatus) {
    if (!preview) return;

    let scheduledAt: string | null = null;
    if (status === "scheduled") {
      const selectedTime = new Date(scheduleTime);
      if (!scheduleTime || !Number.isFinite(selectedTime.getTime()) || selectedTime.getTime() <= Date.now()) {
        setErrorMessage("Choose a schedule time in the future.");
        return;
      }
      scheduledAt = selectedTime.toISOString();
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/posts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          platform,
          platforms: selectedPlatforms,
          format,
          campaign,
          product,
          goal,
          scene,
          tone,
          callToAction,
          language,
          hashtagCount,
          references: [],
          caption: captionText,
          hashtags,
          imageDataUrl: preview.imageUrl,
          status,
          scheduledAt,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "We couldn’t save this post. Please try again.");
      }

      setSaveNotice({ status, scheduledAt, platforms: selectedPlatforms });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn’t save this post. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="post-composer">
      <form className="post-composer-form" onSubmit={handleGenerate}>
        <section className="post-form-section">
          <div className="post-section-heading">
            <span>01</span>
            <div><h2>Choose your creator</h2><p>Pick the face of your next campaign.</p></div>
          </div>
          {creators.length > 0 ? (
            <div className="post-creator-grid">
              {creators.map((creator) => (
                <button
                  aria-pressed={modelId === creator.id}
                  className={`post-creator-card${modelId === creator.id ? " selected" : ""}`}
                  key={creator.id}
                  onClick={() => setModelId(creator.id)}
                  type="button"
                >
                  <span className="post-creator-avatar">
                    {creator.portraitUrl ? (
                      <Image alt="" fill sizes="54px" src={creator.portraitUrl} unoptimized />
                    ) : (
                      creator.name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="post-creator-info">
                    <strong>{creator.name}</strong>
                    <small>{creator.vibe}</small>
                  </span>
                  <span className="post-creator-check">{modelId === creator.id ? "✓" : ""}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="post-empty-models">
              <span>✧</span>
              <p>Save a creator model to use it in your posts.</p>
              <Link className="button button-outline" href="/dashboard/studio/models/new">Create a model ↗</Link>
            </div>
          )}
        </section>

        <section className="post-form-section">
          <div className="post-section-heading">
            <span>02</span>
            <div>
              <h2>Where are we posting?</h2>
              <p>
                {connectedPlatforms.length > 0
                  ? "Choose one or more connected channels for this post."
                  : "Connect channels to enable scheduling, or save this post as a draft."}
              </p>
            </div>
          </div>
          <div className="post-platform-selector">
            <label className="post-show-all-platforms">
              <input
                checked={showAllPlatforms}
                onChange={(event) => {
                  const showAll = event.target.checked;
                  setShowAllPlatforms(showAll);
                  if (!showAll) {
                    setSelectedPlatforms((current) =>
                      current.filter((item) => connectedPlatforms.includes(item)),
                    );
                  }
                }}
                type="checkbox"
              />
              <span className="post-show-all-control" aria-hidden="true" />
              <span className="post-show-all-copy">
                <strong>Show all platforms</strong>
                <small>Include platforms that aren’t connected yet</small>
              </span>
            </label>
            {visiblePlatforms.length > 0 ? (
              <>
                <div
                  aria-label={showAllPlatforms ? "All social platforms" : "Connected social platforms"}
                  className="post-platform-tabs"
                  role="group"
                >
                  {visiblePlatforms.map((item) => {
                    const isConnected = connectedPlatforms.includes(item.id);
                    return (
                      <button
                        aria-pressed={selectedPlatforms.includes(item.id)}
                        className={`post-platform-tab${selectedPlatforms.includes(item.id) ? " selected" : ""}`}
                        key={item.id}
                        onClick={() => togglePlatform(item.id)}
                        title={item.label}
                        type="button"
                      >
                        <span className={`post-platform-icon platform-${item.id}`} aria-hidden="true">{item.icon}</span>
                        <span className="post-platform-tab-copy">
                          <strong>{item.label}</strong>
                          <small className={`post-platform-connection${isConnected ? " is-connected" : ""}`}>
                            <i aria-hidden="true" />
                            {isConnected ? "Connected" : "Not connected"}
                          </small>
                        </span>
                        <span className="post-platform-selected-mark" aria-hidden="true">
                          {selectedPlatforms.includes(item.id) ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="post-platform-selection-footer">
                  <div className="post-platform-selection-summary">
                    <span
                      className={`post-platform-selection-dot${selectedPlatformsAreConnected ? " is-connected" : ""}`}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>
                        {selectedPlatforms.length
                          ? selectedPlatforms
                              .map((selected) => platforms.find((item) => item.id === selected)?.label ?? selected)
                              .join(", ")
                          : "No platform selected"}
                      </strong>
                      <small>
                        {selectedPlatformsAreConnected
                          ? `${selectedPlatforms.length} ${selectedPlatforms.length === 1 ? "platform" : "platforms"} ready for scheduling`
                          : platformToConnect
                            ? "Connect selected platforms to enable scheduling"
                            : "Choose one or more platforms"}
                      </small>
                    </span>
                  </div>
                  <div className="post-platform-selection-actions">
                    {platformToConnect && platformToConnectCanBeConnected && (
                      <button
                        className="button button-dark post-connect-selected-platform"
                        disabled={isConnectingPlatform}
                        onClick={() => void connectSelectedPlatform()}
                        type="button"
                      >
                        {isConnectingPlatform
                          ? "Opening…"
                          : `Connect ${platformToConnectDetails?.label}`}
                        {!isConnectingPlatform && <span aria-hidden="true">↗</span>}
                      </button>
                    )}
                    <Link className="post-connect-account-link" href="/dashboard/accounts">
                      Manage accounts
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="post-no-connected-platform">
                <p>No social accounts are connected yet.</p>
                <Link className="button button-outline" href="/dashboard/accounts">
                  Connect a social account ↗
                </Link>
              </div>
            )}
          </div>
          <div className="post-format-options">
            {postFormats.map((item) => (
              <button
                aria-pressed={format === item.id}
                className={`post-format-option${format === item.id ? " selected" : ""}`}
                key={item.id}
                onClick={() => setFormat(item.id)}
                type="button"
              >
                <span className={`post-format-shape format-shape-${item.id}`} />
                <strong>{item.label}</strong>
                <small>{item.ratio}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="post-form-section">
          <div className="post-section-heading">
            <span>03</span>
            <div><h2>Set the direction</h2><p>A clear brief makes a stronger post.</p></div>
          </div>
          <div className="post-brief-fields">
            <label className="post-field">
              <span>Campaign name</span>
              <input maxLength={80} onChange={(event) => setCampaign(event.target.value)} placeholder="e.g. Summer, your way" required value={campaign} />
            </label>
            <label className="post-field">
              <span>Product</span>
              <input maxLength={80} onChange={(event) => setProduct(event.target.value)} placeholder="e.g. The everyday tote" required value={product} />
            </label>
          </div>
          <div className="post-field">
            <span>Post goal</span>
            <div className="post-chip-list">
              {postGoals.map((item) => (
                <button aria-pressed={goal === item} className={`post-chip${goal === item ? " selected" : ""}`} key={item} onClick={() => setGoal(item)} type="button">{item}</button>
              ))}
            </div>
          </div>
          <div className="post-field">
            <span>Visual direction · scene</span>
            <div className="post-scene-list">
              {visualScenes.map((item) => (
                <button aria-pressed={scene === item} className={`post-scene-chip scene-${item.toLowerCase()}${scene === item ? " selected" : ""}`} key={item} onClick={() => setScene(item)} type="button">
                  <i aria-hidden="true" />{item}
                </button>
              ))}
            </div>
          </div>
          <div className="post-field">
            <span>Reference images <small>Optional · up to 3</small></span>
            <div className="post-reference-row">
              {references.map((reference) => (
                <div className="post-reference-thumb" key={reference.id}>
                  <Image alt={reference.fileName} fill sizes="70px" src={reference.previewUrl} unoptimized />
                  <button aria-label={`Remove ${reference.fileName}`} onClick={() => removeReference(reference.id)} type="button">×</button>
                </div>
              ))}
              {references.length < 3 && (
                <button className="post-reference-add" onClick={() => fileInputRef.current?.click()} type="button">
                  <span>＋</span><strong>Add reference</strong><small>{references.length}/3</small>
                </button>
              )}
              <input
                accept="image/jpeg,image/png,image/webp"
                className="visually-hidden"
                multiple
                onChange={handleReferenceFiles}
                ref={fileInputRef}
                type="file"
              />
            </div>
            <small className="post-reference-hint">Images are compressed in your browser and sent securely for generation.</small>
          </div>
        </section>

        <section className="post-form-section">
          <div className="post-section-heading">
            <span>04</span>
            <div><h2>Caption &amp; copy</h2><p>Give the words their own personality.</p></div>
          </div>
          <div className="post-field">
            <span>Tone</span>
            <div className="post-chip-list">
              {captionTones.map((item) => (
                <button aria-pressed={tone === item} className={`post-chip${tone === item ? " selected" : ""}`} key={item} onClick={() => setTone(item)} type="button">{item}</button>
              ))}
            </div>
          </div>
          <div className="post-copy-fields">
            <label className="post-field">
              <span>Call to action</span>
              <select onChange={(event) => setCallToAction(event.target.value as CallToAction)} value={callToAction}>
                {callToActions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="post-field">
              <span>Language</span>
              <select onChange={(event) => setLanguage(event.target.value as PostLanguage)} value={language}>
                {postLanguages.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="post-field post-hashtag-field">
              <span>Hashtags</span>
              <select onChange={(event) => setHashtagCount(Number(event.target.value))} value={hashtagCount}>
                {[0, 3, 5, 8, 12, 15, 20].map((count) => <option key={count} value={count}>{count} tags</option>)}
              </select>
            </label>
          </div>
        </section>

        {errorMessage && <div className="post-composer-error" role="alert">{errorMessage}</div>}
        {!imageGenerationConfigured && (
          <div className="post-composer-hint" role="status">
            Add <code>CLOUDFLARE_ACCOUNT_ID</code> and <code>CLOUDFLARE_API_TOKEN</code> to enable image generation.
          </div>
        )}
        <button
          className="button button-dark post-generate-button"
          disabled={!selectedCreator || !imageGenerationConfigured || isGenerating}
          type="submit"
        >
          {isGenerating
            ? <><span className="builder-spinner" /> Creating your post with FLUX.2 Klein…</>
            : <>✧ Generate post <span>↗</span></>}
        </button>
        <p className="post-generation-note">FLUX.2 Klein makes the visual. Captions and hashtags are editable before saving.</p>
      </form>

      <aside aria-live="polite" className="post-preview-panel">
        <div className="post-preview-heading">
          <div><span className="section-kicker">THE FINISHED FEED</span><h2>Post preview</h2></div>
          <span className="post-preview-platform">
            {selectedPlatforms.length
              ? selectedPlatforms
                  .map((selected) => {
                    const item = platforms.find((candidate) => candidate.id === selected);
                    return item ? `${item.icon} ${item.label}` : selected;
                  })
                  .join(" · ")
              : "Draft · no platform"}
          </span>
        </div>

        <article className={`social-post-card${platform ? ` social-post-${platform}` : ""}`}>
          <header className="social-post-header">
            <span className="social-post-avatar">
              {selectedCreator?.portraitUrl ? (
                <Image alt="" fill sizes="38px" src={selectedCreator.portraitUrl} unoptimized />
              ) : "✧"}
            </span>
            <span className="social-post-account">
              <strong>{platformHandle(selectedCreator?.name ?? "yourcreator")}</strong>
              <small>{preview ? "Sponsored · Just now" : "Preview · Your creator"}</small>
            </span>
            <span className="social-post-menu">•••</span>
          </header>

          <div className={`social-post-art post-art-${format}`}>
            {preview ? (
              <Image
                alt={`${preview.modelName}'s generated ${format} social post`}
                className="social-post-generated-image"
                fill
                sizes="(max-width: 1000px) 90vw, 500px"
                src={preview.imageUrl}
                unoptimized
              />
            ) : (
              <div className={`post-art-placeholder scene-${scene.toLowerCase()}`}>
                {selectedCreator?.portraitUrl && (
                  <Image alt="" className="post-art-model-image" fill sizes="500px" src={selectedCreator.portraitUrl} unoptimized />
                )}
                <span className="post-art-kicker">{campaign || "YOUR CAMPAIGN"}</span>
                <strong>{product || "A little something special"}</strong>
                <small>{scene.toUpperCase()} · {format.toUpperCase()}</small>
                <i aria-hidden="true">✧</i>
              </div>
            )}
            {isGenerating && <div className="post-image-loading"><span className="builder-spinner" /> Cloudflare is composing your image…</div>}
          </div>

          <div className="social-post-actions">
            <span aria-label="Like">♡</span><span aria-label="Comment">◯</span><span aria-label="Share">➤</span><span aria-label="Save post">♧</span>
          </div>
          <div className="social-post-copy">
            <strong>{selectedCreator?.name ?? "Your AI creator"}</strong>
            <label className="visually-hidden" htmlFor="post-caption">Caption preview</label>
            <textarea
              id="post-caption"
              maxLength={600}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Your caption will appear here once you add a campaign brief."
              rows={3}
              value={captionText}
            />
            {hashtags.length > 0 && <p className="social-post-hashtags">{hashtags.join(" ")}</p>}
            <small className="social-post-timestamp">A PREVIEW OF YOUR NEXT POST</small>
          </div>
        </article>

        {preview && (
          <PostActionPanel
            actionMode={actionMode}
            canSchedule={selectedPlatformsAreConnected}
            isSaving={isSaving}
            mode="create"
            note={
              selectedPlatformsAreConnected
                ? "Saving stores your post in Postly. Scheduling records it for every selected platform; it won’t publish automatically."
                : platformToConnect
                  ? "Connect every selected platform to enable scheduling, or save this post as a draft."
                  : "No destination is selected. This post can only be saved as a draft."
            }
            onActionModeChange={setActionMode}
            onPrimaryAction={() =>
              void handleSavePost(actionMode === "schedule" ? "scheduled" : "ready_to_publish")
            }
            onSaveDraft={() => void handleSavePost("draft")}
            onScheduleTimeChange={setScheduleTime}
            platformLabel={
              selectedPlatforms.length
                ? selectedPlatforms
                    .map((selected) => platforms.find((item) => item.id === selected)?.label ?? selected)
                    .join(", ")
                : "No platform selected"
            }
            scheduleTime={scheduleTime}
          />
        )}

        {preview && (
          <div className="post-preview-success"><span>✓</span> Image generated with FLUX.2 Klein {preview.aspectRatio} · Caption is ready to edit.</div>
        )}
        {!preview && !isGenerating && (
          <div className="post-preview-tip"><span>✧</span><p>Select a saved creator, shape the brief, then generate to see your finished social creative here.</p></div>
        )}
        <div className="post-preview-footer"><span>✦</span> AI-generated visual · Not posted yet</div>

        {saveNotice && (
          <dialog
            aria-labelledby="post-save-dialog-title"
            className="post-save-dialog"
            onCancel={() => setSaveNotice(null)}
            ref={saveDialogRef}
          >
            <button
              aria-label="Close confirmation"
              className="post-save-dialog-close"
              onClick={dismissSaveNotice}
              type="button"
            >
              ×
            </button>
            <div aria-hidden="true" className="post-save-dialog-icon">✓</div>
            <span className="post-save-dialog-eyebrow">
              {saveNotice.status === "scheduled" ? "SCHEDULE CONFIRMED" : "SAVED TO POSTLY"}
            </span>
            <h2 id="post-save-dialog-title">
              {saveNotice.status === "draft"
                ? "Draft saved"
                : saveNotice.status === "scheduled"
                  ? "Post scheduled"
                  : "Post saved"}
            </h2>
            <p className="post-save-dialog-description">
              {saveNotice.status === "draft"
                ? `Your post${saveNotice.platforms.length ? ` for ${saveNotice.platforms.map((selected) => platforms.find((item) => item.id === selected)?.label ?? selected).join(", ")}` : ""} and image are safely saved as a draft.`
                : saveNotice.status === "scheduled"
                  ? `Your post for ${saveNotice.platforms.map((selected) => platforms.find((item) => item.id === selected)?.label ?? selected).join(", ")} is saved for ${new Date(saveNotice.scheduledAt ?? "").toLocaleString()}. It won’t publish automatically until a social account and scheduler are connected.`
                  : "Your post is saved in Postly and ready for publishing. It was not posted because social account integrations are not connected."}
            </p>
            <div className="post-save-dialog-actions">
              <Link className="button button-outline" href="/dashboard/studio?view=posts">
                View saved posts <span aria-hidden="true">↗</span>
              </Link>
              <button className="button button-dark" onClick={dismissSaveNotice} type="button">
                Keep creating
              </button>
            </div>
          </dialog>
        )}
      </aside>
    </div>
  );
}
