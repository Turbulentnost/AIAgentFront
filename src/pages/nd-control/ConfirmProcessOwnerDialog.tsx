import { X } from "lucide-react";
import type { DepartmentProcessItem } from "@/types";
import styles from "../NdControlAgent.module.css";

type Props = {
  process: DepartmentProcessItem | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
};

export default function ConfirmProcessOwnerDialog({ process, onClose, onConfirm, isPending }: Props) {
  if (!process) return null;

  const hasCandidate = Boolean(process.owner.candidate);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{hasCandidate ? "Подтвердить владельца процесса?" : "Назначить владельца процесса?"}</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <dl className={styles.confirmDialogList}>
          <div>
            <dt>Процесс</dt>
            <dd>{process.name}</dd>
          </div>
          <div>
            <dt>Кандидат владельца</dt>
            <dd>{process.owner.candidate ?? "Не указан"}</dd>
          </div>
          <div>
            <dt>Уверенность</dt>
            <dd>{process.owner.confidence_label ?? "—"}</dd>
          </div>
          <div>
            <dt>Документы-источники</dt>
            <dd>
              {process.source_documents.length
                ? process.source_documents.map((doc) => doc.display_name).join("; ")
                : "—"}
            </dd>
          </div>
        </dl>
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryBtn} disabled={isPending} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className={styles.primaryBtn} disabled={isPending || !hasCandidate} onClick={onConfirm}>
            {hasCandidate ? "Подтвердить" : "Назначить"}
          </button>
        </div>
      </div>
    </div>
  );
}
