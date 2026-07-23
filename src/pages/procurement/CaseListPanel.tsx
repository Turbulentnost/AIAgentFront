import type { ProcurementCaseSummary } from "@/types/procurement";
import { caseTitle, formatDateTime, STATUS_LABELS } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

const ENGINEER_WORK_LABELS = {
  processing: "В работе",
  awaiting_action: "Ожидает действий",
  completed: "Завершено",
  archived: "В архиве"
} as const;

type Props = {
  title: string;
  cases: ProcurementCaseSummary[];
  selectedCaseId: string;
  onSelect: (caseId: string) => void;
  emptyText: string;
  showArchiveMeta?: boolean;
  showEngineerMeta?: boolean;
  showDispatcherMeta?: boolean;
};

export function CaseListPanel({
  title,
  cases,
  selectedCaseId,
  onSelect,
  emptyText,
  showArchiveMeta = false,
  showEngineerMeta = false,
  showDispatcherMeta = false
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
          const workStatus = showDispatcherMeta
            ? item.dispatcher_work_status
            : showEngineerMeta
              ? item.engineer_work_status
              : null;
          const reason = showDispatcherMeta
            ? item.dispatcher_bucket_reason
            : showEngineerMeta
              ? item.engineer_bucket_reason
              : null;
          return (
          <button
            className={item.id === selectedCaseId ? styles.caseItemActive : styles.caseItem}
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <div className={styles.caseItemTop}>
              <strong>{caseTitle(item)}</strong>
              <span>
                {workStatus
                  ? ENGINEER_WORK_LABELS[workStatus]
                  : (STATUS_LABELS[item.status] ?? item.status)}
              </span>
            </div>
            <div className={styles.caseItemMeta}>
              <span>{item.positions_count} позиций</span>
              <span>{formatDateTime(item.source_date)}</span>
              {showDispatcherMeta && item.dispatcher_stream ? (
                <span>
                  {item.dispatcher_stream === "reorder_point"
                    ? "Точка заказа"
                    : "После инженера"}
                </span>
              ) : null}
            </div>
            {showArchiveMeta && item.closed_reason_label ? (
              <div className={styles.caseItemNote}>{item.closed_reason_label}</div>
            ) : null}
            {reason ? <div className={styles.caseItemNote}>{reason}</div> : null}
          </button>
          );
        })}
      </div>
    </section>
  );
}
