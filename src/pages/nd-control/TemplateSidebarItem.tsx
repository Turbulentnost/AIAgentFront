import { CheckCircle2, FileStack, Loader2, TriangleAlert } from "lucide-react";
import type { NdControlTemplate } from "@/types";
import { ND_TEMPLATE_TYPE_LABELS, TEMPLATE_CLASSIFICATION_STATUS_LABELS } from "./constants";
import styles from "../NdControlAgent.module.css";

type Props = {
  template: NdControlTemplate;
  selected: boolean;
  onSelect: () => void;
};

function statusSummary(template: NdControlTemplate) {
  const stats = template.classification_stats;
  if (stats.failed > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.failed, className: styles.deptBadgeError, icon: TriangleAlert };
  if (stats.needs_review > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.needs_review, className: styles.deptBadgeReview, icon: TriangleAlert };
  if (stats.processing > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.processing, className: styles.deptBadgeRunning, icon: Loader2 };
  if (stats.pending > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.pending, className: styles.deptBadgeNeutral, icon: FileStack };
  if (stats.completed > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.completed, className: styles.deptBadgeOk, icon: CheckCircle2 };
  return { label: "Без документов", className: styles.deptBadgeNeutral, icon: FileStack };
}

export default function TemplateSidebarItem({ template, selected, onSelect }: Props) {
  const status = statusSummary(template);
  const StatusIcon = status.icon;
  const typeLabel = template.template_type_label || ND_TEMPLATE_TYPE_LABELS[template.template_type];

  return (
    <div className={`${styles.deptCard} ${selected ? styles.deptCardActive : ""}`}>
      <button type="button" className={styles.deptCardBtn} onClick={onSelect}>
        <div className={styles.deptCardHeader}>
          <div className={styles.deptCardIcon} aria-hidden>
            <FileStack size={18} strokeWidth={2} />
          </div>
          <div className={styles.deptCardTitleBlock}>
            <strong className={styles.deptCardName}>{template.name}</strong>
            <span className={styles.entityType}>{typeLabel}</span>
            <span className={`${styles.deptBadge} ${status.className}`}>
              <StatusIcon size={11} className={status.icon === Loader2 ? styles.spinIcon : undefined} />
              {status.label}
            </span>
          </div>
        </div>

        <div className={styles.deptStatsGrid}>
          <div className={styles.deptStat}>
            <div className={styles.deptStatValue}>
              <FileStack size={14} strokeWidth={2} />
              <span>{template.documents_count}</span>
            </div>
            <span className={styles.deptStatLabel}>Документов</span>
          </div>
          <div className={styles.deptStat}>
            <div className={styles.deptStatValue}>
              <CheckCircle2 size={14} strokeWidth={2} />
              <span>{template.classification_stats.completed}</span>
            </div>
            <span className={styles.deptStatLabel}>Готово</span>
          </div>
          <div className={styles.deptStat}>
            <div className={styles.deptStatValue}>
              <TriangleAlert size={14} strokeWidth={2} />
              <span>{template.classification_stats.needs_review + template.classification_stats.failed}</span>
            </div>
            <span className={styles.deptStatLabel}>Проверка</span>
          </div>
        </div>
      </button>
    </div>
  );
}
