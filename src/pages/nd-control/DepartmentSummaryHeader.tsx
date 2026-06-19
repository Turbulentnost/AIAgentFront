import { RefreshCw } from "lucide-react";
import type { DepartmentSummary } from "@/types";
import { analysisStatusLabel } from "./constants";
import { formatDateTime } from "./utils";
import styles from "../NdControlAgent.module.css";

type Props = {
  summary: DepartmentSummary;
  canReanalyze: boolean;
  isReanalyzing: boolean;
  onReanalyze: () => void;
  onOpenReview?: () => void;
};

function statusClass(status: string | null | undefined) {
  if (!status) return styles.statusNeutral;
  if (status === "pending" || status === "running") return styles.statusRunning;
  if (status === "completed") return styles.statusOk;
  if (status === "completed_with_warnings" || status === "needs_review") return styles.statusReview;
  if (status === "failed") return styles.statusError;
  return styles.statusNeutral;
}

export default function DepartmentSummaryHeader({
  summary,
  canReanalyze,
  isReanalyzing,
  onReanalyze,
  onOpenReview
}: Props) {
  const label = analysisStatusLabel(summary.analysis_status);
  const lastRunAt = summary.last_analysis_at ?? summary.last_analysis_run?.finished_at ?? summary.last_analysis_run?.started_at;

  return (
    <div className={styles.deptHeader}>
      <div className={styles.deptHeaderMain}>
        <div className={styles.deptHeaderTitleRow}>
          <h2>{summary.department_name}</h2>
          {label ? (
            <span className={`${styles.statusBadge} ${statusClass(summary.analysis_status)}`}>{label}</span>
          ) : null}
        </div>
        <p className={styles.deptHeaderMeta}>
          Базы знаний: {summary.knowledge_bases_count ?? summary.knowledge_bases.length} · Документы:{" "}
          {summary.documents_count} · Карточки: {summary.document_cards_count} · Процессы:{" "}
          {summary.processes_count} · Связи: {summary.relations_count}
          {summary.pending_review_count > 0 ? (
            <>
              {" "}
              ·{" "}
              <button type="button" className={styles.inlineLinkBtn} onClick={onOpenReview}>
                Проверка: {summary.pending_review_count}
              </button>
            </>
          ) : null}
        </p>
        <p className={styles.deptHeaderSub}>Последний анализ: {formatDateTime(lastRunAt)}</p>
      </div>
      {canReanalyze ? (
        <button type="button" className={styles.primaryBtn} onClick={onReanalyze} disabled={isReanalyzing}>
          <RefreshCw size={16} className={isReanalyzing ? styles.spinIcon : undefined} />
          {isReanalyzing ? "Запуск…" : "Переанализировать"}
        </button>
      ) : null}
    </div>
  );
}
