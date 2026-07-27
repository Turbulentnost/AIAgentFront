import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, X } from "lucide-react";

import { meetingsApi } from "@/api/endpoints";
import MeetingAgentScheduleRecurrenceField from "@/pages/MeetingAgentScheduleRecurrenceField";
import MeetingAgentScheduleFillFromPositionsPanel from "@/pages/MeetingAgentScheduleFillFromPositionsPanel";
import type {
  MeetingScheduleRecurrenceFormState,
  MeetingScheduleSeriesSavePayload,
  MeetingScheduleType
} from "@/types/meetings";
import { meetingScheduleTypeOptions } from "@/utils/meetingSchedule";
import { mapScheduleFormParticipantsToApi } from "@/utils/meetingScheduleApi";
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
  id: string;
  name: string;
  email: string;
  positionName?: string | null;
  positionId?: string | null;
  kind: "employee";
};

type FormState = {
  title: string;
  meetingCategoryId: string;
  manager: ScheduleParticipant | null;
  responsible: ScheduleParticipant | null;
  meetingType: MeetingScheduleType;
  participants: ScheduleParticipant[];
  recurrence: MeetingScheduleRecurrenceFormState;
  comment: string;
  seriesStartDate: string;
  seriesEndDate: string;
};

const emptyForm = (): FormState => ({
  title: "",
  meetingCategoryId: "",
  manager: null,
  responsible: null,
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

  const saveBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!form.title.trim()) blockers.push("название");
    if (!form.meetingCategoryId) blockers.push("вид совещания");
    if (!form.manager) blockers.push("руководитель (сотрудник)");
    if (!form.responsible) blockers.push("ответственный (сотрудник)");
    return blockers;
  }, [form.title, form.meetingCategoryId, form.manager, form.responsible]);

  const canSave = saveBlockers.length === 0 && !saving;

  if (!open) return null;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleAddParticipant(participant: ScheduleParticipant) {
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

  function handleFillFromPositions(payload: {
    manager: ScheduleParticipant | null;
    responsible: ScheduleParticipant | null;
    participants: ScheduleParticipant[];
  }) {
    setForm((current) => {
      const roleUserIds = new Set(
        [payload.manager?.id, payload.responsible?.id].filter(Boolean) as string[]
      );
      const mergedParticipants = [...current.participants];
      for (const participant of payload.participants) {
        if (roleUserIds.has(participant.id)) continue;
        if (mergedParticipants.some((item) => item.id === participant.id)) continue;
        mergedParticipants.push(participant);
      }
      return {
        ...current,
        manager: payload.manager ?? current.manager,
        responsible: payload.responsible ?? current.responsible,
        participants: mergedParticipants
      };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    onSave({
      title: form.title.trim(),
      meeting_category_id: form.meetingCategoryId,
      manager_user_id: form.manager!.id,
      responsible_user_id: form.responsible!.id,
      manager_person_fio: form.manager!.name,
      manager_person_email: form.manager!.email,
      responsible_person_fio: form.responsible!.name,
      responsible_person_email: form.responsible!.email,
      manager_position_id: form.manager!.positionId ?? null,
      responsible_position_id: form.responsible!.positionId ?? null,
      meeting_type: form.meetingType,
      status: "created",
      participants: mapScheduleFormParticipantsToApi(form.participants),
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

          <ScheduleCategoryField
            value={form.meetingCategoryId}
            onChange={(meetingCategoryId) => updateField("meetingCategoryId", meetingCategoryId)}
          />

          <MeetingAgentScheduleFillFromPositionsPanel onApply={handleFillFromPositions} />

          <ScheduleSingleEmployeeField
            label="Руководитель"
            value={form.manager}
            onChange={(manager) => updateField("manager", manager)}
          />

          <ScheduleSingleEmployeeField
            label="Ответственный"
            value={form.responsible}
            onChange={(responsible) => updateField("responsible", responsible)}
          />

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
            {!canSave && saveBlockers.length ? (
              <p className={styles.scheduleParticipantEmptyHint}>
                Для сохранения укажите: {saveBlockers.join(", ")}.
                {saveBlockers.some((item) => item.includes("руководитель") || item.includes("ответственный"))
                  ? " После выбора должностей нажмите «Подставить сотрудников» или найдите людей вручную."
                  : ""}
              </p>
            ) : null}
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

function filterEmployeeSuggestions(
  query: string,
  selectedIds: string[],
  employees: ScheduleParticipant[]
): ScheduleParticipant[] {
  const normalized = query.trim().toLowerCase().replace("ё", "е");
  if (normalized.length < 3) return [];

  return employees
    .filter((employee) => !selectedIds.includes(employee.id))
    .filter((employee) => {
      const haystack = `${employee.name} ${employee.email} ${employee.positionName ?? ""}`
        .toLowerCase()
        .replace("ё", "е");
      return haystack.includes(normalized);
    })
    .slice(0, 8);
}

function mapEmployeeOption(option: {
  id: string;
  fio: string;
  email: string;
  position_name?: string | null;
  position_id?: string | null;
}): ScheduleParticipant {
  return {
    id: option.id,
    name: option.fio.trim(),
    email: option.email.trim(),
    positionName: option.position_name?.trim() || null,
    positionId: option.position_id ?? null,
    kind: "employee"
  };
}

export function ScheduleParticipantField({
  selectedParticipants,
  onAdd,
  onRemove,
  lockedParticipantIds = []
}: {
  selectedParticipants: ScheduleParticipant[];
  onAdd: (participant: ScheduleParticipant) => void;
  onRemove: (participantId: string) => void;
  lockedParticipantIds?: string[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedSearch = searchQuery.trim();
  const employeeSearch = trimmedSearch.length >= 3 ? trimmedSearch : "";

  const employeesQuery = useQuery({
    queryKey: ["meetings", "schedule", "employee-options", employeeSearch],
    queryFn: () => meetingsApi.listScheduleEmployeeOptions(employeeSearch),
    enabled: employeeSearch.length >= 3,
    staleTime: 30_000
  });

  const employeeOptions = useMemo(
    () => (employeesQuery.data ?? []).map(mapEmployeeOption),
    [employeesQuery.data]
  );

  const selectedIds = useMemo(
    () => selectedParticipants.map((participant) => participant.id),
    [selectedParticipants]
  );

  const suggestions = useMemo(
    () => filterEmployeeSuggestions(searchQuery, selectedIds, employeeOptions),
    [searchQuery, selectedIds, employeeOptions]
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
            placeholder="Поиск участника (мин. 3 символа)"
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

      {employeesQuery.isLoading && employeeSearch ? (
        <p className={styles.scheduleParticipantEmptyHint}>Ищем сотрудников…</p>
      ) : employeesQuery.isError && employeeSearch ? (
        <p className={styles.scheduleParticipantEmptyHint}>Не удалось загрузить сотрудников</p>
      ) : null}

      {trimmedSearch.length > 0 && trimmedSearch.length < 3 ? (
        <p className={styles.scheduleParticipantEmptyHint}>Введите минимум 3 символа</p>
      ) : null}

      {employeeSearch && suggestions.length > 1 ? (
        <ul className={styles.scheduleParticipantSuggestions} aria-label="Найденные сотрудники">
          {suggestions.map((participant) => (
            <li key={participant.id}>
              <button
                type="button"
                className={styles.scheduleParticipantSuggestionButton}
                onClick={() => handleAddParticipant(participant)}
              >
                <span>{participant.name}</span>
                <span className={styles.scheduleParticipantSuggestionMeta}>{participant.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : employeeSearch && suggestions.length === 1 ? (
        <p className={styles.scheduleParticipantMatchHint}>
          Найдено: {suggestions[0]!.name} ({suggestions[0]!.email})
        </p>
      ) : employeeSearch && !employeesQuery.isLoading && !employeesQuery.isError && !suggestions.length ? (
        <p className={styles.scheduleParticipantEmptyHint}>Сотрудник не найден</p>
      ) : null}

      {selectedParticipants.length ? (
        <div className={styles.scheduleParticipantChipList}>
          {selectedParticipants.map((participant) => {
            const isLocked = lockedParticipantIds.includes(participant.id);
            return (
            <span className={styles.scheduleParticipantChip} key={participant.id}>
              <span className={styles.scheduleParticipantChipLabel}>
                {participant.name}
                {participant.positionName ? (
                  <span className={styles.scheduleParticipantSuggestionMeta}>
                    {" "}
                    · {participant.positionName}
                  </span>
                ) : null}
              </span>
              {!isLocked ? (
              <button
                type="button"
                className={styles.scheduleParticipantChipRemove}
                aria-label={`Удалить ${participant.name}`}
                onClick={() => onRemove(participant.id)}
              >
                <X size={12} aria-hidden="true" />
              </button>
              ) : null}
            </span>
            );
          })}
        </div>
      ) : !trimmedSearch && !employeesQuery.isLoading && !employeesQuery.isError ? (
        <p className={styles.scheduleParticipantEmptyHint}>Добавьте хотя бы одного участника</p>
      ) : null}
    </div>
  );
}

function ScheduleCategoryField({
  value,
  onChange
}: {
  value: string;
  onChange: (categoryId: string) => void;
}) {
  const categoriesQuery = useQuery({
    queryKey: ["meetings", "schedule", "category-options"],
    queryFn: () => meetingsApi.listScheduleCategoryOptions(),
    staleTime: 60_000
  });

  const categories = categoriesQuery.data ?? [];
  const selectedCategory = categories.find((category) => category.id === value) ?? null;

  return (
    <div className={styles.scheduleField}>
      <span className={styles.scheduleFieldLabel}>Вид совещания</span>
      {categoriesQuery.isLoading ? (
        <p className={styles.scheduleCategoryPickerHint}>Загрузка видов…</p>
      ) : categoriesQuery.isError ? (
        <p className={styles.scheduleCategoryPickerError}>Не удалось загрузить виды совещаний</p>
      ) : (
        <>
          <p className={styles.scheduleCategoryPickerHint}>
            {selectedCategory ? (
              <>
                Выбрано: <strong>{selectedCategory.name}</strong>
              </>
            ) : (
              "Выберите вид из списка"
            )}
          </p>
          <div
            className={styles.scheduleCategoryPicker}
            role="listbox"
            aria-label="Вид совещания"
          >
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                role="option"
                aria-selected={value === category.id}
                className={`${styles.scheduleCategoryPickerTile} ${
                  value === category.id ? styles.scheduleCategoryPickerTileActive : ""
                }`}
                onClick={() => onChange(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ScheduleSingleEmployeeField({
  label,
  value,
  onChange
}: {
  label: string;
  value: ScheduleParticipant | null;
  onChange: (participant: ScheduleParticipant | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedSearch = searchQuery.trim();
  const employeeSearch = trimmedSearch.length >= 3 ? trimmedSearch : "";

  const employeesQuery = useQuery({
    queryKey: ["meetings", "schedule", "employee-options", label, employeeSearch],
    queryFn: () => meetingsApi.listScheduleEmployeeOptions(employeeSearch),
    enabled: employeeSearch.length >= 3,
    staleTime: 30_000
  });

  const employeeOptions = useMemo(
    () => (employeesQuery.data ?? []).map(mapEmployeeOption),
    [employeesQuery.data]
  );

  const suggestions = useMemo(
    () => filterEmployeeSuggestions(searchQuery, value ? [value.id] : [], employeeOptions),
    [searchQuery, value, employeeOptions]
  );

  function handleSelect(participant: ScheduleParticipant) {
    onChange(participant);
    setSearchQuery("");
  }

  return (
    <div className={styles.scheduleField}>
      <span className={styles.scheduleFieldLabel}>{label}</span>
      {value ? (
        <div className={styles.scheduleParticipantChipList}>
          <span className={styles.scheduleParticipantChip}>
            <span className={styles.scheduleParticipantChipLabel}>
              {value.name}
              {value.positionName ? (
                <span className={styles.scheduleParticipantSuggestionMeta}>
                  {" "}
                  · {value.positionName}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className={styles.scheduleParticipantChipRemove}
              aria-label={`Сменить ${label.toLowerCase()}`}
              onClick={() => onChange(null)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        </div>
      ) : (
        <div className={styles.scheduleParticipantField}>
          <div className={styles.scheduleParticipantSearchRow}>
            <div className={styles.scheduleParticipantSearchField}>
              <Search className={styles.scheduleParticipantSearchIcon} size={16} aria-hidden="true" />
              <input
                className={`${styles.scheduleControl} ${styles.scheduleParticipantSearchInput}`}
                value={searchQuery}
                placeholder={`Поиск ${label.toLowerCase()} (мин. 3 символа)`}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && suggestions[0]) {
                    event.preventDefault();
                    handleSelect(suggestions[0]!);
                  }
                }}
              />
            </div>
          </div>
          {trimmedSearch.length > 0 && trimmedSearch.length < 3 ? (
            <p className={styles.scheduleParticipantEmptyHint}>Введите минимум 3 символа</p>
          ) : null}
          {employeeSearch && suggestions.length ? (
            <ul className={styles.scheduleParticipantSuggestions} aria-label={`Найденные сотрудники: ${label}`}>
              {suggestions.map((participant) => (
                <li key={participant.id}>
                  <button
                    type="button"
                    className={styles.scheduleParticipantSuggestionButton}
                    onClick={() => handleSelect(participant)}
                  >
                    <span>{participant.name}</span>
                    <span className={styles.scheduleParticipantSuggestionMeta}>{participant.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : employeeSearch && !employeesQuery.isLoading && !employeesQuery.isError ? (
            <p className={styles.scheduleParticipantEmptyHint}>Сотрудник не найден</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
