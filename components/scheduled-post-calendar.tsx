"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

export type CalendarScheduledPost = {
  id: string;
  modelName: string;
  platform: string | null;
  platforms: string[];
  format: string;
  campaign: string;
  product: string;
  goal: string;
  scene: string;
  tone: string;
  callToAction: string;
  language: string;
  caption: string;
  hashtags: string[];
  imageUrl: string;
  scheduledAt: string;
};

export type CalendarDraftPost = {
  id: string;
  modelName: string;
  platform: string | null;
  platforms: string[];
  format: string;
  campaign: string;
  product: string;
  goal: string;
  scene: string;
  tone: string;
  callToAction: string;
  language: string;
  caption: string;
  hashtags: string[];
  imageUrl: string;
  createdAt: string;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function monthLabel(year: number, month: number, isMounted: boolean) {
  return new Intl.DateTimeFormat(isMounted ? undefined : "en-US", {
    month: "long",
    year: "numeric",
    ...(isMounted ? {} : { timeZone: "UTC" }),
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultScheduleTime(date: string) {
  const now = new Date();
  if (dateKey(now) !== date) {
    return "09:00";
  }

  const soon = new Date(now.getTime() + 30 * 60 * 1000);
  if (dateKey(soon) !== date) {
    return "23:59";
  }

  return `${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;
}

function toLocalDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function isScheduleEditable(scheduledAt: string) {
  return new Date(scheduledAt).getTime() > Date.now();
}

function calendarDateKey(date: Date, isMounted: boolean) {
  if (isMounted) {
    return dateKey(date);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  isMounted: boolean,
) {
  const formattedDate = isMounted
    ? date
    : new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  return new Intl.DateTimeFormat(isMounted ? undefined : "en-US", {
    ...options,
    ...(isMounted ? {} : { timeZone: "UTC" }),
  }).format(formattedDate);
}

function formatTime(value: string, isMounted: boolean) {
  return new Intl.DateTimeFormat(isMounted ? undefined : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(isMounted ? {} : { timeZone: "UTC" }),
  }).format(new Date(value));
}

function previousMonthLink(year: number, month: number) {
  const previous = new Date(year, month - 2, 1);
  return `/dashboard/calendar?month=${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonthLink(year: number, month: number) {
  const next = new Date(year, month, 1);
  return `/dashboard/calendar?month=${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function ScheduledPostCalendar({
  month,
  posts,
  draftPosts,
}: {
  month: string;
  posts: CalendarScheduledPost[];
  draftPosts: CalendarDraftPost[];
}) {
  const router = useRouter();
  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const scheduleDialogRef = useRef<HTMLDialogElement>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [selectedDraft, setSelectedDraft] = useState<CalendarDraftPost | null>(null);
  const [selectedScheduledPost, setSelectedScheduledPost] =
    useState<CalendarScheduledPost | null>(null);
  const [failedScheduledImageId, setFailedScheduledImageId] = useState<string | null>(null);
  const [canEditScheduledPost, setCanEditScheduledPost] = useState(false);
  const [scheduledCaption, setScheduledCaption] = useState("");
  const [campaign, setCampaign] = useState("");
  const [product, setProduct] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(year, monthNumber - 1, 1);
  const firstVisibleDate = new Date(year, monthNumber - 1, -monthStart.getDay() + 1);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDate);
    date.setDate(firstVisibleDate.getDate() + index);
    return date;
  });
  const postsByDate = new Map<string, CalendarScheduledPost[]>();

  for (const post of posts) {
    const key = calendarDateKey(new Date(post.scheduledAt), isMounted);
    const dayPosts = postsByDate.get(key) ?? [];
    dayPosts.push(post);
    postsByDate.set(key, dayPosts);
  }

  const scheduledThisMonth = posts.filter((post) => {
    const date = new Date(post.scheduledAt);
    return (isMounted ? date.getFullYear() : date.getUTCFullYear()) === year &&
      (isMounted ? date.getMonth() : date.getUTCMonth()) === monthNumber - 1;
  }).length;
  const selectedScheduleDate = scheduleDate
    ? new Date(`${scheduleDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  function openScheduleDialog(date: string) {
    setScheduleDate(date);
    setScheduleTime(defaultScheduleTime(date));
    setSelectedDraft(null);
    setSelectedScheduledPost(null);
    setCanEditScheduledPost(false);
    setScheduleError("");
    scheduleDialogRef.current?.showModal();
  }

  function openScheduledPost(post: CalendarScheduledPost) {
    const localScheduleTime = toLocalDateTimeValue(new Date(post.scheduledAt));
    setScheduleDate(localScheduleTime.slice(0, 10));
    setScheduleTime(localScheduleTime.slice(11, 16));
    setSelectedDraft(null);
    setSelectedScheduledPost(post);
    setFailedScheduledImageId(null);
    setScheduledCaption(post.caption);
    setCanEditScheduledPost(isScheduleEditable(post.scheduledAt));
    setScheduleError("");
    scheduleDialogRef.current?.showModal();
  }

  function selectDraft(draft: CalendarDraftPost) {
    setSelectedDraft(draft);
    setCampaign(draft.campaign);
    setProduct(draft.product);
    setCaption(draft.caption);
    setHashtags(draft.hashtags.join(", "));
    setScheduleError("");
  }

  async function scheduleSelectedDraft() {
    if (!selectedDraft) {
      setScheduleError("Select a draft to schedule.");
      return;
    }

    const [yearValue, monthValue, dayValue] = scheduleDate.split("-").map(Number);
    const [hour, minute] = scheduleTime.split(":").map(Number);
    const selectedDateTime = new Date(yearValue, monthValue - 1, dayValue, hour, minute);

    if (
      !scheduleTime ||
      !Number.isFinite(selectedDateTime.getTime()) ||
      dateKey(selectedDateTime) !== scheduleDate ||
      selectedDateTime.getTime() <= Date.now()
    ) {
      setScheduleError("Choose a time on this day that is still in the future.");
      return;
    }

    const hashtagValues = hashtags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setIsScheduling(true);
    setScheduleError("");
    try {
      const response = await fetch(`/api/posts/${selectedDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "scheduled",
          scheduledAt: selectedDateTime.toISOString(),
          campaign,
          product,
          caption,
          hashtags: hashtagValues,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "We couldn’t schedule this post. Please try again.");
      }

      scheduleDialogRef.current?.close();
      setSelectedDraft(null);
      router.refresh();
    } catch (error) {
      setScheduleError(
        error instanceof Error ? error.message : "We couldn’t schedule this post. Please try again.",
      );
    } finally {
      setIsScheduling(false);
    }
  }

  async function updateScheduledPostTime() {
    if (!selectedScheduledPost) {
      return;
    }

    const [yearValue, monthValue, dayValue] = scheduleDate.split("-").map(Number);
    const [hour, minute] = scheduleTime.split(":").map(Number);
    const selectedDateTime = new Date(yearValue, monthValue - 1, dayValue, hour, minute);

    if (
      !scheduleDate ||
      !scheduleTime ||
      !Number.isFinite(selectedDateTime.getTime()) ||
      dateKey(selectedDateTime) !== scheduleDate ||
      selectedDateTime.getTime() <= Date.now()
    ) {
      setScheduleError("Choose a date and time that is still in the future.");
      return;
    }

    setIsScheduling(true);
    setScheduleError("");
    try {
      const response = await fetch(`/api/posts/${selectedScheduledPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "scheduled",
          scheduledAt: selectedDateTime.toISOString(),
          caption: scheduledCaption,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "We couldn’t update this schedule. Please try again.");
      }

      scheduleDialogRef.current?.close();
      setSelectedScheduledPost(null);
      router.refresh();
    } catch (error) {
      setScheduleError(
        error instanceof Error ? error.message : "We couldn’t update this schedule. Please try again.",
      );
    } finally {
      setIsScheduling(false);
    }
  }

  return (
    <div className="dashboard-page-content calendar-page">
      <section className="calendar-heading">
        <div>
          <span className="section-kicker">YOUR CONTENT PLAN</span>
          <h1>Content calendar</h1>
          <p>See what’s scheduled and find the right day for your next post.</p>
        </div>
        <Link className="button button-dark calendar-create-button" href="/dashboard/studio/posts/new">
          <span aria-hidden="true">＋</span> Create post
        </Link>
      </section>

      <section aria-label="Scheduled posts calendar" className="calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-month-copy">
            <h2>{monthLabel(year, monthNumber, isMounted)}</h2>
            <span>{scheduledThisMonth} scheduled {scheduledThisMonth === 1 ? "post" : "posts"}</span>
          </div>
          <div aria-label="Calendar month navigation" className="calendar-month-navigation">
            <Link aria-label="Previous month" href={previousMonthLink(year, monthNumber)}>‹</Link>
            <Link className="calendar-today-link" href="/dashboard/calendar">Today</Link>
            <Link aria-label="Next month" href={nextMonthLink(year, monthNumber)}>›</Link>
          </div>
        </div>

        <div className="calendar-scroll-region">
          <div aria-hidden="true" className="calendar-weekdays">
            {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="calendar-grid">
            {days.map((date) => {
              const key = dateKey(date);
              const isCurrentMonth = date.getMonth() === monthNumber - 1;
              const todayKey = calendarDateKey(new Date(), isMounted);
              const canSchedule = !isMounted || key >= todayKey;
              const dayPosts = postsByDate.get(key) ?? [];

              return (
                <article
                  aria-label={`${formatCalendarDate(date, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  }, isMounted)}${dayPosts.length ? `, ${dayPosts.length} scheduled ${dayPosts.length === 1 ? "post" : "posts"}` : ""}`}
                  className={`calendar-day${isCurrentMonth ? "" : " calendar-day-outside"}${isMounted && key === todayKey ? " calendar-day-today" : ""}`}
                  key={key}
                >
                  <div className="calendar-day-header">
                    <span className="calendar-day-number">{date.getDate()}</span>
                    {canSchedule && (
                      <button
                        aria-label={`Schedule a post for ${formatCalendarDate(date, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }, isMounted)}`}
                        className="calendar-add-post"
                        onClick={() => openScheduleDialog(key)}
                        type="button"
                      >
                        <span aria-hidden="true">＋</span> Add new post
                      </button>
                    )}
                  </div>
                  <div className="calendar-day-posts">
                    {dayPosts.map((post) => {
                      const postPlatforms = post.platforms.length
                        ? post.platforms
                        : post.platform
                          ? [post.platform]
                          : [];
                      const title = post.campaign || post.product || post.modelName;

                      return (
                        <button
                          aria-label={`View scheduled post ${title}, scheduled for ${formatTime(post.scheduledAt, isMounted)}`}
                          className="calendar-post"
                          key={post.id}
                          onClick={() => openScheduledPost(post)}
                          type="button"
                          title={post.caption}
                        >
                          <span className="calendar-post-time">{formatTime(post.scheduledAt, isMounted)}</span>
                          <strong>{title}</strong>
                          <span className="calendar-post-platforms">
                            {postPlatforms.length ? postPlatforms.join(", ") : "Scheduled"}
                          </span>
                          <span className="calendar-post-status">Scheduled</span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {scheduledThisMonth === 0 && (
          <p className="calendar-empty-hint">
            Nothing scheduled this month yet. Hover over a day and choose <strong>Add new post</strong> to get started.
          </p>
        )}
      </section>

      <dialog
        aria-labelledby="calendar-schedule-dialog-title"
        className={`calendar-schedule-dialog${selectedScheduledPost ? " calendar-schedule-dialog-edit" : ""}`}
        onClick={(event) => {
          if (event.target === scheduleDialogRef.current) {
            scheduleDialogRef.current.close();
          }
        }}
        onClose={() => {
          setSelectedDraft(null);
          setSelectedScheduledPost(null);
        }}
        ref={scheduleDialogRef}
      >
        <div className="calendar-dialog-content">
          <button
            aria-label="Close schedule dialog"
            className="calendar-dialog-close"
            onClick={() => scheduleDialogRef.current?.close()}
            type="button"
          >
            ×
          </button>
          {selectedScheduledPost ? (
            <header className="calendar-scheduled-dialog-heading">
              <h2 id="calendar-schedule-dialog-title">Post Details</h2>
              <p>Modify scheduled post settings</p>
            </header>
          ) : (
            <>
              <span className="section-kicker">YOUR CONTENT PLAN</span>
              <h2 id="calendar-schedule-dialog-title">Add a post to your calendar</h2>
              <p className="calendar-dialog-intro">
                Choose a saved draft, review or edit its details, then set a time for{" "}
                {new Date(`${scheduleDate}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}.
              </p>
            </>
          )}

          {selectedScheduledPost ? (
            <div className="calendar-scheduled-details">
              <div className="calendar-draft-detail-image">
                {failedScheduledImageId === selectedScheduledPost.id ? (
                  <div className="calendar-post-image-fallback" role="status">
                    The saved post image couldn’t be loaded.
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`${selectedScheduledPost.campaign} post preview`}
                    key={selectedScheduledPost.id}
                    loading="eager"
                    onError={() => setFailedScheduledImageId(selectedScheduledPost.id)}
                    src={selectedScheduledPost.imageUrl}
                  />
                )}
              </div>
              <div className="calendar-scheduled-caption">
                <strong>POST DESCRIPTION</strong>
                {canEditScheduledPost ? (
                  <>
                    <textarea
                      aria-label="Edit post caption"
                      className="calendar-scheduled-caption-editor"
                      maxLength={600}
                      onChange={(event) => setScheduledCaption(event.target.value)}
                      rows={5}
                      value={scheduledCaption}
                    />
                    <small className="calendar-caption-character-count">
                      {scheduledCaption.length}/600 characters
                    </small>
                  </>
                ) : (
                  <p>{selectedScheduledPost.caption || "No caption added."}</p>
                )}
              </div>
              <div className="calendar-scheduled-date-time">
                <label>
                  <span>SCHEDULED DATE</span>
                  <input
                    disabled={!canEditScheduledPost}
                    onChange={(event) => setScheduleDate(event.target.value)}
                    type="date"
                    value={scheduleDate}
                  />
                </label>
                <label>
                  <span>SCHEDULED TIME</span>
                  <input
                    disabled={!canEditScheduledPost}
                    onChange={(event) => setScheduleTime(event.target.value)}
                    type="time"
                    value={scheduleTime}
                  />
                </label>
              </div>
              {!canEditScheduledPost && (
                <p className="calendar-schedule-readonly-note" role="status">
                  This post is no longer editable because its scheduled time has passed.
                </p>
              )}
            </div>
          ) : (
          <div className="calendar-dialog-layout">
            <section aria-label="Available draft posts" className="calendar-draft-picker">
              <div className="calendar-dialog-section-heading">
                <h3>Choose a draft</h3>
                <span>{draftPosts.length}</span>
              </div>
              {draftPosts.length ? (
                <div className="calendar-draft-list">
                  {draftPosts.map((draft) => (
                    <button
                      aria-pressed={selectedDraft?.id === draft.id}
                      className={`calendar-draft-option${selectedDraft?.id === draft.id ? " selected" : ""}`}
                      key={draft.id}
                      onClick={() => selectDraft(draft)}
                      type="button"
                    >
                      <span className="calendar-draft-thumb">
                        <Image alt="" fill sizes="54px" src={draft.imageUrl} unoptimized />
                      </span>
                      <span className="calendar-draft-option-copy">
                        <strong>{draft.campaign || "Untitled campaign"}</strong>
                        <span>{draft.product} · {draft.modelName}</span>
                        <small>{draft.caption || "No caption yet"}</small>
                      </span>
                      <span aria-hidden="true" className="calendar-draft-select-mark">
                        {selectedDraft?.id === draft.id ? "✓" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="calendar-no-drafts">
                  <span aria-hidden="true">✧</span>
                  <p>You don’t have any saved drafts yet.</p>
                  <Link href="/dashboard/studio/posts/new">Create a post</Link>
                </div>
              )}
            </section>

            <section aria-label="Selected draft details" className="calendar-draft-details">
              {selectedDraft ? (
                <>
                  <div className="calendar-draft-detail-image">
                    <Image
                      alt={`${selectedDraft.campaign} post preview`}
                      fill
                      sizes="(max-width: 700px) 100vw, 420px"
                      src={selectedDraft.imageUrl}
                      unoptimized
                    />
                  </div>
                  <div className="calendar-draft-meta">
                    <span>{selectedDraft.modelName}</span>
                    <span>{selectedDraft.format.replaceAll("_", " ")}</span>
                    <span>{selectedDraft.platforms.length
                      ? selectedDraft.platforms.join(", ")
                      : selectedDraft.platform ?? "No platform selected"}</span>
                  </div>
                  <div className="calendar-draft-info-grid">
                    <span><small>Goal</small><strong>{selectedDraft.goal}</strong></span>
                    <span><small>Scene</small><strong>{selectedDraft.scene}</strong></span>
                    <span><small>Tone</small><strong>{selectedDraft.tone}</strong></span>
                    <span><small>Call to action</small><strong>{selectedDraft.callToAction}</strong></span>
                    <span><small>Language</small><strong>{selectedDraft.language}</strong></span>
                  </div>
                  <div className="calendar-draft-edit-fields">
                    <label>
                      <span>Campaign</span>
                      <input maxLength={80} onChange={(event) => setCampaign(event.target.value)} value={campaign} />
                    </label>
                    <label>
                      <span>Product</span>
                      <input maxLength={80} onChange={(event) => setProduct(event.target.value)} value={product} />
                    </label>
                    <label>
                      <span>Post description / caption</span>
                      <textarea maxLength={600} onChange={(event) => setCaption(event.target.value)} rows={5} value={caption} />
                      <small>{caption.length}/600 characters</small>
                    </label>
                    <label>
                      <span>Hashtags <small>Separate with commas</small></span>
                      <input
                        onChange={(event) => setHashtags(event.target.value)}
                        placeholder="#style, #summer"
                        value={hashtags}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <div className="calendar-draft-unselected">
                  <span aria-hidden="true">◷</span>
                  <p>Select a draft to see its full post details and make edits before scheduling.</p>
                </div>
              )}
            </section>
          </div>
          )}

          {!selectedScheduledPost && (
            <div className="calendar-dialog-schedule-row">
              <div className="calendar-dialog-date-summary">
                <span>Schedule date</span>
                <strong>{selectedScheduleDate}</strong>
              </div>
              <label>
                <span>Time</span>
                <input
                  onChange={(event) => setScheduleTime(event.target.value)}
                  type="time"
                  value={scheduleTime}
                />
              </label>
            </div>
          )}
          {scheduleError && <p className="calendar-schedule-error" role="alert">{scheduleError}</p>}
          <div className="calendar-dialog-actions">
            <button
              className="button button-outline"
              disabled={isScheduling}
              onClick={() => scheduleDialogRef.current?.close()}
              type="button"
            >
              Cancel
            </button>
            {selectedScheduledPost ? (
              canEditScheduledPost && (
                <button
                  className="button button-dark"
                  disabled={isScheduling}
                  onClick={() => void updateScheduledPostTime()}
                  type="button"
                >
                  {isScheduling ? "Saving…" : "Update schedule"}
                </button>
              )
            ) : (
              <button
                className="button button-dark"
                disabled={isScheduling || !selectedDraft}
                onClick={() => void scheduleSelectedDraft()}
                type="button"
              >
                {isScheduling ? "Scheduling…" : "Schedule post"}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
