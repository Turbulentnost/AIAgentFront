import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import styles from "./MeetingAgent.module.css";

const MESSAGE_MAX = 2000;

type Props = {
  open: boolean;
  meetingLabel: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (message: string) => void;
};

export default function MeetingAgentRegistryCancelModal({
  open,
  meetingLabel,
  loading,
  error,
  onClose,
  onConfirm
}: Props) {
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setValidationError(null);
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    const trimmed = message.trim();
    if (trimmed.length > MESSAGE_MAX) {
      setValidationError(`Не более ${MESSAGE_MAX} символов`);
      return;
    }
    setValidationError(null);
    onConfirm(trimmed);
  }

  const messageLength = message.trim().length;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-registry-cancel-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="meeting-registry-cancel-title">Отменить совещание</h2>
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

        <p className={styles.modalHint}>{meetingLabel}</p>
        <p className={styles.modalHint}>
          Приглашение будет отменено в Outlook. Участники получат уведомление об отмене.
        </p>

        <div className={styles.rejectReasonField}>
          <label htmlFor="meeting-registry-cancel-message">Причина отмены (необязательно)</label>
          <textarea
            id="meeting-registry-cancel-message"
            className={styles.rejectReasonInput}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Комментарий для участников"
            maxLength={MESSAGE_MAX}
            rows={4}
            disabled={loading}
          />
          <span className={styles.rejectReasonMeta}>
            {messageLength} / {MESSAGE_MAX}
          </span>
        </div>

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
            Закрыть
          </button>
          <button type="button" className={styles.rejectButton} disabled={loading} onClick={handleSubmit}>
            {loading ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Отменяем…
              </>
            ) : (
              "Отменить совещание"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
