import { Loader2, Trash2 } from "lucide-react";
import type { NdControlDepartment } from "@/types";
import { analysisStatusLabel, isAnalysisRunning } from "./constants";
import styles from "../NdControlAgent.module.css";

type Props = {
  dept: NdControlDepartment;
  selected: boolean;
  canManage: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

function badgeClass(status: string | null | undefined) {
  if (!status) return styles.deptBadgeNeutral;
  if (isAnalysisRunning(status)) return styles.deptBadgeRunning;
  if (status === "completed") return styles.deptBadgeOk;
  if (status === "completed_with_warnings" || status === "needs_review") return styles.deptBadgeReview;
  if (status === "failed") return styles.deptBadgeError;
  return styles.deptBadgeNeutral;
}

export default function DeptSidebarItem({ dept, selected, canManage, onSelect, onDelete }: Props) {
  const label = analysisStatusLabel(dept.analysis_status);
  const running = isAnalysisRunning(dept.analysis_status);

  return (
    <div className={`${styles.deptItem} ${selected ? styles.deptItemActive : ""}`}>
      <button type="button" className={styles.deptItemBtn} onClick={onSelect}>
        <div className={styles.deptItemTop}>
          <strong>{dept.name}</strong>
          {label ? (
            <span className={`${styles.deptBadge} ${badgeClass(dept.analysis_status)}`}>
              {running ? <Loader2 size={12} className={styles.spinIcon} /> : null}
              {label}
            </span>
          ) : null}
        </div>
        <p>
          {dept.knowledge_bases_count} БЗ · {dept.documents_count ?? 0} док. · {dept.cards_count} карточек
        </p>
        <p>
          {dept.processes_count ?? 0} процессов
          {(dept.pending_review_count ?? 0) > 0 ? ` · ${dept.pending_review_count} на проверке` : ""}
        </p>
        {running && dept.analysis_progress_percent != null ? (
          <div className={styles.deptMiniProgress}>
            <div style={{ width: `${Math.max(dept.analysis_progress_percent, 4)}%` }} />
          </div>
        ) : null}
      </button>
      {canManage ? (
        <button type="button" className={styles.deptDeleteBtn} onClick={onDelete} aria-label="Удалить отдел">
          <Trash2 size={16} />
        </button>
      ) : null}
    </div>
  );
}
