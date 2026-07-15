import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, X } from "lucide-react";

import { meetingsApi } from "@/api/endpoints";
import MeetingAgentScheduleRecurrenceField from "@/pages/MeetingAgentScheduleRecurrenceField";
import type {
  MeetingScheduleRecurrenceFormState,
  MeetingScheduleSeriesSavePayload,
  MeetingScheduleType
} from "@/types/meetings";
import { meetingScheduleTypeOptions } from "@/utils/meetingSchedule";
import {
  buildRecurrenceRule,
  createDefaultRecurrenceFormState
} from "@/utils/meetingScheduleRecurrence";

import styles from "./MeetingAgent.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: MeetingScheduleSeriesSavePayload) => void;
  saving?: boolean;
  saveError?: string | null;
};

type ScheduleParticipant = {
  departmentId: string;
  name: string;
};

type FormState = {
  title: string;
  meetingType: MeetingScheduleType;
  participants: ScheduleParticipant[];
  recurrence: MeetingScheduleRecurrenceFormState;
  comment: string;
  seriesStartDate: string;
  seriesEndDate: string;
};

const emptyForm = (): FormState => ({
  title: "",
  meetingType: "planned",
  participants: [],
  recurrence: createDefaultRecurrenceFormState(),
  comment: "",
  seriesStartDate: "",
  seriesEndDate: ""
});

export default function MeetingAgentScheduleSeriesDrawer({
  open,
  onClose,
  onSave,
  saving = false,
  saveError = null
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const canCloseRef = useRef(false);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
    }
  }, [open]);

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

  const canSave = form.title.trim().length > 0 && form.participants.length > 0 && !saving;

  if (!open) return null;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleAddParticipant(participant: ScheduleParticipant) {
    updateField("participants", [...form.participants, participant]);
  }

  function handleRemoveParticipant(departmentId: string) {
    updateField(
      "participants",
      form.participants.filter((item) => item.departmentId !== departmentId)
    );
  }

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !canCloseRef.current) return;
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    onSave({
      title: form.title.trim(),
      meeting_type: form.meetingType,
      status: "created",
      participant_department_ids: form.participants.map((participant) => participant.departmentId),
      recurrence: buildRecurrenceRule(form.recurrence),
      comment: form.comment.trim() || null,
      series_start_date: form.seriesStartDate || null,
      series_end_date: form.seriesEndDate || null
    });
  }

  return createPortal(
    <div className={styles.scheduleDrawerOverlay} onMouseDown={handleOverlayClick}>
      <aside
        className={styles.scheduleDrawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.scheduleDrawerHead}>
          <h2 id="schedule-drawer-title">Добавление серии совещаний</h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <form className={styles.scheduleDrawerForm} onSubmit={handleSubmit}>
          <label className={styles.scheduleField}>
            <span className={styles.scheduleFieldLabel}>Название</span>
            <input
              className={styles.scheduleControl}
              value={form.title}
              placeholder="Технический совет"
              onChange={(event) => updateField("title", event.target.value)}
            />
          </label>

          <label className={styles.scheduleField}>
            <span className={styles.scheduleFieldLabel}>Тип</span>
            <div className={styles.scheduleSelectField}>
              <select
                className={styles.scheduleControl}
                value={form.meetingType}
                onChange={(event) =>
                  updateField("meetingType", event.target.value as MeetingScheduleType)
                }
              >
                {meetingScheduleTypeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className={styles.scheduleSelectChevron} size={16} aria-hidden="true" />
            </div>
          </label>

          <div className={styles.scheduleField}>
            <span className={styles.scheduleFieldLabel}>Участники</span>
            <ScheduleParticipantField
              selectedParticipants={form.participants}
              onAdd={handleAddParticipant}
              onRemove={handleRemoveParticipant}
            />
          </div>

          <MeetingAgentScheduleRecurrenceField
            value={form.recurrence}
            onChange={(recurrence) => updateField("recurrence", recurrence)}
          />

          <div className={styles.scheduleFieldRow}>
            <label className={styles.scheduleField}>
              <span className={styles.scheduleFieldLabel}>Срок с</span>
              <input
                className={styles.scheduleControl}
                type="date"
                value={form.seriesStartDate}
                onChange={(event) => updateField("seriesStartDate", event.target.value)}
              />
            </label>
            <label className={styles.scheduleField}>
              <span className={styles.scheduleFieldLabel}>Срок по</span>
              <input
                className={styles.scheduleControl}
                type="date"
                value={form.seriesEndDate}
                onChange={(event) => updateField("seriesEndDate", event.target.value)}
              />
            </label>
          </div>

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
      </aside>
    </div>,
    document.body
  );
}

function filterDepartmentSuggestions(
  query: string,
  selectedIds: string[],
  departments: ScheduleParticipant[]
): ScheduleParticipant[] {
  const normalized = query.trim().toLowerCase().replace("ё", "е");
  if (!normalized) return [];

  return departments
    .filter((department) => !selectedIds.includes(department.departmentId))
    .filter((department) => department.name.toLowerCase().replace("ё", "е").includes(normalized))
    .slice(0, 8);
}

function ScheduleParticipantField({
  selectedParticipants,
  onAdd,
  onRemove
}: {
  selectedParticipants: ScheduleParticipant[];
  onAdd: (participant: ScheduleParticipant) => void;
  onRemove: (departmentId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedSearch = searchQuery.trim();

  const departmentsQuery = useQuery({
    queryKey: ["meetings", "schedule", "participant-options", trimmedSearch],
    queryFn: () => meetingsApi.listScheduleParticipantOptions(trimmedSearch || undefined),
    staleTime: 60_000
  });

  const departmentOptions = useMemo(
    () =>
      (departmentsQuery.data ?? []).map((department) => ({
        departmentId: department.id,
        name: department.name.trim()
      })),
    [departmentsQuery.data]
  );

  const selectedIds = useMemo(
    () => selectedParticipants.map((participant) => participant.departmentId),
    [selectedParticipants]
  );

  const suggestions = useMemo(
    () => filterDepartmentSuggestions(searchQuery, selectedIds, departmentOptions),
    [searchQuery, selectedIds, departmentOptions]
  );

  function handleAddParticipant(participant: ScheduleParticipant) {
    onAdd(participant);
    setSearchQuery("");
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !suggestions[0]) return;
    event.preventDefault();
    handleAddParticipant(suggestions[0]);
  }

  return (
    <div className={styles.scheduleParticipantField}>
      <div className={styles.scheduleParticipantSearchRow}>
        <div className={styles.scheduleParticipantSearchField}>
          <Search className={styles.scheduleParticipantSearchIcon} size={16} aria-hidden="true" />
          <input
            className={`${styles.scheduleControl} ${styles.scheduleParticipantSearchInput}`}
            value={searchQuery}
            placeholder="Поиск должности"
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        {suggestions.length === 1 ? (
          <button
            type="button"
            className={styles.scheduleParticipantAddButton}
            onClick={() => handleAddParticipant(suggestions[0]!)}
          >
            Добавить
          </button>
        ) : null}
      </div>

      {departmentsQuery.isLoading ? (
        <p className={styles.scheduleParticipantEmptyHint}>Загружаем должности…</p>
      ) : departmentsQuery.isError ? (
        <p className={styles.scheduleParticipantEmptyHint}>Не удалось загрузить должности</p>
      ) : null}

      {trimmedSearch && suggestions.length > 1 ? (
        <ul className={styles.scheduleParticipantSuggestions} aria-label="Найденные должности">
          {suggestions.map((participant) => (
            <li key={participant.departmentId}>
              <button
                type="button"
                className={styles.scheduleParticipantSuggestionButton}
                onClick={() => handleAddParticipant(participant)}
              >
                {participant.name}
              </button>
            </li>
          ))}
        </ul>
      ) : trimmedSearch && suggestions.length === 1 ? (
        <p className={styles.scheduleParticipantMatchHint}>Найдено: {suggestions[0]!.name}</p>
      ) : trimmedSearch && !departmentsQuery.isLoading && !departmentsQuery.isError && !suggestions.length ? (
        <p className={styles.scheduleParticipantEmptyHint}>Должность не найдена</p>
      ) : null}

      {selectedParticipants.length ? (
        <div className={styles.scheduleParticipantChipList}>
          {selectedParticipants.map((participant) => (
            <span className={styles.scheduleParticipantChip} key={participant.departmentId}>
              <span className={styles.scheduleParticipantChipLabel}>{participant.name}</span>
              <button
                type="button"
                className={styles.scheduleParticipantChipRemove}
                aria-label={`Удалить ${participant.name}`}
                onClick={() => onRemove(participant.departmentId)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : !trimmedSearch && !departmentsQuery.isLoading && !departmentsQuery.isError ? (
        <p className={styles.scheduleParticipantEmptyHint}>Добавьте хотя бы одну должность</p>
      ) : null}
    </div>
  );
}
