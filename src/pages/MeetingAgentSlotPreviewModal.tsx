import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, X } from "lucide-react";
import type {
  MeetingAgentSlotPreview,
  MeetingAgentSlotPreviewDetails,
  MeetingAttendee,
  MeetingSlotCandidate,
  MeetingSlotPreviewParticipant
} from "@/types/meetings";
import {
  buildMeetingAttendeesByEmail,
  formatMeetingBlockingEventRange,
  formatMeetingConflictMovability,
  formatMeetingSlotCandidateCoverage,
  formatMeetingSlotCoverage,
  formatMeetingSlotParticipantStatus,
  formatMeetingSlotPreviewErrorStage,
  getMeetingAttendeeRoleLabel,
  isMeetingSlotPreviewAssignable,
  isMeetingSlotPreviewPartial,
  resolveMeetingAttendeeFioByEmail,
  resolveMeetingSlotCandidateTimes,
  resolveMeetingSlotPreviewDuration,
  resolveMeetingSlotPreviewLabel
} from "@/utils/meetingDashboard";
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
  approveWithMemo?: boolean;
  onFetchSlotDetails?: (
    slotStart: string,
    slotEnd: string
  ) => Promise<MeetingAgentSlotPreviewDetails>;
};

function ParticipantDetails({
  participant
}: {
  participant: MeetingSlotPreviewParticipant;
}) {
  const roleLabel = participant.role_label?.trim() || participant.role;

  return (
    <li className={styles.slotParticipantItem}>
      <div className={styles.slotParticipantHeader}>
        <span className={styles.slotParticipantRole}>{roleLabel}</span>
        <span className={styles.slotParticipantName}>{participant.fio}</span>
        {participant.email ? (
          <span className={styles.slotParticipantEmail}>{participant.email}</span>
        ) : null}
        <span
          className={`${styles.slotParticipantStatus} ${
            participant.status === "free"
              ? styles.slotParticipantStatusFree
              : participant.status === "busy"
                ? styles.slotParticipantStatusBusy
                : styles.slotParticipantStatusUnknown
          }`}
        >
          {formatMeetingSlotParticipantStatus(participant)}
        </span>
      </div>

      {participant.status === "busy" && participant.blocking_events.length ? (
        <ul className={styles.slotBlockingEvents}>
          {participant.blocking_events.map((event, index) => (
            <li
              className={styles.slotBlockingEvent}
              key={`${event.event_label}-${event.event_start ?? index}`}
            >
              <span className={styles.slotBlockingEventLabel}>{event.event_label}</span>
              <span className={styles.slotBlockingEventMeta}>
                {formatMeetingBlockingEventRange(event)}
                {event.event_attendee_names?.length
                  ? ` · участники: ${event.event_attendee_names.join(", ")}`
                  : ""}
                {event.movability
                  ? ` · переносимость: ${formatMeetingConflictMovability(event.movability)}`
                  : ""}
                {event.reschedule_hint_label?.trim()
                  ? ` · альтернатива: ${event.reschedule_hint_label.trim()}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {participant.calendar_access_error ? (
        <p className={styles.slotParticipantAccessError}>{participant.calendar_access_error}</p>
      ) : null}
    </li>
  );
}

function SlotCandidateCard({
  candidate,
  index,
  expanded,
  detailsLoading,
  details,
  detailsError,
  attendeesByEmail,
  onToggle
}: {
  candidate: MeetingSlotCandidate;
  index: number;
  expanded: boolean;
  detailsLoading: boolean;
  details: MeetingAgentSlotPreviewDetails | null;
  detailsError: string | null;
  attendeesByEmail: Record<string, MeetingAttendee>;
  onToggle: () => void;
}) {
  const slotTimes = resolveMeetingSlotCandidateTimes(candidate);
  const freeNames = candidate.free_attendees.map((email) =>
    resolveMeetingAttendeeFioByEmail(attendeesByEmail, email)
  );
  const busyNames = candidate.busy_attendees.map((email) =>
    resolveMeetingAttendeeFioByEmail(attendeesByEmail, email)
  );

  return (
    <article
      className={`${styles.slotCandidateCard} ${expanded ? styles.slotCandidateCardExpanded : ""}`}
    >
      <button
        type="button"
        className={styles.slotCandidateHeader}
        onClick={onToggle}
        aria-expanded={expanded}
        disabled={!slotTimes}
      >
        <div className={styles.slotCandidateTitleRow}>
          <strong className={styles.slotCandidateLabel}>{candidate.slot_label}</strong>
          {index === 0 ? (
            <span className={styles.slotCandidateBadge}>Рекомендуем</span>
          ) : null}
        </div>
        <p className={styles.slotCandidateCoverage}>
          {formatMeetingSlotCandidateCoverage(candidate.coverage)}
        </p>
        {candidate.reschedule_count != null && candidate.reschedule_count > 0 ? (
          <p className={styles.slotCandidateMeta}>Переносов: {candidate.reschedule_count}</p>
        ) : null}
        <div className={styles.slotCandidateAttendees}>
          {freeNames.length ? (
            <p className={`${styles.slotCandidateAttendeeGroup} ${styles.slotCandidateAttendeeGroupFree}`}>
              <span className={styles.slotCandidateAttendeeLabel}>Свободны:</span> {freeNames.join(", ")}
            </p>
          ) : null}
          {busyNames.length ? (
            <p className={`${styles.slotCandidateAttendeeGroup} ${styles.slotCandidateAttendeeGroupBusy}`}>
              <span className={styles.slotCandidateAttendeeLabel}>Перенос:</span> {busyNames.join(", ")}
            </p>
          ) : null}
        </div>
        <ChevronDown
          size={16}
          className={`${styles.slotCandidateChevron} ${expanded ? styles.slotCandidateChevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div className={styles.slotCandidateDetails}>
          {detailsLoading ? (
            <div className={styles.slotCandidateDetailsLoader}>
              <Loader2 size={18} className={styles.spinner} aria-hidden="true" />
              <span>Загружаем детали слота…</span>
            </div>
          ) : detailsError ? (
            <div className={styles.modalError} role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{detailsError}</span>
            </div>
          ) : details?.error ? (
            <div className={styles.modalError} role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{details.error}</span>
            </div>
          ) : details?.participants.length ? (
            <ul className={styles.slotParticipantList}>
              {details.participants.map((participant) => (
                <ParticipantDetails
                  key={`${participant.role}-${participant.fio}-${participant.email ?? "no-email"}`}
                  participant={participant}
                />
              ))}
            </ul>
          ) : (
            <p className={styles.modalHint}>Нет данных по участникам для этого слота.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

export default function MeetingAgentSlotPreviewModal({
  open,
  loading,
  preview,
  requestError,
  approveError,
  onClose,
  onConfirmApprove,
  isApproving = false,
  approveWithMemo = false,
  onFetchSlotDetails
}: Props) {
  const [expandedCandidateIndex, setExpandedCandidateIndex] = useState<number | null>(null);
  const [detailsByIndex, setDetailsByIndex] = useState<
    Record<number, MeetingAgentSlotPreviewDetails>
  >({});
  const [detailsLoadingIndex, setDetailsLoadingIndex] = useState<number | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const isPartial = preview ? isMeetingSlotPreviewPartial(preview) : false;
  const candidates = useMemo(() => preview?.slot_candidates?.slice(0, 3) ?? [], [preview?.slot_candidates]);
  const attendeesByEmail = useMemo(
    () => buildMeetingAttendeesByEmail(preview?.attendees ?? []),
    [preview?.attendees]
  );

  const resetDetailsState = useCallback(() => {
    setExpandedCandidateIndex(null);
    setDetailsByIndex({});
    setDetailsLoadingIndex(null);
    setDetailsError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetDetailsState();
  }, [open, preview?.memo_ref_key, preview?.search_mode, resetDetailsState]);

  const handleToggleCandidate = useCallback(
    async (index: number) => {
      const candidate = candidates[index];
      if (!candidate) return;

      if (expandedCandidateIndex === index) {
        setExpandedCandidateIndex(null);
        setDetailsError(null);
        return;
      }

      const slotTimes = resolveMeetingSlotCandidateTimes(candidate);
      if (!slotTimes) {
        setDetailsError("Не удалось определить время слота.");
        setExpandedCandidateIndex(index);
        return;
      }

      setExpandedCandidateIndex(index);
      setDetailsError(null);

      if (detailsByIndex[index]) return;

      if (!onFetchSlotDetails) {
        setDetailsError("Загрузка деталей недоступна.");
        return;
      }

      setDetailsLoadingIndex(index);
      try {
        const details = await onFetchSlotDetails(slotTimes.start, slotTimes.end);
        setDetailsByIndex((current) => ({ ...current, [index]: details }));
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Не удалось загрузить детали слота.";
        setDetailsError(message);
      } finally {
        setDetailsLoadingIndex(null);
      }
    },
    [candidates, detailsByIndex, expandedCandidateIndex, onFetchSlotDetails]
  );

  if (!open) return null;

  const previewError = preview?.error?.trim() || null;
  const previewErrorStage = formatMeetingSlotPreviewErrorStage(preview?.error_stage);
  const hasPreviewError = Boolean(previewError);
  const isAllMode = preview ? isMeetingSlotPreviewAssignable(preview) : false;
  const slotLabel = preview ? resolveMeetingSlotPreviewLabel(preview) : null;
  const slotDuration = preview ? resolveMeetingSlotPreviewDuration(preview) : null;
  const canApprove = Boolean(preview && !hasPreviewError && !requestError && isAllMode);

  const approveButtonLabel = approveWithMemo ? "Согласовать и утвердить" : "Утвердить";
  const approveLoadingLabel = approveWithMemo ? "Согласуем и утверждаем…" : "Утверждаем…";

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
            {hasPreviewError ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <div className={styles.modalErrorContent}>
                  <span>{previewError}</span>
                  {previewErrorStage ? (
                    <span className={styles.modalErrorStage}>Этап: {previewErrorStage}</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                {isAllMode && slotLabel ? (
                  <div className={styles.modalSlotHighlight}>
                    <strong>Общий свободный слот</strong>
                    <p>{slotLabel}</p>
                    {slotDuration ? (
                      <span className={styles.modalSlotMeta}>Длительность: {slotDuration} мин</span>
                    ) : null}
                    {preview.coverage ? (
                      <span className={styles.modalSlotMeta}>
                        Покрытие: {formatMeetingSlotCoverage(preview.coverage)}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {isPartial ? (
                  <>
                    {preview.preview_note ? (
                      <div className={styles.modalSlotWarning} role="status">
                        <AlertTriangle size={16} aria-hidden="true" />
                        <span>{preview.preview_note}</span>
                      </div>
                    ) : null}

                    {preview.coverage ? (
                      <p className={styles.modalHint}>
                        Лучший вариант: {formatMeetingSlotCandidateCoverage(preview.coverage)}
                        {preview.coverage.required_ok === false ? " · недостаточное покрытие" : ""}
                      </p>
                    ) : null}

                    {candidates.length ? (
                      <section className={styles.modalSection} aria-label="Варианты слотов">
                        <h3>Варианты с конфликтами</h3>
                        <div className={styles.slotCandidateList}>
                          {candidates.map((candidate, index) => (
                            <SlotCandidateCard
                              key={`${candidate.slot_label}-${index}`}
                              candidate={candidate}
                              index={index}
                              expanded={expandedCandidateIndex === index}
                              detailsLoading={detailsLoadingIndex === index}
                              details={detailsByIndex[index] ?? null}
                              detailsError={expandedCandidateIndex === index ? detailsError : null}
                              attendeesByEmail={attendeesByEmail}
                              onToggle={() => void handleToggleCandidate(index)}
                            />
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </>
                ) : null}

                {isAllMode && preview.attendees.length ? (
                  <section className={styles.modalSection} aria-label="Проверенные календари">
                    <h3>Кого проверяли</h3>
                    <ul className={styles.attendeeList}>
                      {preview.attendees.map((attendee) => (
                        <li className={styles.attendeeItem} key={`${attendee.role}-${attendee.fio}`}>
                          <span className={styles.attendeeRole}>{getMeetingAttendeeRoleLabel(attendee)}</span>
                          <span className={styles.attendeeName}>{attendee.fio}</span>
                          {attendee.email ? (
                            <span className={styles.attendeeEmail}>{attendee.email}</span>
                          ) : null}
                          {attendee.nearest_slot_label ? (
                            <div className={styles.attendeeSlot}>
                              <span className={styles.attendeeSlotLabel}>Ближайший свободный слот</span>
                              <span className={styles.attendeeSlotTime}>{attendee.nearest_slot_label}</span>
                            </div>
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
              </>
            )}

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
                  {approveLoadingLabel}
                </>
              ) : (
                approveButtonLabel
              )}
            </button>
          ) : isPartial && !hasPreviewError ? (
            <button
              type="button"
              className={styles.primaryButton}
              disabled
              title="Утверждение недоступно без общего слота"
            >
              Утвердить
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
