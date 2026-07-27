import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, X } from "lucide-react";

import type {
  ScheduledMeetingPlanOccurrencePreview,
  ScheduledMeetingPlanOptionKind,
  ScheduledMeetingPlanOverride,
  ScheduledMeetingPlanPreviewRead
} from "@/types/meetings";
import { formatMeetingConflictMovability } from "@/utils/meetingDashboard";
import {
  availableChoicesForOccurrence,
  buildDefaultChoices,
  buildPlanOverridesFromChoices,
  formatPlanDifficulty,
  formatPlanOptionKind,
  getOccurrenceOption,
  groupPlanPreviewOccurrences,
  summarizeChoices,
  type PlanChoiceByDate
} from "@/utils/meetingSchedulePlanPreview";

import styles from "./MeetingAgent.module.css";

type Props = {
  open: boolean;
  seriesLabel: string;
  loadingPreview: boolean;
  planning: boolean;
  preview: ScheduledMeetingPlanPreviewRead | null;
  previewError: string | null;
  planError: string | null;
  onClose: () => void;
  onConfirm: (overrides: ScheduledMeetingPlanOverride[]) => void;
};

function formatDateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    weekday: "short"
  });
}

function OccurrenceRow({
  occurrence,
  choice,
  onChangeChoice
}: {
  occurrence: ScheduledMeetingPlanOccurrencePreview;
  choice: ScheduledMeetingPlanOptionKind;
  onChangeChoice: (kind: ScheduledMeetingPlanOptionKind) => void;
}) {
  const option = getOccurrenceOption(occurrence, choice);
  const choices = availableChoicesForOccurrence(occurrence);
  const blockers =
    choice === "reschedule_blockers"
      ? option?.blockers?.length
        ? option.blockers
        : occurrence.conflicts.filter((item) => item.reschedule_hint_start)
      : [];

  return (
    <li className={styles.planPreviewOccurrence}>
      <div className={styles.planPreviewOccurrenceHeader}>
        <div>
          <strong>{formatDateLabel(occurrence.occurrence_date)}</strong>
          <span className={styles.planPreviewOccurrenceMeta}>
            {occurrence.planned_start}
            {option?.suggested_start ? ` → ${option.suggested_start}` : ""}
          </span>
        </div>
        {option?.difficulty ? (
          <span className={styles.planPreviewDifficulty}>
            {formatPlanDifficulty(option.difficulty)}
          </span>
        ) : null}
      </div>

      {choices.length > 1 ? (
        <label className={styles.planPreviewChoiceField}>
          <span>Вариант</span>
          <select
            value={choice}
            onChange={(event) =>
              onChangeChoice(event.target.value as ScheduledMeetingPlanOptionKind)
            }
          >
            {choices.map((item) => (
              <option key={item.kind} value={item.kind}>
                {formatPlanOptionKind(item.kind)}
                {item.recommended ? " · рекомендуем" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {option?.reason ? <p className={styles.planPreviewReason}>{option.reason}</p> : null}

      {blockers.length ? (
        <ul className={styles.planPreviewBlockers}>
          {blockers.map((blocker, index) => (
            <li key={`${blocker.attendee_email}-${blocker.event_start}-${index}`}>
              <span>
                {blocker.event_subject || "Встреча без темы"} · {blocker.attendee_email}
              </span>
              <span className={styles.planPreviewOccurrenceMeta}>
                подвижность: {formatMeetingConflictMovability(blocker.movability)}
                {blocker.reschedule_hint_start
                  ? ` · предложить: ${blocker.reschedule_hint_start}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function MeetingAgentSchedulePlanPreviewModal({
  open,
  seriesLabel,
  loadingPreview,
  planning,
  preview,
  previewError,
  planError,
  onClose,
  onConfirm
}: Props) {
  const [choices, setChoices] = useState<PlanChoiceByDate>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !preview) return;
    const nextChoices = buildDefaultChoices(preview);
    setChoices(nextChoices);
    const groups = groupPlanPreviewOccurrences(preview, nextChoices);
    const expanded: Record<string, boolean> = {};
    for (const group of groups) {
      // По умолчанию раскрываем только группы, где нужен взгляд пользователя.
      expanded[group.id] =
        group.id === "reschedule_blockers" ||
        group.id === "unresolved" ||
        group.id === "keep_conflict" ||
        groups.length <= 3;
    }
    setExpandedGroups(expanded);
  }, [open, preview]);

  const groups = useMemo(
    () => (preview ? groupPlanPreviewOccurrences(preview, choices) : []),
    [preview, choices]
  );
  const summary = useMemo(
    () => (preview ? summarizeChoices(preview, choices) : null),
    [preview, choices]
  );

  if (!open) return null;

  const busy = loadingPreview || planning;

  function handleConfirm() {
    if (!preview) return;
    onConfirm(buildPlanOverridesFromChoices(preview, choices));
  }

  function handleResetRecommendations() {
    if (!preview) return;
    setChoices(buildDefaultChoices(preview));
  }

  return (
    <div className={styles.modalOverlay} onClick={busy ? undefined : onClose} role="presentation">
      <div
        className={`${styles.modalCard} ${styles.planPreviewModalCard}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-schedule-plan-preview-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="meeting-schedule-plan-preview-title">Проверка конфликтов серии</h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            disabled={busy}
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className={styles.modalHint}>{seriesLabel}</p>

        {loadingPreview ? (
          <div className={styles.planPreviewLoading}>
            <Loader2 className={styles.spinner} size={18} aria-hidden="true" />
            <span>Проверяем занятость участников…</span>
          </div>
        ) : null}

        {previewError ? (
          <div className={styles.modalError} role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{previewError}</span>
          </div>
        ) : null}

        {planError ? (
          <div className={styles.modalError} role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{planError}</span>
          </div>
        ) : null}

        {preview && summary ? (
          <>
            <div className={styles.planPreviewSummary}>
              <span>
                <CheckCircle2 size={14} aria-hidden="true" />
                {summary.ok} без конфликтов
              </span>
              <span>{summary.shift} сдвинуть</span>
              <span>{summary.rescheduleBlockers} оставить наш слот</span>
              <span>{summary.keep} с конфликтом</span>
              <span>{summary.skip} пропустить</span>
              <span className={styles.planPreviewSummaryTotal}>всего {summary.total}</span>
            </div>

            <p className={styles.modalHint}>
              Рекомендации уже выбраны. Можно применить сразу или раскрыть группы и поправить
              отдельные даты. Перенос чужих встреч выполняется вручную по подсказке.
            </p>

            <div className={styles.planPreviewGroups}>
              {groups.map((group) => {
                const expanded = Boolean(expandedGroups[group.id]);
                return (
                  <section key={group.id} className={styles.planPreviewGroup}>
                    <button
                      type="button"
                      className={styles.planPreviewGroupHeader}
                      onClick={() =>
                        setExpandedGroups((current) => ({
                          ...current,
                          [group.id]: !current[group.id]
                        }))
                      }
                    >
                      <span>
                        <strong>
                          {group.title} · {group.occurrences.length}
                        </strong>
                        <span className={styles.planPreviewOccurrenceMeta}>
                          {group.description}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={
                          expanded
                            ? styles.planPreviewChevronOpen
                            : styles.planPreviewChevron
                        }
                      />
                    </button>
                    {expanded ? (
                      <ul className={styles.planPreviewOccurrenceList}>
                        {group.occurrences.map((occurrence) => (
                          <OccurrenceRow
                            key={occurrence.occurrence_date}
                            occurrence={occurrence}
                            choice={
                              choices[occurrence.occurrence_date] ??
                              occurrence.recommended_option ??
                              "keep_conflict"
                            }
                            onChangeChoice={(kind) =>
                              setChoices((current) => ({
                                ...current,
                                [occurrence.occurrence_date]: kind
                              }))
                            }
                          />
                        ))}
                      </ul>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </>
        ) : null}

        <div className={`${styles.modalActions} ${styles.modalActionsSplit}`}>
          <div className={styles.modalActionsStart}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={onClose}
              disabled={busy}
            >
              Отмена
            </button>
            {preview ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={handleResetRecommendations}
                disabled={busy}
              >
                Сбросить к рекомендациям
              </button>
            ) : null}
          </div>
          <div className={styles.modalActionsEnd}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleConfirm}
              disabled={!preview || busy}
            >
              {planning ? (
                <>
                  <Loader2 className={styles.spinner} size={16} aria-hidden="true" />
                  Распланируем…
                </>
              ) : (
                "Применить и распланировать"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
