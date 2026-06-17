import { ClipboardCheck, FileText, Layers, Loader2, Trash2, User, Users } from "lucide-react";
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
    <div className={`${styles.deptCard} ${selected ? styles.deptCardActive : ""}`}>
      {canManage ? (
        <button
          type="button"
          className={styles.deptDeleteBtn}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label="Удалить отдел"
        >
          <Trash2 size={16} />
        </button>
      ) : null}
      <button type="button" className={styles.deptCardBtn} onClick={onSelect}>
        <div className={styles.deptCardHeader}>
          <div className={styles.deptCardIcon} aria-hidden>
            <Users size={18} strokeWidth={2} />
          </div>
          <div className={styles.deptCardTitleBlock}>
            <strong className={styles.deptCardName}>{dept.name}</strong>
            {label ? (
              <span className={`${styles.deptBadge} ${badgeClass(dept.analysis_status)}`}>
                {running ? <Loader2 size={11} className={styles.spinIcon} /> : null}
                {label}
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.deptStatsGrid}>
          <div className={styles.deptStat}>
            <div className={styles.deptStatValue}>
              <Layers size={14} strokeWidth={2} />
              <span>{dept.knowledge_bases_count}</span>
            </div>
            <span className={styles.deptStatLabel}>База знаний</span>
          </div>
          <div className={styles.deptStat}>
            <div className={styles.deptStatValue}>
              <FileText size={14} strokeWidth={2} />
              <span>{dept.documents_count ?? 0}</span>
            </div>
            <span className={styles.deptStatLabel}>Документа</span>
          </div>
          <div className={styles.deptStat}>
            <div className={styles.deptStatValue}>
              <User size={14} strokeWidth={2} />
              <span>{dept.cards_count}</span>
            </div>
            <span className={styles.deptStatLabel}>Карточки</span>
          </div>
          <div className={styles.deptStat}>
            <div className={styles.deptStatValue}>
              <ClipboardCheck size={14} strokeWidth={2} />
              <span>{dept.processes_count ?? 0}</span>
            </div>
            <span className={styles.deptStatLabel}>Процессов</span>
          </div>
        </div>

        {running && dept.analysis_progress_percent != null ? (
          <div className={styles.deptMiniProgress}>
            <div style={{ width: `${Math.max(dept.analysis_progress_percent, 4)}%` }} />
          </div>
        ) : null}
      </button>
    </div>
  );
}
