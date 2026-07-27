import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import styles from "./MeetingAgent.module.css";

const REASON_MAX = 2000;

type Props = {
  open: boolean;
  memoLabel: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (payload: { reason: string; notifyInitiator: boolean }) => void;
};

export default function MeetingAgentRejectModal({
  open,
  memoLabel,
  loading,
  error,
  onClose,
  onConfirm
}: Props) {
  const [reason, setReason] = useState("");
  const [notifyInitiator, setNotifyInitiator] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setNotifyInitiator(true);
    setValidationError(null);
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError("Укажите причину отклонения");
      return;
    }
    if (trimmed.length > REASON_MAX) {
      setValidationError(`Не более ${REASON_MAX} символов`);
      return;
    }
    setValidationError(null);
    onConfirm({ reason: trimmed, notifyInitiator });
  }

  const reasonLength = reason.trim().length;
  const canSubmit = reasonLength > 0 && reasonLength <= REASON_MAX;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-reject-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="meeting-reject-title">Отклонить служебную записку</h2>
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

        <div className={styles.rejectReasonField}>
          <label htmlFor="meeting-reject-reason">Причина отклонения</label>
          <textarea
            id="meeting-reject-reason"
            className={styles.rejectReasonInput}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Опишите, почему заявка отклоняется"
            maxLength={REASON_MAX}
            rows={4}
            disabled={loading}
          />
          <span className={styles.rejectReasonMeta}>
            {reasonLength} / {REASON_MAX}
          </span>
        </div>

        <label className={styles.rejectNotifyField}>
          <input
            type="checkbox"
            checked={notifyInitiator}
            onChange={(event) => setNotifyInitiator(event.target.checked)}
            disabled={loading}
          />
          <span>Уведомить инициатора</span>
        </label>

        {validationError ? (
          <div className={styles.modalError} role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{validationError}</span>
          </div>
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
          <button
            type="button"
            className={styles.rejectButton}
            disabled={loading || !canSubmit}
            onClick={handleSubmit}
          >
            {loading ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Отклоняем…
              </>
            ) : (
              "Отклонить"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
