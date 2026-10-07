"use client";

import type { ReactNode } from "react";

type PostStatus = "draft" | "scheduled";
type CreateActionMode = "publish" | "schedule";

type PostActionPanelProps = {
  mode: "create" | "manage";
  platformLabel: string;
  scheduleTime: string;
  onScheduleTimeChange: (value: string) => void;
  isSaving: boolean;
  canSchedule?: boolean;
  errorMessage?: string;
  actionMode?: CreateActionMode;
  onActionModeChange?: (mode: CreateActionMode) => void;
  status?: PostStatus;
  onSaveDraft: () => void;
  onPrimaryAction: () => void;
  onMoveToDraft?: () => void;
  note?: ReactNode;
};

export function PostActionPanel({
  mode,
  platformLabel,
  scheduleTime,
  onScheduleTimeChange,
  isSaving,
  canSchedule = true,
  errorMessage,
  actionMode = "schedule",
  onActionModeChange,
  status,
  onSaveDraft,
  onPrimaryAction,
  onMoveToDraft,
  note,
}: PostActionPanelProps) {
  const isManagingSchedule = mode === "manage";

  return (
    <section aria-label={isManagingSchedule ? "Post actions" : "Save or schedule post"} className="post-delivery-panel">
      <div className="post-delivery-heading">
        <h3>
          {isManagingSchedule
            ? "Post actions"
            : canSchedule
              ? "Save or schedule"
              : "Save as draft"}
        </h3>
        <span>{platformLabel}</span>
      </div>
      {!isManagingSchedule && canSchedule && (
        <div aria-label="Publishing timing" className="post-publish-mode">
          <button
            aria-pressed={actionMode === "publish"}
            className={actionMode === "publish" ? "selected" : ""}
            onClick={() => onActionModeChange?.("publish")}
            type="button"
          >
            Publish now
          </button>
          <button
            aria-pressed={actionMode === "schedule"}
            className={actionMode === "schedule" ? "selected" : ""}
            onClick={() => onActionModeChange?.("schedule")}
            type="button"
          >
            Schedule later
          </button>
        </div>
      )}
      {((isManagingSchedule && canSchedule) || (canSchedule && actionMode === "schedule")) && (
        <label className="post-schedule-field">
          <span>Date and time</span>
          <input
            onChange={(event) => onScheduleTimeChange(event.target.value)}
            type="datetime-local"
            value={scheduleTime}
          />
        </label>
      )}
      {note && <p className="post-delivery-note">{note}</p>}
      {errorMessage && <p className="post-action-error" role="alert">{errorMessage}</p>}
      <div className={`post-delivery-actions${isManagingSchedule ? ` post-manage-actions${status === "draft" ? " post-manage-draft" : ""}` : ""}`}>
        {isManagingSchedule ? (
          <>
            {status === "scheduled" && (
              <button
                className="post-save-draft-button"
                disabled={isSaving}
                onClick={onMoveToDraft}
                type="button"
              >
                Move to draft
              </button>
            )}
            {canSchedule && (
              <button
                className="button button-dark post-save-primary-button"
                disabled={isSaving}
                onClick={onPrimaryAction}
                type="button"
              >
                {isSaving ? "Saving…" : status === "scheduled" ? "Update schedule" : "Schedule post"}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              className="post-save-draft-button"
              disabled={isSaving}
              onClick={onSaveDraft}
              type="button"
            >
              {isSaving ? "Saving…" : "Save as draft"}
            </button>
            {canSchedule && (
              <button
                className="button button-dark post-save-primary-button"
                disabled={isSaving}
                onClick={onPrimaryAction}
                type="button"
              >
                {isSaving ? "Saving…" : actionMode === "schedule" ? "Schedule post" : "Publish now"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
