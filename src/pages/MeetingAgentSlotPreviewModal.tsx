import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, X } from "lucide-react";
import type {
  MeetingAgentSlotPreview,
  MeetingAgentSlotPreviewDetails,
  MeetingAttendee,
  MeetingSlotCandidate,
  MeetingSlotPreviewParticipant,
  MeetingSlotRescheduleRecommendation,
  MeetingSlotRoomStatus
} from "@/types/meetings";
import {
  buildMeetingAttendeesByEmail,
  filterMeetingSlotPreviewPeople,
  filterPreviewAttendeePeople,
  formatMeetingBlockingEventRange,
  formatMeetingConflictMovability,
  formatMeetingSlotCandidateCoverage,
  formatMeetingSlotCoverage,
  formatMeetingSlotParticipantStatus,
  formatMeetingSlotPreviewErrorStage,
  formatMeetingTime,
  getMeetingAttendeeRoleLabel,
  isMeetingSlotDetailAvailable,
  isMeetingSlotPreviewAssignable,
  isMeetingSlotPreviewPartial,
  resolveManualSlotDefaultsFromIso,
  resolveMeetingAttendeeFioByEmail,
  resolveMeetingSlotCandidateTimes,
  resolveMeetingSlotPreview,
  resolveMeetingSlotPreviewDuration,
  resolveMeetingSlotPreviewLabel,
  resolveMeetingSlotPreviewRoom
} from "@/utils/meetingDashboard";
import MeetingAgentManualSlotModal from "@/pages/MeetingAgentManualSlotModal";
import styles from "./MeetingAgent.module.css";

type Props = {
  open: boolean;
  loading: boolean;
  preview: MeetingAgentSlotPreview | null;
  requestError: string | null;
  approveError: string | null;
  onClose: () => void;
  onConfirmApprove?: (slotOverride?: { start: string; end: string }) => void;
  isApproving?: boolean;
  approveWithMemo?: boolean;
  approveButtonLabel?: string;
  approveLoadingLabel?: string;
  mode?: "agent" | "reschedule";
  previousSlotLabel?: string | null;
  previousSlotStart?: string | null;
  previousSlotEnd?: string | null;
  searchAfter?: string | null;
  onFetchSlotDetails?: (
    slotStart: string,
    slotEnd: string
  ) => Promise<MeetingAgentSlotPreviewDetails>;
};

function RoomDetailsCard({
  room,
  variant = "attendee"
}: {
  room: MeetingSlotRoomStatus;
  variant?: "attendee" | "slot";
}) {
  const isFree = room.status === "free";
  const statusClass = isFree ? styles.attendeeStatusOk : styles.attendeeStatusMissing;
  const statusIcon = isFree ? (
    <CheckCircle2 size={14} aria-hidden="true" />
  ) : (
    <AlertTriangle size={14} aria-hidden="true" />
  );

  if (variant === "slot") {
    return (
      <li className={styles.slotParticipantItem}>
        <div className={styles.slotParticipantHeader}>
          <span className={styles.slotParticipantRole}>Переговорная</span>
          <span className={styles.slotParticipantName}>{room.name}</span>
          {room.email ? <span className={styles.slotParticipantEmail}>{room.email}</span> : null}
          <span className={`${styles.slotParticipantStatus} ${statusClass}`}>
            {statusIcon}
            {room.status_label}
          </span>
        </div>
        {room.calendar_access_error ? (
          <p className={styles.slotParticipantAccessError}>{room.calendar_access_error}</p>
        ) : null}
      </li>
    );
  }

  return (
    <li className={styles.attendeeItem}>
      <span className={styles.attendeeRole}>Переговорная</span>
      <span className={styles.attendeeName}>{room.name}</span>
      {room.email ? <span className={styles.attendeeEmail}>{room.email}</span> : null}
      <span className={`${styles.attendeeStatus} ${statusClass}`}>
        {statusIcon}
        {room.status_label}
      </span>
      {room.calendar_access_error ? (
        <p className={styles.slotParticipantAccessError}>{room.calendar_access_error}</p>
      ) : null}
    </li>
  );
}

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

      {participant.status === "busy" && (participant.blocking_events ?? []).length ? (
        <ul className={styles.slotBlockingEvents}>
          {(participant.blocking_events ?? []).map((event, index) => (
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

function ManualSlotCheckSummary({
  loading,
  available,
  recommendations,
  detailsError,
  detailsErrorStage
}: {
  loading: boolean;
  available: boolean | null;
  recommendations: MeetingSlotRescheduleRecommendation[];
  detailsError: string | null;
  detailsErrorStage: string | null;
}) {
  if (loading) {
    return (
      <div className={styles.modalSlotChecking} role="status">
        <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
        <span>Проверяем календари участников…</span>
      </div>
    );
  }

  if (detailsError) {
    return (
      <div className={styles.modalError} role="alert">
        <AlertTriangle size={16} aria-hidden="true" />
        <div className={styles.modalErrorContent}>
          <span>{detailsError}</span>
          {detailsErrorStage ? (
            <span className={styles.modalErrorStage}>Этап: {detailsErrorStage}</span>
          ) : null}
        </div>
      </div>
    );
  }

  if (available === null) return null;

  if (available) {
    return (
      <div className={styles.modalSlotSuccess} role="status">
        <CheckCircle2 size={16} aria-hidden="true" />
        <span>Слот свободен</span>
      </div>
    );
  }

  return (
    <div className={styles.modalSlotWarning} role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <div>
        <strong>Для освобождения слота нужно перенести:</strong>
        {recommendations.length ? (
          <ul className={styles.manualSlotRescheduleList}>
            {recommendations.map((item, index) => (
              <li key={`${item.participant_fio}-${item.event_label}-${index}`}>
                <strong>{item.participant_fio}</strong>
                {": "}
                {item.event_label}
                {item.event_time_label ? ` (${item.event_time_label})` : ""}
                {item.reschedule_hint_label?.trim()
                  ? ` → ${item.reschedule_hint_label.trim()}`
                  : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>Есть конфликты в календарях — см. детали ниже.</p>
        )}
      </div>
    </div>
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
  const freeNames = (candidate.free_attendees ?? []).map((email) =>
    resolveMeetingAttendeeFioByEmail(attendeesByEmail, email)
  );
  const busyNames = (candidate.busy_attendees ?? []).map((email) =>
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
          ) : details ? (
            (() => {
              const people = filterMeetingSlotPreviewPeople(details.participants);
              const room = resolveMeetingSlotPreviewRoom(details);

              if (!people.length && !room) {
                return <p className={styles.modalHint}>Нет данных по участникам для этого слота.</p>;
              }

              return (
                <ul className={styles.slotParticipantList}>
                  {people.map((participant) => (
                    <ParticipantDetails
                      key={`${participant.role}-${participant.fio}-${participant.email ?? "no-email"}`}
                      participant={participant}
                    />
                  ))}
                  {room ? <RoomDetailsCard room={room} variant="slot" /> : null}
                </ul>
              );
            })()
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
  approveButtonLabel: approveButtonLabelProp,
  approveLoadingLabel: approveLoadingLabelProp,
  mode = "agent",
  previousSlotLabel = null,
  previousSlotStart = null,
  previousSlotEnd = null,
  searchAfter = null,
  onFetchSlotDetails
}: Props) {
  const [expandedCandidateIndex, setExpandedCandidateIndex] = useState<number | null>(null);
  const [detailsByIndex, setDetailsByIndex] = useState<
    Record<number, MeetingAgentSlotPreviewDetails>
  >({});
  const [detailsLoadingIndex, setDetailsLoadingIndex] = useState<number | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [allModeDetails, setAllModeDetails] = useState<MeetingAgentSlotPreviewDetails | null>(null);
  const [allModeDetailsLoading, setAllModeDetailsLoading] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualSlot, setManualSlot] = useState<{ start: string; end: string; label: string } | null>(
    null
  );

  const isPartial = preview ? isMeetingSlotPreviewPartial(preview) : false;
  const isAllMode = preview ? isMeetingSlotPreviewAssignable(preview) : false;
  const autoModeSlot = preview && isAllMode ? resolveMeetingSlotPreview(preview) : null;
  const activeSlot = manualSlot ?? autoModeSlot;
  const candidates = useMemo(() => preview?.slot_candidates?.slice(0, 3) ?? [], [preview?.slot_candidates]);
  const previewAttendees = preview?.attendees ?? [];
  const previewPeople = useMemo(
    () => filterPreviewAttendeePeople(previewAttendees),
    [previewAttendees]
  );
  const attendeesByEmail = useMemo(
    () => buildMeetingAttendeesByEmail(previewAttendees),
    [previewAttendees]
  );
  const onFetchSlotDetailsRef = useRef(onFetchSlotDetails);

  useEffect(() => {
    onFetchSlotDetailsRef.current = onFetchSlotDetails;
  }, [onFetchSlotDetails]);

  const resetDetailsState = useCallback(() => {
    setExpandedCandidateIndex(null);
    setDetailsByIndex({});
    setDetailsLoadingIndex(null);
    setDetailsError(null);
    setAllModeDetails(null);
    setAllModeDetailsLoading(false);
    setManualModalOpen(false);
    setManualSlot(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetDetailsState();
  }, [open, preview?.memo_ref_key, preview?.search_mode, resetDetailsState]);

  useEffect(() => {
    const previewRoomNow = preview ? resolveMeetingSlotPreviewRoom(preview) : null;
    if (previewRoomNow && !manualSlot) {
      setAllModeDetails(null);
      setAllModeDetailsLoading(false);
      return;
    }

    if (!open || !activeSlot) {
      setAllModeDetails(null);
      setAllModeDetailsLoading(false);
      return;
    }

    const fetchDetails = onFetchSlotDetailsRef.current;
    if (!fetchDetails) return;

    let cancelled = false;
    setAllModeDetailsLoading(true);
    setAllModeDetails(null);

    void fetchDetails(activeSlot.start, activeSlot.end)
      .then((details) => {
        if (!cancelled) setAllModeDetails(details);
      })
      .catch(() => {
        if (!cancelled) setAllModeDetails(null);
      })
      .finally(() => {
        if (!cancelled) setAllModeDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, activeSlot?.start, activeSlot?.end, preview, manualSlot]);

  const manualDetailsPeople = useMemo(
    () => (allModeDetails ? filterMeetingSlotPreviewPeople(allModeDetails.participants) : []),
    [allModeDetails]
  );
  const manualSlotDefaults = useMemo(() => {
    const autoSlot = preview && isAllMode ? resolveMeetingSlotPreview(preview) : null;
    return resolveManualSlotDefaultsFromIso(autoSlot?.start ?? manualSlot?.start);
  }, [preview, isAllMode, manualSlot?.start]);
  const manualSlotAvailable = manualSlot ? isMeetingSlotDetailAvailable(allModeDetails) : null;
  const manualSlotRecommendations = allModeDetails?.reschedule_recommendations ?? [];
  const manualSlotDetailsError = allModeDetails?.error?.trim() || null;
  const manualSlotDetailsErrorStage = formatMeetingSlotPreviewErrorStage(allModeDetails?.error_stage);
  const manualSlotCheckComplete = Boolean(
    manualSlot && !allModeDetailsLoading && allModeDetails && !manualSlotDetailsError
  );

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

      if (!onFetchSlotDetailsRef.current) {
        setDetailsError("Загрузка деталей недоступна.");
        return;
      }

      setDetailsLoadingIndex(index);
      try {
        const details = await onFetchSlotDetailsRef.current(slotTimes.start, slotTimes.end);
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
    [candidates, detailsByIndex, expandedCandidateIndex]
  );

  if (!open) return null;

  const previewError = preview?.error?.trim() || null;
  const previewErrorStage = formatMeetingSlotPreviewErrorStage(preview?.error_stage);
  const hasPreviewError = Boolean(previewError);
  const slotLabel = preview ? resolveMeetingSlotPreviewLabel(preview) : null;
  const slotDuration = preview ? resolveMeetingSlotPreviewDuration(preview) : null;
  const previewRoom = manualSlot
    ? allModeDetails
      ? resolveMeetingSlotPreviewRoom(allModeDetails)
      : null
    : preview
      ? resolveMeetingSlotPreviewRoom(preview) ??
        (allModeDetails ? resolveMeetingSlotPreviewRoom(allModeDetails) : null)
      : null;
  const showManualDetails = Boolean(manualSlot);
  const manualSlotReady =
    !manualSlot || (manualSlotCheckComplete && manualSlotAvailable === true);
  const hasActiveSlotContext = Boolean(
    activeSlot && !requestError && (isAllMode || manualSlot) && (!hasPreviewError || manualSlot)
  );
  const canShowAgentApprove = mode === "agent" && Boolean(onConfirmApprove) && hasActiveSlotContext;
  const canShowRescheduleApprove =
    mode === "reschedule" && Boolean(onConfirmApprove) && hasActiveSlotContext;
  const isApproveEnabled = !isApproving && manualSlotReady;
  const approveDisabledTitle = manualSlot && allModeDetailsLoading
    ? "Проверяем доступность слота…"
    : manualSlot && manualSlotDetailsError
      ? "Не удалось проверить слот"
      : manualSlot && manualSlotCheckComplete && manualSlotAvailable === false
        ? "Слот занят — выберите другое время"
        : manualSlot && !manualSlotCheckComplete
          ? "Дождитесь проверки слота"
          : undefined;
  const canScheduleManually = Boolean(preview && onFetchSlotDetails && !loading && !requestError);

  const modalTitle = mode === "reschedule" ? "Перенести совещание" : "Проверка календарей";
  const slotHighlightTitle = manualSlot
    ? "Выбранный слот"
    : mode === "reschedule"
      ? "Предлагаемый слот"
      : "Общий свободный слот";
  const displayedSlotLabel = manualSlot
    ? allModeDetails?.slot_label ?? manualSlot.label
    : slotLabel;
  const approveButtonLabel =
    approveButtonLabelProp ?? (approveWithMemo ? "Согласовать и утвердить" : "Утвердить");
  const approveLoadingLabel =
    approveLoadingLabelProp ?? (approveWithMemo ? "Согласуем и утверждаем…" : "Утверждаем…");
  const currentSlotLabel =
    previousSlotStart && previousSlotEnd
      ? formatMeetingTime(previousSlotStart, previousSlotEnd)
      : previousSlotLabel;

  return (
    <>
      <MeetingAgentManualSlotModal
        open={manualModalOpen}
        durationMinutes={slotDuration ?? 60}
        initialDate={manualSlotDefaults.initialDate}
        initialStartTime={manualSlotDefaults.initialStartTime}
        onClose={() => setManualModalOpen(false)}
        onApply={(slot) => {
          setManualSlot(slot);
          setManualModalOpen(false);
        }}
      />

      <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-slot-preview-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="meeting-slot-preview-title">{modalTitle}</h2>
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
            {mode === "reschedule" && (currentSlotLabel || searchAfter) ? (
              <div className={styles.modalRescheduleContext}>
                {currentSlotLabel ? (
                  <p>
                    <strong>Текущий слот:</strong> {currentSlotLabel}
                  </p>
                ) : null}
                {searchAfter ? <p className={styles.modalHint}>Ищем после: {searchAfter}</p> : null}
              </div>
            ) : null}

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
                {(isAllMode || manualSlot) && displayedSlotLabel ? (
                  <div className={styles.modalSlotHighlight}>
                    <strong>{slotHighlightTitle}</strong>
                    <p>{displayedSlotLabel}</p>
                    {slotDuration ? (
                      <span className={styles.modalSlotMeta}>Длительность: {slotDuration} мин</span>
                    ) : null}
                    {manualSlot ? (
                      manualSlotCheckComplete ? (
                        <span className={styles.modalSlotMeta}>
                          {manualSlotAvailable ? "Слот свободен" : "Слот занят"}
                        </span>
                      ) : allModeDetailsLoading ? (
                        <span className={styles.modalSlotMeta}>Проверяем доступность…</span>
                      ) : null
                    ) : preview.coverage ? (
                      <span className={styles.modalSlotMeta}>
                        Покрытие: {formatMeetingSlotCoverage(preview.coverage)}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {manualSlot ? (
                  <ManualSlotCheckSummary
                    loading={allModeDetailsLoading}
                    available={manualSlotCheckComplete ? manualSlotAvailable : null}
                    recommendations={manualSlotRecommendations}
                    detailsError={manualSlotDetailsError}
                    detailsErrorStage={manualSlotDetailsErrorStage}
                  />
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

                {showManualDetails ? (
                  <section className={styles.modalSection} aria-label="Проверенные календари">
                    <h3>Кого проверяли</h3>
                    {allModeDetailsLoading && !manualDetailsPeople.length ? (
                      <div className={styles.modalSlotChecking} role="status">
                        <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                        <span>Загружаем статусы участников…</span>
                      </div>
                    ) : allModeDetails?.error ? (
                      <div className={styles.modalError} role="alert">
                        <AlertTriangle size={16} aria-hidden="true" />
                        <span>{allModeDetails.error}</span>
                      </div>
                    ) : (
                      <ul className={styles.slotParticipantList}>
                        {manualDetailsPeople.map((participant) => (
                          <ParticipantDetails
                            key={`${participant.role}-${participant.fio}-${participant.email ?? "no-email"}`}
                            participant={participant}
                          />
                        ))}
                        {allModeDetailsLoading && !previewRoom ? (
                          <li className={styles.attendeeItem}>
                            <span className={styles.attendeeRole}>Переговорная</span>
                            <span className={styles.attendeeStatus}>
                              <Loader2 size={14} className={styles.spinner} aria-hidden="true" />
                              Проверяем календарь…
                            </span>
                          </li>
                        ) : previewRoom ? (
                          <RoomDetailsCard room={previewRoom} variant="slot" />
                        ) : null}
                      </ul>
                    )}
                  </section>
                ) : isAllMode && (previewPeople.length || allModeDetailsLoading || previewRoom) ? (
                  <section className={styles.modalSection} aria-label="Проверенные календари">
                    <h3>Кого проверяли</h3>
                    <ul className={styles.attendeeList}>
                      {previewPeople.map((attendee) => (
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
                      {allModeDetailsLoading && !previewRoom ? (
                        <li className={styles.attendeeItem}>
                          <span className={styles.attendeeRole}>Переговорная</span>
                          <span className={styles.attendeeStatus}>
                            <Loader2 size={14} className={styles.spinner} aria-hidden="true" />
                            Проверяем календарь…
                          </span>
                        </li>
                      ) : previewRoom ? (
                        <RoomDetailsCard room={previewRoom} />
                      ) : null}
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

        <div className={`${styles.modalActions} ${styles.modalActionsSplit}`}>
          <div className={styles.modalActionsStart}>
            {canScheduleManually ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setManualModalOpen(true)}
                disabled={isApproving}
              >
                Запланировать вручную
              </button>
            ) : null}
          </div>
          <div className={styles.modalActionsEnd}>
            {canShowAgentApprove || canShowRescheduleApprove ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!isApproveEnabled}
                title={approveDisabledTitle}
                onClick={() =>
                  onConfirmApprove?.(
                    manualSlot
                      ? { start: manualSlot.start, end: manualSlot.end }
                      : activeSlot
                        ? { start: activeSlot.start, end: activeSlot.end }
                        : undefined
                  )
                }
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
            ) : isPartial && !hasPreviewError && mode === "agent" ? (
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
    </div>
    </>
  );
}
