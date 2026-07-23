import type { ProcurementCaseSummary } from "@/types/procurement";
import { caseTitle, STATUS_LABELS } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

const WORK_STATUS_LABELS = {
  processing: "В работе",
  awaiting_action: "Ожидает действий",
  completed: "Завершено",
  archived: "В архиве"
} as const;

const PICKER_DECISION_LABELS: Record<
  NonNullable<ProcurementCaseSummary["picker_decision_kind"]>,
  string
> = {
  none: "Подтверждено",
  stock_confirmation: "Наличие",
  deficit_confirmation: "Дефицит",
  discrepancy_return: "Расхождение",
  critical_acknowledgement: "Не хватает данных"
};

type Props = {
  title: string;
  cases: ProcurementCaseSummary[];
  selectedCaseId: string;
  onSelect: (caseId: string) => void;
  emptyText: string;
  showArchiveMeta?: boolean;
  showEngineerMeta?: boolean;
  showDispatcherMeta?: boolean;
  showPickerMeta?: boolean;
};

function positionsLabel(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${count} позиций`;
  if (last === 1) return `${count} позиция`;
  if (last >= 2 && last <= 4) return `${count} позиции`;
  return `${count} позиций`;
}

function formatCaseListDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function workStatusTone(
  workStatus: keyof typeof WORK_STATUS_LABELS | null | undefined
): string {
  if (workStatus === "awaiting_action") return styles.caseStatusAwaiting;
  if (workStatus === "processing") return styles.caseStatusProcessing;
  if (workStatus === "completed") return styles.caseStatusCompleted;
  if (workStatus === "archived") return styles.caseStatusArchived;
  return styles.caseStatusDefault;
}

export function CaseListPanel({
  title,
  cases,
  selectedCaseId,
  onSelect,
  emptyText,
  showArchiveMeta = false,
  showEngineerMeta = false,
  showDispatcherMeta = false,
  showPickerMeta = false
}: Props) {
  return (
    <section className={styles.queuePanel}>
      <div className={styles.panelHeader}>
        <h3>{title}</h3>
        <span className={styles.syncBadge}>{cases.length}</span>
      </div>
      {cases.length === 0 ? <div className={styles.emptyState}>{emptyText}</div> : null}
      <div className={styles.caseList}>
        {cases.map((item) => {
          const workStatus = showPickerMeta
            ? item.picker_work_status
            : showDispatcherMeta
              ? item.dispatcher_work_status
              : showEngineerMeta
                ? item.engineer_work_status
                : null;
          const reason = showPickerMeta
            ? item.picker_bucket_reason
            : showDispatcherMeta
              ? item.dispatcher_bucket_reason
              : showEngineerMeta
                ? item.engineer_bucket_reason
                : null;
          const statusText = workStatus
            ? WORK_STATUS_LABELS[workStatus]
            : (STATUS_LABELS[item.status] ?? item.status);
          const decisionLabel =
            showPickerMeta && item.picker_decision_kind
              ? PICKER_DECISION_LABELS[item.picker_decision_kind]
              : null;
          const note =
            showArchiveMeta && item.closed_reason_label
              ? item.closed_reason_label
              : reason;
          const isSelected = item.id === selectedCaseId;

          return (
            <button
              className={isSelected ? styles.caseItemActive : styles.caseItem}
              key={item.id}
              onClick={() => onSelect(item.id)}
              type="button"
            >
              <div className={styles.caseItemTop}>
                <strong className={styles.caseItemTitle}>{caseTitle(item)}</strong>
                <span className={`${styles.caseStatus} ${workStatusTone(workStatus)}`}>
                  {statusText}
                </span>
              </div>

              <div className={styles.caseItemFacts}>
                <span className={styles.caseFact}>
                  <span className={styles.caseFactLabel}>Позиции</span>
                  <span className={styles.caseFactValue}>
                    {positionsLabel(item.positions_count)}
                  </span>
                </span>
                <span className={styles.caseFact}>
                  <span className={styles.caseFactLabel}>Дата</span>
                  <span className={styles.caseFactValue}>
                    {formatCaseListDateTime(item.source_date)}
                  </span>
                </span>
                {showDispatcherMeta && item.dispatcher_stream ? (
                  <span className={styles.caseFact}>
                    <span className={styles.caseFactLabel}>Поток</span>
                    <span className={styles.caseFactValue}>
                      {item.dispatcher_stream === "reorder_point"
                        ? "Точка заказа"
                        : "После инженера"}
                    </span>
                  </span>
                ) : null}
                {showPickerMeta && item.department_name ? (
                  <span className={`${styles.caseFact} ${styles.caseFactWide}`}>
                    <span className={styles.caseFactLabel}>Участок</span>
                    <span className={styles.caseFactValue}>{item.department_name}</span>
                  </span>
                ) : null}
                {decisionLabel ? (
                  <span className={`${styles.caseFact} ${styles.caseFactWide}`}>
                    <span className={styles.caseFactLabel}>Тип</span>
                    <span className={styles.caseFactValue}>{decisionLabel}</span>
                  </span>
                ) : null}
              </div>

              {note ? <div className={styles.caseItemNote}>{note}</div> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
