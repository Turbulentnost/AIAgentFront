import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import MeetingAgentScheduleRecurrenceField from "@/pages/MeetingAgentScheduleRecurrenceField";
import { ScheduleParticipantField } from "@/pages/MeetingAgentScheduleSeriesDrawer";
import type {
  MeetingScheduleRecurrenceFormState,
  MeetingScheduleSeriesSavePayload,
  ScheduledMeetingRead
} from "@/types/meetings";
import { meetingScheduleTypeOptions } from "@/utils/meetingSchedule";
import {
  mapScheduleFormParticipantsToApi,
  mapScheduledMeetingReadToFormParticipants,
  type ScheduleFormParticipant
} from "@/utils/meetingScheduleApi";
import {
  buildRecurrenceRule,
  createDefaultRecurrenceFormState,
  mapScheduledMeetingReadToRecurrenceFormState
} from "@/utils/meetingScheduleRecurrence";

import styles from "./MeetingAgent.module.css";

type Props = {
  open: boolean;
  meetingId: string | null;
  series: ScheduledMeetingRead | null | undefined;
  loadingSeries?: boolean;
  seriesError?: string | null;
  onClose: () => void;
  onSave: (payload: {
    meetingId: string;
    original: ScheduledMeetingRead;
    payload: MeetingScheduleSeriesSavePayload;
  }) => void;
  saving?: boolean;
  saveError?: string | null;
};

type EditFormState = {
  participants: ScheduleFormParticipant[];
  recurrence: MeetingScheduleRecurrenceFormState;
  seriesEndDate: string;
  comment: string;
};

const emptyEditForm = (): EditFormState => ({
  participants: [],
  recurrence: createDefaultRecurrenceFormState(),
  seriesEndDate: "",
  comment: ""
});

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU");
}

export default function MeetingAgentScheduleSeriesEditDrawer({
  open,
  meetingId,
  series,
  loadingSeries = false,
  seriesError = null,
  onClose,
  onSave,
  saving = false,
  saveError = null
}: Props) {
  const [form, setForm] = useState<EditFormState>(emptyEditForm);
  const canCloseRef = useRef(false);
  const baselineSeriesRef = useRef<ScheduledMeetingRead | null>(null);
  const initializedMeetingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      baselineSeriesRef.current = null;
      initializedMeetingIdRef.current = null;
      return;
    }
    if (!series || !meetingId || series.id !== meetingId) return;
    if (initializedMeetingIdRef.current === meetingId) return;

    initializedMeetingIdRef.current = meetingId;
    baselineSeriesRef.current = series;
    setForm({
      participants: mapScheduledMeetingReadToFormParticipants(series),
      recurrence: mapScheduledMeetingReadToRecurrenceFormState(series),
      seriesEndDate: series.series_end_date?.slice(0, 10) ?? "",
      comment: series.payload?.comment ?? ""
    });
  }, [open, series, meetingId]);

  useEffect(() => {
    if (!open) {
      canCloseRef.current = false;
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      canCloseRef.current = true;
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      canCloseRef.current = false;
    };
  }, [open, onClose]);

  const canSave =
    Boolean(meetingId && series) &&
    form.participants.length > 0 &&
    !saving &&
    !loadingSeries &&
    !seriesError;

  if (!open) return null;

  function updateField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleAddParticipant(participant: ScheduleFormParticipant) {
    updateField("participants", [...form.participants, participant]);
  }

  function handleRemoveParticipant(participantId: string) {
    updateField(
      "participants",
      form.participants.filter((item) => item.id !== participantId)
    );
  }

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !canCloseRef.current) return;
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const baseline = baselineSeriesRef.current ?? series;
    if (!canSave || !meetingId || !baseline) return;

    onSave({
      meetingId,
      original: baseline,
      payload: {
        title: baseline.title,
        meeting_category_id: baseline.meeting_category_id,
        manager_user_id: baseline.manager_user_id ?? baseline.manager_position_id,
        responsible_user_id: baseline.responsible_user_id ?? baseline.responsible_position_id,
        manager_position_id: baseline.manager_position_id,
        responsible_position_id: baseline.responsible_position_id,
        meeting_type: baseline.meeting_type,
        status: baseline.status,
        participants: mapScheduleFormParticipantsToApi(form.participants),
        recurrence: buildRecurrenceRule(form.recurrence),
        comment: form.comment.trim() || null,
        series_start_date: baseline.series_start_date,
        series_end_date: form.seriesEndDate || null
      }
    });
  }

  const typeLabel =
    meetingScheduleTypeOptions.find((option) => option.id === series?.meeting_type)?.label ??
    series?.meeting_type;

  return createPortal(
    <div className={styles.scheduleDrawerOverlay} onMouseDown={handleOverlayClick}>
      <aside
        className={styles.scheduleDrawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-edit-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.scheduleDrawerHead}>
          <h2 id="schedule-edit-drawer-title">Изменение серии совещаний</h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        {loadingSeries ? (
          <div className={styles.scheduleEditDrawerBody}>
            <p className={styles.scheduleParticipantEmptyHint}>Загружаем данные серии…</p>
          </div>
        ) : seriesError ? (
          <div className={styles.scheduleEditDrawerBody}>
            <p className={styles.scheduleDrawerError}>{seriesError}</p>
            <div className={styles.scheduleDrawerActions}>
              <button type="button" className={styles.secondaryButton} onClick={onClose}>
                Закрыть
              </button>
            </div>
          </div>
        ) : series ? (
          <form className={styles.scheduleDrawerForm} onSubmit={handleSubmit}>
            <div className={styles.scheduleEditSummary}>
              <p className={styles.scheduleEditSummaryTitle}>{series.title}</p>
              <div className={styles.scheduleEditSummaryMeta}>
                <span>{typeLabel}</span>
                <span>{series.meeting_category_name ?? "—"}</span>
                <span>Руководитель: {series.manager_user_fio ?? series.manager_position_name ?? "—"}</span>
                <span>Ответственный: {series.responsible_user_fio ?? series.responsible_position_name ?? "—"}</span>
                <span>Срок с {formatDateLabel(series.series_start_date)}</span>
              </div>
            </div>

            <div className={styles.scheduleField}>
              <span className={styles.scheduleFieldLabel}>Участники</span>
              <ScheduleParticipantField
                selectedParticipants={form.participants}
                onAdd={handleAddParticipant}
                onRemove={handleRemoveParticipant}
                lockedParticipantIds={[
                  series.manager_user_id,
                  series.responsible_user_id,
                  series.manager_position_id,
                  series.responsible_position_id
                ].filter(Boolean) as string[]}
              />
            </div>

            <MeetingAgentScheduleRecurrenceField
              value={form.recurrence}
              onChange={(recurrence) => updateField("recurrence", recurrence)}
            />

            <label className={styles.scheduleField}>
              <span className={styles.scheduleFieldLabel}>Срок по</span>
              <input
                className={styles.scheduleControl}
                type="date"
                value={form.seriesEndDate}
                onChange={(event) => updateField("seriesEndDate", event.target.value)}
              />
            </label>

            <label className={styles.scheduleField}>
              <span className={styles.scheduleFieldLabel}>Комментарий</span>
              <textarea
                className={`${styles.scheduleControl} ${styles.scheduleTextarea}`}
                value={form.comment}
                placeholder="Дополнительная информация"
                onChange={(event) => updateField("comment", event.target.value)}
              />
            </label>

            <div className={styles.scheduleDrawerActions}>
              {saveError ? <p className={styles.scheduleDrawerError}>{saveError}</p> : null}
              <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={saving}>
                Отмена
              </button>
              <button type="submit" className={styles.primaryButton} disabled={!canSave}>
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </form>
        ) : null}
      </aside>
    </div>,
    document.body
  );
}
