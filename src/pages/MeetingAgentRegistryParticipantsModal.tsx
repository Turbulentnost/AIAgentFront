import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Loader2, Search, Undo2, X } from "lucide-react";
import { meetingsApi } from "@/api/endpoints";
import { getMeetingRequestError } from "@/hooks/useMeetingDashboard";
import { useMeetingRegistryParticipants } from "@/hooks/useMeetingRegistry";
import type {
  MeetingRegistryConfirmationKind,
  MeetingRegistryCurrentSlotAvailability,
  MeetingRegistryEarlierSlotCandidate,
  MeetingRegistryEarlierSlotSuggestion,
  MeetingRegistryParticipantSearchResponse,
  MeetingSlotPreviewParticipant,
  MeetingSlotRescheduleRecommendation
} from "@/types";
import {
  filterMeetingSlotPreviewPeople,
  formatMeetingBlockingEventRange,
  formatMeetingConflictMovability,
  formatMeetingSlotParticipantStatus
} from "@/utils/meetingDashboard";
import { isRequestAborted } from "@/utils/requestAbort";
import styles from "./MeetingAgent.module.css";

function normalizeParticipantName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function participantListsEqual(left: string[], right: string[]): boolean {
  const leftKeys = new Set(left.map((name) => name.toLowerCase()));
  const rightKeys = new Set(right.map((name) => name.toLowerCase()));
  if (leftKeys.size !== rightKeys.size) return false;
  for (const key of leftKeys) {
    if (!rightKeys.has(key)) return false;
  }
  return true;
}

type ParticipantsApplyPayload = {
  participants: string[];
  added: string[];
  removed: string[];
};

export type ParticipantsPendingState = {
  participants: string[];
  added: string[];
  removed: string[];
  confirmationKind: NonNullable<MeetingRegistryConfirmationKind>;
  message: string | null;
  earlierSlotSuggestion: MeetingRegistryEarlierSlotSuggestion | null;
  commonSlotSuggestion: MeetingRegistryEarlierSlotSuggestion | null;
  currentSlotAvailability: MeetingRegistryCurrentSlotAvailability | null;
  rescheduleRecommendations: MeetingSlotRescheduleRecommendation[];
  requiresReschedule: boolean;
};

type Props = {
  open: boolean;
  refKey: string | null;
  meetingLabel: string;
  applying: boolean;
  applyError: string | null;
  confirmActionError: string | null;
  pendingState: ParticipantsPendingState | null;
  currentSlotLabel: string | null;
  currentSlotStart: string | null;
  currentSlotEnd: string | null;
  confirmingPendingSlotKey: string | null;
  isConfirmingPending: boolean;
  isCancellingPending: boolean;
  onClose: () => void;
  onApply: (payload: ParticipantsApplyPayload) => void;
  onConfirmAdd: () => void;
  onCancelConfirmation: () => void;
  onConfirmAddWithSlot: (candidate: MeetingRegistryEarlierSlotCandidate) => void;
  onConfirmRemoval: (candidate: MeetingRegistryEarlierSlotCandidate) => void;
  onConfirmRemovalOnCurrentSlot: () => void;
};

function isParticipantInDraft(draft: string[], fio: string): boolean {
  const key = fio.toLowerCase();
  return draft.some((name) => name.toLowerCase() === key);
}

function SlotParticipantAvailabilityItem({
  participant
}: {
  participant: MeetingSlotPreviewParticipant;
}) {
  return (
    <li className={styles.slotParticipantItem}>
      <div className={styles.slotParticipantHeader}>
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

function CurrentSlotAvailabilityDetails({
  availability,
  rescheduleRecommendations
}: {
  availability: MeetingRegistryCurrentSlotAvailability | null;
  rescheduleRecommendations: MeetingSlotRescheduleRecommendation[];
}) {
  const participants = filterMeetingSlotPreviewPeople(availability?.participants ?? []);
  const busyParticipants = participants.filter((participant) => participant.status === "busy");
  const hasStructuredDetails = Boolean(availability) || rescheduleRecommendations.length > 0;

  if (!hasStructuredDetails) return null;

  return (
    <div className={styles.registryEarlierSlotSection}>
      {availability ? (
        <>
          <p className={styles.registryEarlierSlotMeta}>
            Текущий слот: {availability.slot_label} · свободны {availability.free_count} из{" "}
            {availability.total_count}
          </p>
          {participants.length ? (
            <ul className={styles.slotParticipantList}>
              {participants.map((participant) => (
                <SlotParticipantAvailabilityItem
                  key={`${participant.fio}|${participant.email ?? ""}`}
                  participant={participant}
                />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {rescheduleRecommendations.length ? (
        <div className={styles.slotRescheduleRecommendations}>
          <p className={styles.registryEarlierSlotMeta}>Конфликты у добавляемых участников:</p>
          <ul className={styles.slotBlockingEvents}>
            {rescheduleRecommendations.map((recommendation, index) => (
              <li
                className={styles.slotBlockingEvent}
                key={`${recommendation.participant_fio}-${recommendation.event_label}-${index}`}
              >
                <span className={styles.slotBlockingEventLabel}>
                  {recommendation.participant_fio}: {recommendation.event_label}
                </span>
                <span className={styles.slotBlockingEventMeta}>
                  {recommendation.event_time_label ?? ""}
                  {recommendation.reschedule_hint_label?.trim()
                    ? ` · альтернатива: ${recommendation.reschedule_hint_label.trim()}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : busyParticipants.length === 0 && availability ? (
        <p className={styles.registryEarlierSlotMeta}>
          В текущем слоте занятости не обнаружено, но общий свободный слот для всего состава не
          найден в доступном периоде поиска.
        </p>
      ) : null}
    </div>
  );
}

function SlotCandidateList({
  suggestion,
  confirmLabel,
  confirmingSlotKey,
  isConfirming,
  onConfirm
}: {
  suggestion: MeetingRegistryEarlierSlotSuggestion;
  confirmLabel: string;
  confirmingSlotKey: string | null;
  isConfirming: boolean;
  onConfirm: (candidate: MeetingRegistryEarlierSlotCandidate) => void;
}) {
  return (
    <div className={styles.registryEarlierSlotSection}>
      <p className={styles.registryEarlierSlotMessage}>{suggestion.message}</p>
      <p className={styles.registryEarlierSlotMeta}>Текущий слот: {suggestion.current_slot_label}</p>
      {suggestion.search_from && suggestion.search_until ? (
        <p className={styles.registryEarlierSlotMeta}>
          Поиск: {suggestion.search_from} — {suggestion.search_until}
        </p>
      ) : null}

      <div className={styles.slotCandidateList}>
        {suggestion.candidates.map((candidate, index) => {
          const candidateKey = `${candidate.slot_start}|${candidate.slot_end}`;
          const isCandidateConfirming = isConfirming && confirmingSlotKey === candidateKey;

          return (
            <div key={candidateKey} className={styles.registryEarlierSlotCard}>
              <div className={styles.registryEarlierSlotCardTop}>
                <strong className={styles.registryEarlierSlotLabel}>{candidate.slot_label}</strong>
                {index === 0 ? <span className={styles.slotCandidateBadge}>Рекомендуем</span> : null}
              </div>

              {candidate.coverage_ratio != null ? (
                <p className={styles.registryEarlierSlotStats}>
                  Доступность: {Math.round(candidate.coverage_ratio * 100)}%
                </p>
              ) : null}

              {candidate.free_attendees_count != null ? (
                <p className={styles.registryEarlierSlotStats}>
                  Свободны: {candidate.free_attendees_count}
                </p>
              ) : null}

              <div className={styles.registryEarlierSlotActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isConfirming}
                  onClick={() => onConfirm(candidate)}
                >
                  {isCandidateConfirming ? (
                    <>
                      <Loader2 size={15} className={styles.spinner} aria-hidden="true" />
                      Подтверждаем…
                    </>
                  ) : (
                    <>
                      <CalendarClock size={15} aria-hidden="true" />
                      {confirmLabel}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MeetingAgentRegistryParticipantsModal({
  open,
  refKey,
  meetingLabel,
  applying,
  applyError,
  confirmActionError,
  pendingState,
  currentSlotLabel,
  currentSlotStart,
  currentSlotEnd,
  confirmingPendingSlotKey,
  isConfirmingPending,
  isCancellingPending,
  onClose,
  onApply,
  onConfirmAdd,
  onCancelConfirmation,
  onConfirmAddWithSlot,
  onConfirmRemoval,
  onConfirmRemovalOnCurrentSlot
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<MeetingRegistryParticipantSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([]);

  const showConfirmation = Boolean(pendingState);
  const showAddCurrentSlot = pendingState?.confirmationKind === "add_current_slot";
  const showAddRescheduleOnCurrentSlot = Boolean(
    pendingState?.confirmationKind === "add_reschedule" &&
      !pendingState.commonSlotSuggestion?.candidates?.length &&
      pendingState.requiresReschedule &&
      pendingState.rescheduleRecommendations.length > 0 &&
      pendingState.currentSlotAvailability
  );
  const showAddConfirmation = showAddCurrentSlot || showAddRescheduleOnCurrentSlot;
  const showAddWithReschedule = Boolean(
    showAddConfirmation &&
      (pendingState?.requiresReschedule || pendingState?.rescheduleRecommendations.length)
  );
  const showAddReschedule = Boolean(
    pendingState?.confirmationKind === "add_reschedule" && pendingState.commonSlotSuggestion?.candidates?.length
  );
  const showRemovalEarlier = Boolean(
    pendingState?.confirmationKind === "removal" && pendingState.earlierSlotSuggestion?.candidates?.length
  );
  const showRemovalCurrent =
    pendingState?.confirmationKind === "removal" &&
    !showRemovalEarlier &&
    pendingState.removed.length > 0 &&
    Boolean(currentSlotStart && currentSlotEnd);

  const participantsQuery = useMeetingRegistryParticipants(refKey, open && !showConfirmation);

  const loading = participantsQuery.isLoading || participantsQuery.isFetching;
  const error = participantsQuery.isError ? getMeetingRequestError(participantsQuery.error) : null;
  const initialParticipants = participantsQuery.data?.participants ?? [];

  useEffect(() => {
    if (!open || showConfirmation) return;
    setSearchQuery("");
    setSearchResult(null);
    setIsSearching(false);
    setDraft(initialParticipants.map(normalizeParticipantName).filter(Boolean));
    setUndoStack([]);
  }, [open, initialParticipants, showConfirmation]);

  useEffect(() => {
    if (!open || showConfirmation || !refKey) return;

    const query = searchQuery.trim();
    if (query.length < 3) {
      setSearchResult(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await meetingsApi.searchRegistryParticipants(refKey, query, {
          signal: controller.signal
        });
        if (!controller.signal.aborted) {
          setSearchResult(result);
        }
      } catch (error) {
        if (isRequestAborted(error, controller.signal)) return;
        setSearchResult(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchQuery, refKey, open, showConfirmation]);

  const lastRemovedParticipant = undoStack[undoStack.length - 1] ?? null;

  const normalizedInitial = useMemo(
    () =>
      [...new Set(initialParticipants.map(normalizeParticipantName).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ru")
      ),
    [initialParticipants]
  );

  const normalizedDraft = useMemo(
    () => [...new Set(draft.map(normalizeParticipantName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    [draft]
  );

  const hasChanges = useMemo(
    () => !participantListsEqual(normalizedDraft, normalizedInitial),
    [normalizedDraft, normalizedInitial]
  );

  const trimmedSearchQuery = searchQuery.trim();
  const showSuggestions = Boolean(
    searchResult &&
      (searchResult.suggestions.length > 1 || searchResult.message === "Выберите участника из списка")
  );
  const canAddSingle = Boolean(
    searchResult?.can_add &&
      !isSearching &&
      searchResult.fio &&
      !isParticipantInDraft(draft, searchResult.fio) &&
      !searchResult.already_added
  );

  if (!open) return null;

  function handleRemove(name: string) {
    setDraft((current) => current.filter((item) => item !== name));
    setUndoStack((stack) => [...stack, name]);
  }

  function handleUndoRemove() {
    setUndoStack((stack) => {
      const next = [...stack];
      const restored = next.pop();
      if (!restored) return stack;

      setDraft((current) => {
        const exists = current.some((item) => item.toLowerCase() === restored.toLowerCase());
        return exists ? current : [...current, restored];
      });

      return next;
    });
  }

  function handleAddParticipant(fio: string) {
    const normalized = normalizeParticipantName(fio);
    if (!normalized || isParticipantInDraft(draft, normalized)) return;
    setDraft((current) => [...current, normalized]);
    setUndoStack((stack) => stack.filter((item) => item.toLowerCase() !== normalized.toLowerCase()));
    setSearchQuery("");
    setSearchResult(null);
  }

  function handleAddFromSearch() {
    if (!searchResult?.can_add || !searchResult.fio) return;
    handleAddParticipant(searchResult.fio);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (canAddSingle) {
      handleAddFromSearch();
    }
  }

  function handleApply() {
    if (!hasChanges || applying || loading || !normalizedDraft.length) return;
    const added = normalizedDraft.filter(
      (name) => !normalizedInitial.some((item) => item.toLowerCase() === name.toLowerCase())
    );
    const removed = normalizedInitial.filter(
      (name) => !normalizedDraft.some((item) => item.toLowerCase() === name.toLowerCase())
    );
    onApply({ participants: normalizedDraft, added, removed });
  }

  const isBusy = loading || applying || isConfirmingPending || isCancellingPending;
  const actionError = confirmActionError ?? applyError;

  const modalTitle = showAddWithReschedule
    ? "Перенос встреч и добавление участника"
    : showAddConfirmation
    ? "Добавить участника в текущее время?"
    : showAddReschedule
      ? "Выбор слота для совещания"
      : showRemovalEarlier
        ? "Более ранние слоты"
        : showRemovalCurrent
          ? "Подтверждение удаления"
          : "Список участников";

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.modalCard} ${styles.participantsModalCard}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-registry-participants-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="meeting-registry-participants-title">{modalTitle}</h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            disabled={isBusy}
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className={styles.modalHint}>{meetingLabel}</p>

        {showAddConfirmation && pendingState ? (
          <>
            <p className={styles.registrySuccessNote} role="status">
              {pendingState.message ??
                (showAddWithReschedule
                  ? "Новый участник занят в текущем слоте. Подтвердите перенос его конфликтующих встреч и добавление в совещание."
                  : "Новый участник свободен в текущее время совещания. Подтвердите добавление.")}
            </p>
            {pendingState.added.length ? (
              <p className={styles.registryEarlierSlotMeta}>
                Будут добавлены: {pendingState.added.join(", ")}
              </p>
            ) : null}

            {showAddWithReschedule ? (
              <CurrentSlotAvailabilityDetails
                availability={pendingState.currentSlotAvailability}
                rescheduleRecommendations={pendingState.rescheduleRecommendations}
              />
            ) : null}

            {actionError ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isBusy}
                onClick={onCancelConfirmation}
              >
                {isCancellingPending ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                    Отменяем…
                  </>
                ) : (
                  "Нет"
                )}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={isBusy}
                onClick={onConfirmAdd}
              >
                {isConfirmingPending ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                    Подтверждаем…
                  </>
                ) : showAddWithReschedule ? (
                  "Подтвердить перенос и добавить"
                ) : (
                  "Да"
                )}
              </button>
            </div>
          </>
        ) : showAddReschedule && pendingState?.commonSlotSuggestion ? (
          <>
            {pendingState.message ? (
              <p className={styles.registrySuccessNote} role="status">
                {pendingState.message}
              </p>
            ) : null}
            {pendingState.added.length ? (
              <p className={styles.registryEarlierSlotMeta}>
                Будут добавлены: {pendingState.added.join(", ")}
              </p>
            ) : null}

            <SlotCandidateList
              suggestion={pendingState.commonSlotSuggestion}
              confirmLabel="Подтвердить слот"
              confirmingSlotKey={confirmingPendingSlotKey}
              isConfirming={isConfirmingPending}
              onConfirm={onConfirmAddWithSlot}
            />

            {actionError ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isBusy}
                onClick={onCancelConfirmation}
              >
                {isCancellingPending ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                    Отменяем…
                  </>
                ) : (
                  "Отмена"
                )}
              </button>
            </div>
          </>
        ) : pendingState?.confirmationKind === "add_reschedule" ? (
          <>
            <p className={`${styles.registrySuccessNote} ${styles.registryFailureNote}`} role="status">
              {pendingState.message ?? "Не удалось подобрать общий свободный слот для всех участников."}
            </p>
            {pendingState.added.length ? (
              <p className={styles.registryEarlierSlotMeta}>
                Будут добавлены: {pendingState.added.join(", ")}
              </p>
            ) : null}

            <CurrentSlotAvailabilityDetails
              availability={pendingState.currentSlotAvailability}
              rescheduleRecommendations={pendingState.rescheduleRecommendations}
            />

            {actionError ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isBusy}
                onClick={onCancelConfirmation}
              >
                {isCancellingPending ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                    Отменяем…
                  </>
                ) : (
                  "Отмена"
                )}
              </button>
            </div>
          </>
        ) : showRemovalEarlier && pendingState?.earlierSlotSuggestion ? (
          <>
            <SlotCandidateList
              suggestion={pendingState.earlierSlotSuggestion}
              confirmLabel="Подтвердить слот"
              confirmingSlotKey={confirmingPendingSlotKey}
              isConfirming={isConfirmingPending}
              onConfirm={onConfirmRemoval}
            />

            {actionError ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button type="button" className={styles.primaryButton} disabled={isBusy} onClick={onClose}>
                Закрыть
              </button>
            </div>
          </>
        ) : showRemovalCurrent && pendingState ? (
          <>
            <p className={styles.registrySuccessNote} role="status">
              {pendingState.message ??
                "Подтвердите удаление участников. Совещание останется в текущем времени."}
            </p>

            <div className={styles.registryEarlierSlotSection}>
              <p className={styles.registryEarlierSlotMeta}>Текущий слот: {currentSlotLabel ?? "—"}</p>
              {pendingState.removed.length ? (
                <p className={styles.registryEarlierSlotMeta}>
                  Будут удалены: {pendingState.removed.join(", ")}
                </p>
              ) : null}

              <div className={styles.registryEarlierSlotActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isConfirmingPending}
                  onClick={onConfirmRemovalOnCurrentSlot}
                >
                  {isConfirmingPending ? (
                    <>
                      <Loader2 size={15} className={styles.spinner} aria-hidden="true" />
                      Подтверждаем…
                    </>
                  ) : (
                    <>
                      <CalendarClock size={15} aria-hidden="true" />
                      Подтвердить на текущем слоте
                    </>
                  )}
                </button>
              </div>
            </div>

            {actionError ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button type="button" className={styles.primaryButton} disabled={isBusy} onClick={onClose}>
                Закрыть
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.participantsSearchField}>
              <Search className={styles.participantsSearchIcon} size={16} aria-hidden="true" />
              <input
                type="search"
                className={styles.participantsSearchInput}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Поиск участника"
                disabled={isBusy}
                autoComplete="off"
                aria-label="Поиск участника"
              />
            </div>

            {trimmedSearchQuery.length >= 3 ? (
              <div>
                {isSearching ? (
                  <p className={styles.participantsSearchStatus} role="status">
                    Ищем…
                  </p>
                ) : showSuggestions ? (
                  <ul className={styles.participantsSuggestions} role="listbox" aria-label="Найденные участники">
                    {searchResult?.suggestions.map((suggestion) => {
                      const disabled =
                        suggestion.already_added || isParticipantInDraft(draft, suggestion.fio);
                      return (
                        <li key={`${suggestion.fio}|${suggestion.email}`}>
                          <button
                            type="button"
                            className={styles.participantsSuggestionItem}
                            disabled={disabled || isBusy}
                            onClick={() => handleAddParticipant(suggestion.fio)}
                          >
                            <span>{suggestion.fio}</span>
                            <span className={styles.participantsSearchResultEmail}>{suggestion.email}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : canAddSingle && searchResult ? (
                  <div className={styles.participantsSearchResultRow}>
                    <div className={styles.participantsSearchResultInfo}>
                      <span className={styles.participantsSearchResultName}>{searchResult.fio}</span>
                      {searchResult.email ? (
                        <span className={styles.participantsSearchResultEmail}>{searchResult.email}</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={isBusy}
                      onClick={handleAddFromSearch}
                    >
                      Добавить
                    </button>
                  </div>
                ) : searchResult?.already_added ||
                  (searchResult?.fio && isParticipantInDraft(draft, searchResult.fio)) ? (
                  <p className={styles.participantsSearchResultHint} role="status">
                    Уже в списке
                  </p>
                ) : searchResult?.message === "Не найден в Outlook" || (searchResult && !searchResult.found) ? (
                  <p className={styles.participantsSearchResultHint} role="status">
                    Не найден в Outlook
                  </p>
                ) : searchResult?.message ? (
                  <p className={styles.participantsSearchResultHint} role="status">
                    {searchResult.message}
                  </p>
                ) : null}
              </div>
            ) : null}

            {lastRemovedParticipant && !loading && !error ? (
              <div className={styles.participantsUndoRow}>
                <button
                  type="button"
                  className={styles.participantsUndoButton}
                  onClick={handleUndoRemove}
                  disabled={isBusy}
                  aria-label={`Вернуть ${lastRemovedParticipant}`}
                >
                  <Undo2 size={15} aria-hidden="true" />
                  <span>Вернуть {lastRemovedParticipant}</span>
                </button>
              </div>
            ) : null}

            {loading ? (
              <div className={styles.modalLoader}>
                <Loader2 size={18} className={styles.spinner} aria-hidden="true" />
                <span>Загружаем участников…</span>
              </div>
            ) : error ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : (
              <div className={styles.participantsChipPanel}>
                {draft.length ? (
                  <ul className={styles.participantsChipList}>
                    {draft.map((name) => (
                      <li key={name}>
                        <span className={styles.participantChip}>
                          <span className={styles.participantChipLabel}>{name}</span>
                          <button
                            type="button"
                            className={styles.participantChipRemove}
                            onClick={() => handleRemove(name)}
                            disabled={isBusy}
                            aria-label={`Удалить ${name}`}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.participantsEmpty}>Участники не указаны</p>
                )}
              </div>
            )}

            {actionError ? (
              <div className={styles.modalError} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={isBusy || !hasChanges || !normalizedDraft.length}
                onClick={handleApply}
              >
                {applying ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                    Сохраняем…
                  </>
                ) : (
                  "Применить"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
