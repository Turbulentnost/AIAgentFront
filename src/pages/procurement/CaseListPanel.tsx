import type { ProcurementCaseSummary } from "@/types/procurement";
import { caseTitle, formatDateTime, STATUS_LABELS } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  title: string;
  cases: ProcurementCaseSummary[];
  selectedCaseId: string;
  onSelect: (caseId: string) => void;
  emptyText: string;
  showArchiveMeta?: boolean;
  showEngineerMeta?: boolean;
  showOmtoMeta?: boolean;
};

export function CaseListPanel({
  title,
  cases,
  selectedCaseId,
  onSelect,
  emptyText,
  showArchiveMeta = false,
  showEngineerMeta = false,
  showOmtoMeta = false
}: Props) {
  return (
    <section className={styles.queuePanel}>
      <div className={styles.panelHeader}>
        <h3>{title}</h3>
        <span className={styles.syncBadge}>{cases.length}</span>
      </div>
      {cases.length === 0 ? <div className={styles.emptyState}>{emptyText}</div> : null}
      <div className={styles.caseList}>
        {cases.map((item) => (
          <button
            className={item.id === selectedCaseId ? styles.caseItemActive : styles.caseItem}
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <div className={styles.caseItemTop}>
              <strong>{caseTitle(item)}</strong>
              <span>{STATUS_LABELS[item.status] ?? item.status}</span>
            </div>
            <div className={styles.caseItemMeta}>
              <span>{item.positions_count} позиций</span>
              <span>{formatDateTime(item.source_date)}</span>
            </div>
            {showArchiveMeta && item.closed_reason_label ? (
              <div className={styles.caseItemNote}>{item.closed_reason_label}</div>
            ) : null}
            {showEngineerMeta && item.engineer_bucket_reason ? (
              <div className={styles.caseItemNote}>{item.engineer_bucket_reason}</div>
            ) : null}
            {showOmtoMeta && (item.omto_bucket_reason || item.summary) ? (
              <div className={styles.caseItemNote}>
                {item.omto_bucket_reason || item.summary}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
