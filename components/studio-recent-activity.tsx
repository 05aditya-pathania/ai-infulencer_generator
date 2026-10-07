"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { platforms } from "@/lib/posts/options";
import { PostActionPanel } from "@/components/post-action-panel";

export type StudioPost = {
  id: string;
  model_name: string;
  platform: string | null;
  platforms: string[];
  format: string;
  campaign: string;
  product: string;
  goal: string;
  scene: string;
  tone: string;
  call_to_action: string;
  language: string;
  caption: string;
  hashtags: string[];
  imageUrl: string | null;
  status: "draft" | "scheduled";
  scheduled_at: string | null;
  created_at: string;
};

type StudioRecentActivityProps = {
  posts: StudioPost[];
  connectedPlatforms: string[];
  page: number;
  pageCount: number;
  totalCount: number;
  view: "models" | "posts";
};

function toLocalDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function displayDate(date: string) {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(date))} UTC`;
}

function displayLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPlatformIds(post: StudioPost) {
  return post.platforms.length
    ? post.platforms
    : post.platform
      ? [post.platform]
      : [];
}

function getPlatformLabels(post: StudioPost) {
  const selectedPlatforms = getPlatformIds(post);
  return selectedPlatforms.length
    ? selectedPlatforms.map((id) => platforms.find((platform) => platform.id === id)?.label ?? displayLabel(id))
    : ["No platform selected"];
}

export function StudioRecentActivity({
  posts,
  connectedPlatforms,
  page,
  pageCount,
  totalCount,
  view,
}: StudioRecentActivityProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedPost, setSelectedPost] = useState<StudioPost | null>(null);
  const [scheduleTime, setScheduleTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function openPost(post: StudioPost) {
    setSelectedPost(post);
    setScheduleTime(
      post.scheduled_at ? toLocalDateTimeValue(new Date(post.scheduled_at)) : "",
    );
    setErrorMessage("");
    dialogRef.current?.showModal();
  }

  async function updatePost(status: "draft" | "scheduled") {
    if (!selectedPost) return;

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
      const response = await fetch(`/api/posts/${selectedPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, scheduledAt }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "We couldn’t update this post. Please try again.");
      }
      dialogRef.current?.close();
      setSelectedPost(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn’t update this post. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const platformLabels = selectedPost ? getPlatformLabels(selectedPost) : [];
  const platformLabel = platformLabels.join(", ");
  const selectedPostPlatforms = selectedPost ? getPlatformIds(selectedPost) : [];
  const canScheduleSelectedPost =
    selectedPostPlatforms.length > 0 &&
    selectedPostPlatforms.every((platform) => connectedPlatforms.includes(platform === "twitter" ? "x" : platform));

  return (
    <section aria-labelledby="studio-recent-activity-heading" className="studio-recent-activity">
      <div className="studio-recent-heading">
        <div>
          <span className="dashboard-panel-eyebrow">YOUR LATEST WORK</span>
          <h2 id="studio-recent-activity-heading">Recent activity</h2>
        </div>
        <span className="studio-recent-count">{totalCount} {totalCount === 1 ? "post" : "posts"}</span>
      </div>

      {posts.length > 0 ? (
        <>
          <div className="studio-post-list">
            {posts.map((post) => (
              <button
                aria-label={`Open ${post.campaign} ${post.status} post`}
                className="studio-post-item"
                key={post.id}
                onClick={() => openPost(post)}
                type="button"
              >
                <span className="studio-post-thumbnail">
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={post.imageUrl} />
                  ) : (
                    <span aria-hidden="true">✧</span>
                  )}
                </span>
                <span className="studio-post-copy">
                  <span className="studio-post-title">{post.campaign || post.product}</span>
                  <span className="studio-post-subtitle">{post.model_name} · {getPlatformLabels(post).join(", ")} · {displayLabel(post.format)}</span>
                </span>
                <span className={`studio-post-status studio-post-status-${post.status}`}>{post.status}</span>
                <span className="studio-post-date">
                  {post.status === "scheduled" && post.scheduled_at
                    ? `Scheduled ${displayDate(post.scheduled_at)}`
                    : `Created ${displayDate(post.created_at)}`}
                </span>
                <span aria-hidden="true" className="studio-post-open">↗</span>
              </button>
            ))}
          </div>

          {pageCount > 1 && (
            <nav aria-label="Recent activity pages" className="studio-post-pagination">
              <span>Page {page} of {pageCount}</span>
              <div>
                {page > 1 && (
                  <Link href={`/dashboard/studio?view=${view}&page=${page - 1}`}>Previous</Link>
                )}
                {page < pageCount && (
                  <Link href={`/dashboard/studio?view=${view}&page=${page + 1}`}>Next</Link>
                )}
              </div>
            </nav>
          )}
        </>
      ) : (
        <div className="studio-activity-empty">
          <span aria-hidden="true">✧</span>
          <p>Your drafts and scheduled posts will show up here.</p>
        </div>
      )}

      <dialog
        aria-labelledby="studio-post-dialog-title"
        className="studio-post-dialog"
        onClose={() => setSelectedPost(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        ref={dialogRef}
      >
        {selectedPost && (
          <div className="studio-post-dialog-content">
            <button
              aria-label="Close post details"
              className="studio-post-dialog-close"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              ×
            </button>
            <div className="studio-post-dialog-image">
              {selectedPost.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`${selectedPost.campaign} post thumbnail`} src={selectedPost.imageUrl} />
              ) : (
                <span aria-hidden="true">✧</span>
              )}
            </div>
            <div className="studio-post-dialog-details">
              <span className={`studio-post-status studio-post-status-${selectedPost.status}`}>{selectedPost.status}</span>
              <h2 id="studio-post-dialog-title">{selectedPost.campaign}</h2>
              <p className="studio-post-dialog-product">{selectedPost.product} · {selectedPost.model_name}</p>
              <dl className="studio-post-metadata">
                <div><dt>Platforms</dt><dd>{platformLabel}</dd></div>
                <div><dt>Format</dt><dd>{displayLabel(selectedPost.format)}</dd></div>
                <div><dt>Goal</dt><dd>{selectedPost.goal}</dd></div>
                <div><dt>Scene</dt><dd>{selectedPost.scene}</dd></div>
                <div><dt>Tone</dt><dd>{selectedPost.tone}</dd></div>
                <div><dt>Language</dt><dd>{selectedPost.language}</dd></div>
                <div><dt>Call to action</dt><dd>{selectedPost.call_to_action}</dd></div>
                <div>
                  <dt>{selectedPost.status === "scheduled" ? "Scheduled for" : "Created"}</dt>
                  <dd>{displayDate(selectedPost.scheduled_at ?? selectedPost.created_at)}</dd>
                </div>
              </dl>
              <div className="studio-post-caption">
                <h3>Caption</h3>
                <p>{selectedPost.caption || "No caption added."}</p>
                {selectedPost.hashtags.length > 0 && <p className="studio-post-hashtags">{selectedPost.hashtags.join(" ")}</p>}
              </div>
              <PostActionPanel
                canSchedule={canScheduleSelectedPost}
                errorMessage={errorMessage}
                isSaving={isSaving}
                mode="manage"
                onPrimaryAction={() => void updatePost("scheduled")}
                onSaveDraft={() => void updatePost("draft")}
                onMoveToDraft={() => void updatePost("draft")}
                onScheduleTimeChange={setScheduleTime}
                platformLabel={platformLabel}
                scheduleTime={scheduleTime}
                status={selectedPost.status}
                note={
                  canScheduleSelectedPost
                    ? undefined
                    : selectedPostPlatforms.length === 0
                      ? "This draft has no destination. Select at least one connected platform when creating a post to enable scheduling."
                      : "Reconnect accounts for every selected platform to enable scheduling."
                }
              />
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
