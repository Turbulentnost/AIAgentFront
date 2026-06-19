import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { MeetingAgentSlotPreview } from "@/types/meetings";
import styles from "./MeetingAgent.module.css";

type Props = {
  open: boolean;
  loading: boolean;
  preview: MeetingAgentSlotPreview | null;
  requestError: string | null;
  approveError: string | null;
  onClose: () => void;
  onConfirmApprove?: () => void;
  isApproving?: boolean;
};

export default function MeetingAgentSlotPreviewModal({
  open,
  loading,
  preview,
  requestError,
  approveError,
  onClose,
  onConfirmApprove,
  isApproving = false
}: Props) {
  if (!open) return null;

  const previewError = preview?.error?.trim() || null;
  const canApprove = Boolean(preview && !previewError && !requestError && preview.slot);

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-slot-preview-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="meeting-slot-preview-title">Проверка календарей</h2>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="Закрыть">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className={styles.modalLoader}>
            <Loader2 size={22} className={styles.spinner} aria-hidden="true" />
            <span>Ищем ближайший свободный слот…</span>
          </div>
        ) : requestError ? (
          <div className={styles.modalError} role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{requestError}</span>
          </div>
        ) : preview ? (
          <>
            {previewError ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{previewError}</span>
              </div>
            ) : preview.slot_label ? (
              <div className={styles.modalSlotHighlight}>
                <strong>Ближайший свободный слот</strong>
                <p>{preview.slot_label}</p>
                {preview.duration_minutes ? (
                  <span className={styles.modalSlotMeta}>Длительность: {preview.duration_minutes} мин</span>
                ) : null}
              </div>
            ) : null}

            {preview.attendees.length ? (
              <section className={styles.modalSection} aria-label="Проверенные календари">
                <h3>Кого проверяли</h3>
                <ul className={styles.attendeeList}>
                  {preview.attendees.map((attendee) => (
                    <li className={styles.attendeeItem} key={`${attendee.role}-${attendee.fio}`}>
                      <span className={styles.attendeeRole}>{attendee.role_label}</span>
                      <span className={styles.attendeeName}>{attendee.fio}</span>
                      {attendee.email ? (
                        <span className={styles.attendeeEmail}>{attendee.email}</span>
                      ) : null}
                      <span
                        className={`${styles.attendeeStatus} ${
                          attendee.found ? styles.attendeeStatusOk : styles.attendeeStatusMissing
                        }`}
                      >
                        {attendee.found ? (
                          <>
                            <CheckCircle2 size={14} aria-hidden="true" />
                            Найден
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={14} aria-hidden="true" />
                            E-mail не найден
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {approveError ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{approveError}</span>
              </div>
            ) : null}
          </>
        ) : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isApproving}>
            Закрыть
          </button>
          {canApprove && onConfirmApprove ? (
            <button
              type="button"
              className={styles.primaryButton}
              disabled={isApproving}
              onClick={onConfirmApprove}
            >
              {isApproving ? (
                <>
                  <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                  Отправляем приглашения…
                </>
              ) : (
                "Утвердить"
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
