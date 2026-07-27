import { AlertTriangle, Loader2, X } from "lucide-react";
import type { MeetingMemoSeriesPlanning } from "@/types/meetings";
import styles from "./MeetingAgent.module.css";

function formatPlanningDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

type Props = {
  open: boolean;
  memoLabel: string;
  planning: MeetingMemoSeriesPlanning;
  resolvedTopicLabel?: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export default function MeetingAgentSeriesConfirmModal({
  open,
  memoLabel,
  planning,
  resolvedTopicLabel,
  loading,
  error,
  onClose,
  onConfirm
}: Props) {
  if (!open) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.modalCard} ${styles.seriesConfirmModalCard}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-series-confirm-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="meeting-series-confirm-title">Подтвердите серию совещаний</h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            disabled={loading}
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className={styles.modalHint}>{memoLabel}</p>
        <p className={styles.seriesConfirmLead}>
          Проверьте параметры серии. После подтверждения серия будет сохранена в графике со
          статусом «Создано», а служебная записка — согласована. Распланирование в Outlook
          выполняется отдельно на вкладке «График совещаний».
        </p>

        <dl className={styles.seriesConfirmGrid}>
          {resolvedTopicLabel ? (
            <div>
              <dt>Тема в 1С</dt>
              <dd>{resolvedTopicLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt>Периодичность</dt>
            <dd>{planning.recurrence_label ?? "—"}</dd>
          </div>
          <div>
            <dt>Срок серии</dt>
            <dd>
              {formatPlanningDate(planning.series_start_date)} —{" "}
              {formatPlanningDate(planning.series_end_date)}
            </dd>
          </div>
          <div>
            <dt>Количество совещаний</dt>
            <dd>{planning.occurrence_count ?? "—"}</dd>
          </div>
        </dl>

        {planning.source_quote ? (
          <p className={styles.seriesConfirmQuote}>
            Фрагмент СЗ: «{planning.source_quote}»
          </p>
        ) : null}

        {(planning.ambiguities ?? []).length ? (
          <ul className={styles.seriesConfirmAmbiguities}>
            {planning.ambiguities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <div className={styles.modalError} role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button type="button" className={styles.primaryButton} disabled={loading} onClick={onConfirm}>
            {loading ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Сохраняем…
              </>
            ) : (
              "Подтвердить и согласовать СЗ"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
