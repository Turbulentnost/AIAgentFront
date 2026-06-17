import { X } from "lucide-react";
import styles from "../NdControlAgent.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: { forceReextract: boolean }) => void;
  isPending: boolean;
};

export default function ReanalyzeConfirmDialog({ open, onClose, onConfirm, isPending }: Props) {
  if (!open) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Переанализировать отдел?</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <p className={styles.modalText}>
          Уже подтверждённые связи не будут удалены. По умолчанию будут обработаны только документы со
          статусом failed или needs_review.
        </p>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={isPending}
            onClick={() => onConfirm({ forceReextract: false })}
          >
            Обработать failed/needs_review
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={isPending}
            onClick={() => onConfirm({ forceReextract: true })}
          >
            Переизвлечь все карточки
          </button>
        </div>
      </div>
    </div>
  );
}
