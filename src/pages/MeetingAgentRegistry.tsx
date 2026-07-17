import { useCallback, useEffect, useMemo, useState } from "react";

import {

  AlertTriangle,

  Ban,

  CalendarClock,

  CalendarDays,

  CheckCircle2,

  Circle,

  FileText,

  Loader2,

  Mail,

  RefreshCw,

  Users

} from "lucide-react";

import LoadingPanel from "@/components/LoadingPanel";

import {

  useMeetingRegistry,

  useMeetingRegistryCancel,

  useMeetingRegistryParticipantsApply,

  useMeetingRegistryParticipantsConfirmAdd,

  useMeetingRegistryParticipantsConfirmRemoval,

  useMeetingRegistryParticipantsCancelRemoval,

  useMeetingRegistryParticipants,

  useMeetingRegistryRescheduleApprove,

  useMeetingRegistryRescheduleSlotPreview,

  useRefreshMeetingRegistry

} from "@/hooks/useMeetingRegistry";

import {
  useMeetingAgentSlotPreviewDetails
} from "@/hooks/useMeetingMemoDetail";

import { getMeetingMemoActionError, getMeetingRequestError } from "@/hooks/useMeetingDashboard";

import type {
  MeetingRegistryConfirmationKind,
  MeetingRegistryCurrentSlotAvailability,
  MeetingRegistryEarlierSlotCandidate,
  MeetingRegistryEarlierSlotSuggestion,
  MeetingRegistryStageFilter,
  MeetingSlotRescheduleRecommendation
} from "@/types/meetings";

import {

  defaultRegistryStageCounts,

  getMeetingRegistryStageIndex,

  getMeetingRegistryStageLabel,

  isMeetingRegistryReschedulable,

  mapMeetingRegistryItem,

  meetingRegistryCancelledStage,

  meetingRegistryStages,

  type MeetingRegistryViewItem

} from "@/utils/meetingRegistry";

import {
  formatMeetingDateTime,
  formatMeetingTime,
  formatShortPersonName,
  isMeetingSlotPreviewAssignable,
  meetingPlaceFromInviteLocation,
  resolveMeetingSlotPreview
} from "@/utils/meetingDashboard";

import MeetingAgentRegistryParticipantsModal from "@/pages/MeetingAgentRegistryParticipantsModal";

import MeetingAgentRegistryCancelModal from "@/pages/MeetingAgentRegistryCancelModal";

import MeetingAgentSlotPreviewModal from "@/pages/MeetingAgentSlotPreviewModal";

import styles from "./MeetingAgent.module.css";



const registryFilters: { id: MeetingRegistryStageFilter; label: string }[] = [

  { id: "all", label: "Все" },

  ...meetingRegistryStages.map((stage) => ({ id: stage.id, label: stage.shortLabel })),

  { id: "cancelled", label: meetingRegistryCancelledStage.shortLabel }

];



type ParticipantsPendingState = {
  participants: string[];
  added: string[];
  removed: string[];
  confirmationKind: NonNullable<MeetingRegistryConfirmationKind>;
  message: string | null;
  earlierSlotSuggestion: MeetingRegistryEarlierSlotSuggestion | null;
  commonSlotSuggestion: MeetingRegistryEarlierSlotSuggestion | null;
};

type Props = {

  canAccessAgent: boolean;

};



export default function MeetingAgentRegistry({ canAccessAgent }: Props) {

  const [stageFilter, setStageFilter] = useState<MeetingRegistryStageFilter>("all");

  const [selectedId, setSelectedId] = useState("");

  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);

  const [cancelSuccessMessage, setCancelSuccessMessage] = useState<string | null>(null);

  const [rescheduleSuccessMessage, setRescheduleSuccessMessage] = useState<string | null>(null);

  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);

  const [participantsSuccessMessage, setParticipantsSuccessMessage] = useState<string | null>(null);

  const [participantsPendingState, setParticipantsPendingState] = useState<ParticipantsPendingState | null>(null);

  const [confirmingPendingSlotKey, setConfirmingPendingSlotKey] = useState<string | null>(null);

  const registryQuery = useMeetingRegistry(canAccessAgent, stageFilter);

  const refreshRegistry = useRefreshMeetingRegistry();

  const cancelMeetingMutation = useMeetingRegistryCancel();

  const reschedulePreviewMutation = useMeetingRegistryRescheduleSlotPreview();

  const rescheduleApproveMutation = useMeetingRegistryRescheduleApprove();

  const participantsApplyMutation = useMeetingRegistryParticipantsApply();

  const participantsConfirmAddMutation = useMeetingRegistryParticipantsConfirmAdd();

  const participantsConfirmRemovalMutation = useMeetingRegistryParticipantsConfirmRemoval();

  const participantsCancelRemovalMutation = useMeetingRegistryParticipantsCancelRemoval();

  const slotPreviewDetailsMutation = useMeetingAgentSlotPreviewDetails();



  const items = useMemo(

    () => (registryQuery.data?.items ?? []).map(mapMeetingRegistryItem),

    [registryQuery.data?.items]

  );

  const stageCounts = registryQuery.data?.stage_counts ?? defaultRegistryStageCounts();

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const participantsRestoreQuery = useMeetingRegistryParticipants(
    selectedItem?.refKey ?? null,
    participantsModalOpen
  );

  const requestError = registryQuery.isError ? getMeetingRequestError(registryQuery.error) : null;

  const cancelRequestError = cancelMeetingMutation.isError

    ? getMeetingMemoActionError(cancelMeetingMutation.error)

    : null;

  const rescheduleRequestError = reschedulePreviewMutation.isError

    ? getMeetingMemoActionError(reschedulePreviewMutation.error)

    : null;

  const reschedulePreview = reschedulePreviewMutation.data ?? null;

  const rescheduleApproveError = rescheduleApproveMutation.isError

    ? getMeetingMemoActionError(rescheduleApproveMutation.error)

    : null;

  const participantsApplyError = participantsApplyMutation.isError

    ? getMeetingMemoActionError(participantsApplyMutation.error)

    : null;

  const participantsConfirmRemovalError = participantsConfirmRemovalMutation.isError

    ? getMeetingMemoActionError(participantsConfirmRemovalMutation.error)

    : null;

  const participantsConfirmAddError = participantsConfirmAddMutation.isError

    ? getMeetingMemoActionError(participantsConfirmAddMutation.error)

    : null;



  function buildParticipantsPendingState(
    result: {
      participants: string[];
      added: string[];
      removed: string[];
      confirmation_kind?: MeetingRegistryConfirmationKind;
      message: string | null;
      earlier_slot_suggestion?: MeetingRegistryEarlierSlotSuggestion | null;
      common_slot_suggestion?: MeetingRegistryEarlierSlotSuggestion | null;
      current_slot_availability?: MeetingRegistryCurrentSlotAvailability | null;
      reschedule_recommendations?: MeetingSlotRescheduleRecommendation[];
      requires_reschedule?: boolean;
    }
  ): ParticipantsPendingState | null {
    if (!result.confirmation_kind) return null;

    return {
      participants: result.participants,
      added: result.added,
      removed: result.removed,
      confirmationKind: result.confirmation_kind,
      message: result.message,
      earlierSlotSuggestion: result.earlier_slot_suggestion ?? null,
      commonSlotSuggestion: result.common_slot_suggestion ?? null,
      currentSlotAvailability: result.current_slot_availability ?? null,
      rescheduleRecommendations: result.reschedule_recommendations ?? [],
      requiresReschedule: Boolean(result.requires_reschedule)
    };
  }



  useEffect(() => {
    if (!participantsModalOpen || participantsPendingState) return;

    const data = participantsRestoreQuery.data;
    if (!data?.pending_confirmation || !data.confirmation_kind) return;

    const pendingParticipants = data.pending_participants ?? [];
    const pendingAdded = data.pending_added ?? [];
    const pendingRemoved = data.pending_removed ?? [];
    const refKey = selectedItem?.refKey;
    if (!refKey) return;

    if (data.confirmation_kind === "add_current_slot") {
      setParticipantsPendingState({
        participants: pendingParticipants,
        added: pendingAdded,
        removed: pendingRemoved,
        confirmationKind: "add_current_slot",
        message: null,
        earlierSlotSuggestion: null,
        commonSlotSuggestion: null,
        currentSlotAvailability: null,
        rescheduleRecommendations: [],
        requiresReschedule: false
      });
      return;
    }

    void participantsApplyMutation
      .mutateAsync({
        refKey,
        payload: {
          participants: pendingParticipants,
          added: pendingAdded,
          removed: pendingRemoved
        }
      })
      .then((result) => {
        if (!result.pending_confirmation) return;
        const pending = buildParticipantsPendingState(result);
        if (pending) {
          setParticipantsPendingState(pending);
        }
      })
      .catch(() => {
        // error shown in modal via participantsApplyError
      });
  }, [
    participantsModalOpen,
    participantsPendingState,
    participantsRestoreQuery.data,
    selectedItem?.refKey
  ]);



  useEffect(() => {

    if (!items.length) {

      setSelectedId("");

      return;

    }

    if (!items.some((item) => item.id === selectedId)) {

      setSelectedId(items[0].id);

    }

  }, [items, selectedId]);



  useEffect(() => {

    setCancelSuccessMessage(null);

    setRescheduleSuccessMessage(null);

    setParticipantsSuccessMessage(null);

    setParticipantsPendingState(null);

  }, [selectedId]);



  const handleFetchRescheduleSlotDetails = useCallback(

    async (slotStart: string, slotEnd: string) => {

      if (!selectedItem?.refKey) {

        throw new Error("У совещения нет ref_key для загрузки деталей слота.");

      }

      const durationMinutes = reschedulePreview?.slot_preview.duration_minutes ?? undefined;

      return slotPreviewDetailsMutation.mutateAsync({

        memoRefKey: selectedItem.refKey,

        payload: {

          slot_start: slotStart,

          slot_end: slotEnd,

          ...(durationMinutes ? { duration_minutes: durationMinutes } : {})

        }

      });

    },

    [selectedItem?.refKey, reschedulePreview?.slot_preview.duration_minutes, slotPreviewDetailsMutation]

  );



  function handleOpenRescheduleModal() {

    if (!selectedItem || reschedulePreviewMutation.isPending) return;

    if (!isMeetingRegistryReschedulable(selectedItem.stage)) return;

    reschedulePreviewMutation.reset();

    setRescheduleModalOpen(true);

    void reschedulePreviewMutation.mutateAsync({ refKey: selectedItem.refKey });

  }



  function handleCloseRescheduleModal() {

    if (reschedulePreviewMutation.isPending || rescheduleApproveMutation.isPending) return;

    setRescheduleModalOpen(false);

    reschedulePreviewMutation.reset();

    rescheduleApproveMutation.reset();

  }



  async function handleConfirmReschedule(slotOverride?: { start: string; end: string }) {

    const preview = reschedulePreview?.slot_preview;

    if (!selectedItem || !preview || (!isMeetingSlotPreviewAssignable(preview) && !slotOverride)) return;

    const slot = slotOverride ?? resolveMeetingSlotPreview(preview);

    if (!slot || rescheduleApproveMutation.isPending || reschedulePreviewMutation.isPending) return;



    rescheduleApproveMutation.reset();

    try {

      const result = await rescheduleApproveMutation.mutateAsync({

        refKey: selectedItem.refKey,

        payload: {

          slot_start: slot.start,

          slot_end: slot.end,

          subject: preview.memo_ref_key ? selectedItem.title : undefined,

          location: selectedItem.location ?? undefined,

          attendees: preview.attendees

        }

      });

      setRescheduleModalOpen(false);

      reschedulePreviewMutation.reset();

      rescheduleApproveMutation.reset();

      const actionNote = result.outlook_updated

        ? "Встреча обновлена в Outlook."

        : result.new_invite_sent

          ? "Отправлено новое приглашение."

          : "Совещание перенесено.";

      setRescheduleSuccessMessage(

        `${actionNote} Новый слот: ${result.slot_label ?? formatMeetingTime(result.start, result.end)}.`

      );

      setParticipantsPendingState(null);

      setParticipantsModalOpen(false);

    } catch {

      // error shown in modal

    }

  }



  function handleOpenCancelModal() {

    if (!selectedItem || cancelMeetingMutation.isPending || selectedItem.stage === "cancelled") return;

    cancelMeetingMutation.reset();

    setCancelSuccessMessage(null);

    setCancelModalOpen(true);

  }



  function handleCloseCancelModal() {

    if (cancelMeetingMutation.isPending) return;

    setCancelModalOpen(false);

    cancelMeetingMutation.reset();

  }



  async function handleConfirmCancel(message: string) {

    if (!selectedItem || cancelMeetingMutation.isPending) return;



    cancelMeetingMutation.reset();

    try {

      const result = await cancelMeetingMutation.mutateAsync({

        refKey: selectedItem.refKey,

        message

      });

      setCancelModalOpen(false);

      cancelMeetingMutation.reset();

      const outlookNote = result.outlook_cancelled

        ? "Приглашение отменено в Outlook."

        : "Запись в реестре отмечена как отменённая.";

      setCancelSuccessMessage(outlookNote);

    } catch {

      // error shown in modal via cancelRequestError

    }

  }



  function handleOpenParticipantsModal() {

    if (!selectedItem?.refKey) return;

    setParticipantsSuccessMessage(null);

    setParticipantsPendingState(null);

    participantsApplyMutation.reset();

    participantsConfirmAddMutation.reset();

    participantsConfirmRemovalMutation.reset();

    setParticipantsModalOpen(true);

  }



  function resetParticipantsModalState() {
    setParticipantsModalOpen(false);
    setParticipantsPendingState(null);
    participantsApplyMutation.reset();
    participantsConfirmAddMutation.reset();
    participantsConfirmRemovalMutation.reset();
    participantsCancelRemovalMutation.reset();
  }

  function handleCloseParticipantsModal() {
    const refKey = selectedItem?.refKey;
    const hasPendingConfirmation =
      Boolean(participantsPendingState) ||
      Boolean(participantsRestoreQuery.data?.pending_confirmation);

    if (refKey && hasPendingConfirmation) {
      void participantsCancelRemovalMutation
        .mutateAsync({ refKey })
        .finally(() => {
          resetParticipantsModalState();
        });
      return;
    }

    resetParticipantsModalState();
  }



  function handleApplyParticipants(payload: {
    participants: string[];
    added: string[];
    removed: string[];
  }) {
    if (!selectedItem?.refKey) return;

    void participantsApplyMutation
      .mutateAsync({
        refKey: selectedItem.refKey,
        payload: {
          participants: payload.participants,
          added: payload.added,
          removed: payload.removed
        }
      })
      .then((result) => {
        if (result.pending_confirmation) {
          const pending = buildParticipantsPendingState(result);
          if (pending) {
            setParticipantsPendingState(pending);
          }
          return;
        }

        const details: string[] = [];
        if (result.added.length) details.push(`добавлено: ${result.added.length}`);
        if (result.removed.length) details.push(`удалено: ${result.removed.length}`);
        const suffix = details.length ? ` (${details.join(", ")})` : "";

        setParticipantsModalOpen(false);
        setParticipantsSuccessMessage(`Список участников обновлён${suffix}.`);
        setParticipantsPendingState(null);
      })
      .catch(() => {
        // error shown in modal via participantsApplyError
      });
  }

  function handleCancelParticipantsConfirmation() {
    if (!selectedItem?.refKey) return;

    void participantsCancelRemovalMutation
      .mutateAsync({ refKey: selectedItem.refKey })
      .then(() => {
        setParticipantsPendingState(null);
      })
      .catch(() => {
        // error shown in modal
      });
  }

  function handleConfirmParticipantsAdd() {
    if (!selectedItem?.refKey || !participantsPendingState) return;

    void participantsConfirmAddMutation
      .mutateAsync({
        refKey: selectedItem.refKey,
        payload: {
          participants: participantsPendingState.participants,
          added: participantsPendingState.added
        }
      })
      .then((result) => {
        setParticipantsModalOpen(false);
        setParticipantsPendingState(null);

        const slotNote = result.slot_label ? ` Слот: ${result.slot_label}.` : "";
        const addedNote = result.added.length > 0 ? ` Добавлено: ${result.added.length}.` : "";
        setParticipantsSuccessMessage(
          `${result.message ?? "Состав участников совещания изменён"}.${slotNote}${addedNote}`
        );
      })
      .catch(() => {
        // error shown in modal via participantsConfirmAddError
      });
  }

  function handleConfirmParticipantsAddWithSlot(candidate: MeetingRegistryEarlierSlotCandidate) {
    if (!selectedItem?.refKey || !participantsPendingState) return;

    const candidateKey = `${candidate.slot_start}|${candidate.slot_end}`;
    setConfirmingPendingSlotKey(candidateKey);

    void participantsConfirmAddMutation
      .mutateAsync({
        refKey: selectedItem.refKey,
        payload: {
          participants: participantsPendingState.participants,
          added: participantsPendingState.added,
          slot_start: candidate.slot_start,
          slot_end: candidate.slot_end
        }
      })
      .then((result) => {
        setParticipantsModalOpen(false);
        setParticipantsPendingState(null);

        const slotNote = result.slot_label ? ` Совещание перенесено на ${result.slot_label}.` : "";
        const addedNote = result.added.length > 0 ? ` Добавлено: ${result.added.length}.` : "";
        setParticipantsSuccessMessage(`${result.message ?? "Состав участников изменён"}.${slotNote}${addedNote}`);
      })
      .catch(() => {
        // error shown in modal via participantsConfirmAddError
      })
      .finally(() => {
        setConfirmingPendingSlotKey(null);
      });
  }

  function handleConfirmParticipantsRemovalOnCurrentSlot() {
    if (!selectedItem?.refKey || !selectedItem.slotStart || !selectedItem.slotEnd) return;
    if (!participantsPendingState) return;

    handleConfirmParticipantsRemoval({
      slot_start: selectedItem.slotStart,
      slot_end: selectedItem.slotEnd,
      slot_label: selectedItem.meetingAtLabel,
      coverage_ratio: 1,
      free_attendees_count: null
    });
  }

  function handleConfirmParticipantsRemoval(candidate: MeetingRegistryEarlierSlotCandidate) {
    if (!selectedItem?.refKey || !participantsPendingState) return;

    const candidateKey = `${candidate.slot_start}|${candidate.slot_end}`;
    setConfirmingPendingSlotKey(candidateKey);

    void participantsConfirmRemovalMutation
      .mutateAsync({
        refKey: selectedItem.refKey,
        payload: {
          participants: participantsPendingState.participants,
          removed: participantsPendingState.removed,
          slot_start: candidate.slot_start,
          slot_end: candidate.slot_end
        }
      })
      .then((result) => {
        setParticipantsModalOpen(false);
        setParticipantsPendingState(null);

        const removedNote =
          result.removed.length > 0 ? ` Удалено: ${result.removed.length}.` : "";
        setParticipantsSuccessMessage(
          `Совещание перенесено на ${result.slot_label}.${removedNote}`
        );
      })
      .catch(() => {
        // error shown in modal via participantsConfirmRemovalError
      })
      .finally(() => {
        setConfirmingPendingSlotKey(null);
      });
  }



  if (!canAccessAgent) {

    return <div className={styles.queueEmpty}>Нет доступа к реестру совещаний</div>;

  }



  if (registryQuery.isLoading) {

    return (

      <div className={styles.modalLoader}>

        <LoadingPanel title="Загружаем реестр совещаний…" />

      </div>

    );

  }



  const cancelMeetingLabel = selectedItem

    ? `СЗ №${selectedItem.memoNumber} · ${selectedItem.title}`

    : "";



  const participantsMeetingLabel = cancelMeetingLabel;



  return (

    <>

      <MeetingAgentRegistryCancelModal

        open={cancelModalOpen}

        meetingLabel={cancelMeetingLabel}

        loading={cancelMeetingMutation.isPending}

        error={cancelRequestError}

        onClose={handleCloseCancelModal}

        onConfirm={(message) => void handleConfirmCancel(message)}

      />



      <MeetingAgentRegistryParticipantsModal

        open={participantsModalOpen}

        refKey={selectedItem?.refKey ?? null}

        meetingLabel={participantsMeetingLabel}

        applying={participantsApplyMutation.isPending}

        applyError={participantsApplyError}

        confirmActionError={participantsConfirmRemovalError ?? participantsConfirmAddError}

        pendingState={participantsPendingState}

        currentSlotLabel={selectedItem?.meetingAtLabel ?? null}

        currentSlotStart={selectedItem?.slotStart ?? null}

        currentSlotEnd={selectedItem?.slotEnd ?? null}

        confirmingPendingSlotKey={confirmingPendingSlotKey}

        isConfirmingPending={
          participantsConfirmRemovalMutation.isPending ||
          participantsConfirmAddMutation.isPending ||
          participantsCancelRemovalMutation.isPending
        }

        isCancellingPending={participantsCancelRemovalMutation.isPending}

        onClose={handleCloseParticipantsModal}

        onApply={handleApplyParticipants}

        onConfirmAdd={handleConfirmParticipantsAdd}

        onCancelConfirmation={handleCancelParticipantsConfirmation}

        onConfirmAddWithSlot={handleConfirmParticipantsAddWithSlot}

        onConfirmRemoval={handleConfirmParticipantsRemoval}

        onConfirmRemovalOnCurrentSlot={handleConfirmParticipantsRemovalOnCurrentSlot}

      />



      <MeetingAgentSlotPreviewModal

        open={rescheduleModalOpen}

        loading={reschedulePreviewMutation.isPending}

        preview={reschedulePreview?.slot_preview ?? null}

        requestError={rescheduleRequestError}

        approveError={rescheduleApproveError}

        onClose={handleCloseRescheduleModal}

        onConfirmApprove={(slotOverride) => void handleConfirmReschedule(slotOverride)}

        isApproving={rescheduleApproveMutation.isPending}

        approveButtonLabel="Подтвердить перенос"

        approveLoadingLabel="Переносим…"

        mode="reschedule"

        previousSlotLabel={reschedulePreview?.previous_slot_label ?? null}

        previousSlotStart={
          reschedulePreview?.previous_slot_start ?? selectedItem?.slotStart ?? null
        }

        previousSlotEnd={reschedulePreview?.previous_slot_end ?? selectedItem?.slotEnd ?? null}

        searchAfter={reschedulePreview?.search_after ?? null}

        onFetchSlotDetails={handleFetchRescheduleSlotDetails}

      />



      {requestError ? (

        <div className={styles.registryStubBanner} role="alert">

          <AlertTriangle size={16} aria-hidden="true" />

          <span>{requestError}</span>

        </div>

      ) : null}



      <div className={styles.registryStatsRow} aria-label="Сводка по этапам реестра">

        {meetingRegistryStages.map((stage) => (

          <article className={styles.registryStatCard} key={stage.id}>

            <strong>{stageCounts[stage.id] ?? 0}</strong>

            <span>{stage.shortLabel}</span>

          </article>

        ))}

        <article className={`${styles.registryStatCard} ${styles.registryStatCardCancelled}`}>

          <strong>{stageCounts.cancelled ?? 0}</strong>

          <span>{meetingRegistryCancelledStage.shortLabel}</span>

        </article>

      </div>



      <div className={`${styles.workspace} ${styles.registryWorkspace}`}>

        <aside className={`${styles.queuePanel} ${styles.registryListPanel}`} aria-labelledby="meeting-registry-list-title">

          <div className={styles.panelHead}>

            <h2 id="meeting-registry-list-title">Реестр совещаний</h2>

            <button

              type="button"

              className={`${styles.refreshButton} ${registryQuery.isFetching ? styles.refreshButtonSpinning : ""}`}

              onClick={() => void refreshRegistry()}

              disabled={registryQuery.isFetching}

              aria-label="Обновить реестр"

            >

              <RefreshCw size={15} aria-hidden="true" />

            </button>

          </div>



          <div className={styles.registryFilters} role="tablist" aria-label="Фильтр по этапу">

            {registryFilters.map((filter) => (

              <button

                key={filter.id}

                type="button"

                role="tab"

                aria-selected={stageFilter === filter.id}

                className={`${styles.registryFilterTab} ${

                  stageFilter === filter.id ? styles.registryFilterTabActive : ""

                }`}

                onClick={() => setStageFilter(filter.id)}

              >

                {filter.label} — {stageCounts[filter.id] ?? 0}

              </button>

            ))}

          </div>



          <div className={styles.queueList}>

            {registryQuery.isFetching && !items.length ? (

              <div className={styles.modalLoader}>

                <Loader2 size={18} className={styles.spinner} aria-hidden="true" />

                <span>Обновляем реестр…</span>

              </div>

            ) : items.length ? (

              items.map((item) => (

                <RegistryCard

                  key={item.id}

                  item={item}

                  active={selectedId === item.id}

                  onSelect={() => setSelectedId(item.id)}

                />

              ))

            ) : (

              <div className={styles.queueEmpty}>

                Совещений с отправленными приглашениями на выбранном этапе нет

              </div>

            )}

          </div>

        </aside>



        <section className={`${styles.detailsPanel} ${styles.registryDetailsPanel}`} aria-labelledby="meeting-registry-details-title">

          {!selectedItem ? (

            <div className={styles.detailsEmpty}>Выберите совещание из реестра</div>

          ) : (

            <RegistryDetails

              item={selectedItem}

              cancelSuccessMessage={cancelSuccessMessage}

              isCancelling={cancelMeetingMutation.isPending}

              isRescheduling={reschedulePreviewMutation.isPending || rescheduleApproveMutation.isPending}

              rescheduleSuccessMessage={rescheduleSuccessMessage}

              onCancel={handleOpenCancelModal}

              onReschedule={handleOpenRescheduleModal}

              onParticipants={handleOpenParticipantsModal}

              participantsSuccessMessage={participantsSuccessMessage}

            />

          )}

        </section>

      </div>

    </>

  );

}



function RegistryCard({

  item,

  active,

  onSelect

}: {

  item: MeetingRegistryViewItem;

  active: boolean;

  onSelect: () => void;

}) {

  const isCancelled = item.stage === "cancelled";

  const stageShortLabel = isCancelled

    ? meetingRegistryCancelledStage.shortLabel

    : meetingRegistryStages.find((stage) => stage.id === item.stage)?.shortLabel ??

      getMeetingRegistryStageLabel(item.stage);

  const stageIndex = getMeetingRegistryStageIndex(item.stage);



  return (

    <button

      type="button"

      className={`${styles.queueCard} ${active ? styles.queueCardActive : ""}`}

      onClick={onSelect}

    >

      <div className={styles.queueCardHeader}>

        <strong className={styles.queueCardCode}>СЗ №{item.memoNumber}</strong>

        <span

          className={`${styles.registryStageBadgeCompact} ${

            isCancelled ? styles.registryStageBadgeCancelled : ""

          }`}

        >

          {stageShortLabel}

        </span>

      </div>

      <p className={styles.queueCardTheme}>{item.title}</p>

      <div className={styles.registryProgressDots} aria-hidden="true">

        {meetingRegistryStages.map((stage, index) => (

          <span

            key={stage.id}

            className={`${styles.registryProgressDot} ${

              index <= stageIndex ? styles.registryProgressDotDone : ""

            } ${index === stageIndex && !isCancelled ? styles.registryProgressDotCurrent : ""}`}

          />

        ))}

      </div>

      <dl className={`${styles.queueCardFields} ${styles.registryQueueCardFields}`}>
        <div className={styles.registryQueueCardFieldWide}>
          <dt>Дата совещания</dt>
          <dd>{item.meetingAtLabel}</dd>
        </div>

        <div className={styles.registryQueueCardFieldWide}>
          <dt>Место</dt>
          <dd>{meetingPlaceFromInviteLocation(item.location)}</dd>
        </div>

        <div>
          <dt>Руководитель</dt>
          <dd className={styles.queueCardFieldPerson} title={item.manager}>
            {formatShortPersonName(item.manager)}
          </dd>
        </div>

        <div>
          <dt>Инициатор</dt>
          <dd className={styles.queueCardFieldPerson} title={item.initiator}>
            {formatShortPersonName(item.initiator)}
          </dd>
        </div>

        <div className={styles.registryQueueCardFieldParticipants}>
          <dt>Участники</dt>
          <dd>{item.participantsCount}</dd>
        </div>
      </dl>

    </button>

  );

}



function RegistryDetails({

  item,

  cancelSuccessMessage,

  isCancelling,

  isRescheduling,

  rescheduleSuccessMessage,

  onCancel,

  onReschedule,

  onParticipants,

  participantsSuccessMessage

}: {

  item: MeetingRegistryViewItem;

  cancelSuccessMessage: string | null;

  isCancelling: boolean;

  isRescheduling: boolean;

  rescheduleSuccessMessage: string | null;

  onCancel: () => void;

  onReschedule: () => void;

  onParticipants: () => void;

  participantsSuccessMessage: string | null;

}) {

  const isCancelled = item.stage === "cancelled";

  const currentIndex = getMeetingRegistryStageIndex(item.stage);

  const canCancelMeeting = item.stage !== "cancelled";

  const canRescheduleMeeting = isMeetingRegistryReschedulable(item.stage);



  return (

    <>

      <header className={styles.detailsHead}>

        <div>

          <h2 id="meeting-registry-details-title">

            СЗ №{item.memoNumber} · {item.title}

          </h2>

        </div>

        <span

          className={`${styles.registryStageBadge} ${

            isCancelled ? styles.registryStageBadgeCancelled : ""

          }`}

        >

          {getMeetingRegistryStageLabel(item.stage)}

        </span>

      </header>



      <div className={`${styles.section} ${styles.registrySection}`}>

        <h3>Этап жизненного цикла</h3>

        <ol className={styles.registryStepper} aria-label="Этапы совещания">

          {meetingRegistryStages.map((stage, index) => {

            const done = isCancelled ? index <= 1 : index <= currentIndex;

            const current = !isCancelled && index === currentIndex;

            return (

              <li

                key={stage.id}

                className={`${styles.registryStep} ${done ? styles.registryStepDone : ""} ${

                  current ? styles.registryStepCurrent : ""

                }`}

              >

                <span className={styles.registryStepIcon} aria-hidden="true">

                  {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}

                </span>

                <span className={styles.registryStepLabel}>{stage.shortLabel}</span>

              </li>

            );

          })}

          {isCancelled ? (

            <li

              className={`${styles.registryStep} ${styles.registryStepCancelled} ${styles.registryStepCurrent}`}

            >

              <span className={styles.registryStepIcon} aria-hidden="true">

                <Ban size={14} />

              </span>

              <span className={styles.registryStepLabel}>{meetingRegistryCancelledStage.shortLabel}</span>

            </li>

          ) : null}

        </ol>

      </div>



      <div className={`${styles.section} ${styles.registrySection}`}>

        <h3>Данные совещания</h3>

        <dl className={styles.dataGrid}>

          <div>

            <dt>Дата / время</dt>

            <dd>{item.meetingAtLabel}</dd>

          </div>

          <div>

            <dt>Место</dt>

            <dd>{meetingPlaceFromInviteLocation(item.location)}</dd>

          </div>

          <div>

            <dt>Инициатор</dt>

            <dd>{item.initiator}</dd>

          </div>

          <div>

            <dt>Руководитель</dt>

            <dd>{item.manager}</dd>

          </div>

          <div>

            <dt>Участники</dt>

            <dd>{item.participantsCount}</dd>

          </div>

          <div>

            <dt>Обновлено</dt>

            <dd>{formatMeetingDateTime(item.updatedAt)}</dd>

          </div>

          {isCancelled && item.cancelledAt ? (

            <div>

              <dt>Отменено</dt>

              <dd>{formatMeetingDateTime(item.cancelledAt)}</dd>

            </div>

          ) : null}

        </dl>

      </div>



      <div className={`${styles.section} ${styles.registrySection}`}>

        <h3>Ключевые события</h3>

        <ul className={styles.registryEvents}>

          <li className={styles.registryEventItem}>

            <CheckCircle2 size={16} aria-hidden="true" />

            <span>Служебная записка согласована в 1С</span>

          </li>

          <li className={styles.registryEventItem}>

            <Mail size={16} aria-hidden="true" />

            <span>Приглашения отправлены · {formatMeetingDateTime(item.invitationsSentAt)}</span>

          </li>

          {isCancelled ? (

            <li className={`${styles.registryEventItem} ${styles.registryEventCancelled}`}>

              <Ban size={16} aria-hidden="true" />

              <span>

                Совещание отменено

                {item.cancelledAt ? ` · ${formatMeetingDateTime(item.cancelledAt)}` : ""}

              </span>

            </li>

          ) : null}

          {!isCancelled && item.protocolNumber ? (

            <li className={styles.registryEventItem}>

              <FileText size={16} aria-hidden="true" />

              <span>Протокол {item.protocolNumber}</span>

            </li>

          ) : !isCancelled ? (

            <li className={`${styles.registryEventItem} ${styles.registryEventPending}`}>

              <FileText size={16} aria-hidden="true" />

              <span>Протокол ещё не создан</span>

            </li>

          ) : null}

        </ul>

      </div>



      <div className={`${styles.section} ${styles.registrySection}`}>

        <h3>Действия</h3>

        <div className={`${styles.actionRow} ${styles.registryActionRow}`}>

          {canRescheduleMeeting ? (

            <button

              type="button"

              className={styles.secondaryButton}

              disabled={isRescheduling}

              onClick={onReschedule}

            >

              {isRescheduling ? (

                <>

                  <Loader2 size={15} className={styles.spinner} aria-hidden="true" />

                  Ищем слот…

                </>

              ) : (

                <>

                  <CalendarClock size={15} aria-hidden="true" />

                  Перенести

                </>

              )}

            </button>

          ) : null}

          {canCancelMeeting ? (

            <button

              type="button"

              className={styles.rejectButton}

              disabled={isCancelling}

              onClick={onCancel}

            >

              {isCancelling ? (

                <>

                  <Loader2 size={15} className={styles.spinner} aria-hidden="true" />

                  Отменяем…

                </>

              ) : (

                <>

                  <Ban size={15} aria-hidden="true" />

                  Отменить

                </>

              )}

            </button>

          ) : null}

          <button type="button" className={styles.ghostButton} disabled title="Скоро">

            <CalendarDays size={15} aria-hidden="true" />

            Открыть в календаре

          </button>

          <button type="button" className={styles.ghostButton} disabled title="Скоро">

            <FileText size={15} aria-hidden="true" />

            Открыть протокол

          </button>

          <button type="button" className={styles.ghostButton} onClick={onParticipants}>

            <Users size={15} aria-hidden="true" />

            Список участников

          </button>

        </div>

        {cancelSuccessMessage ? (

          <p className={styles.registrySuccessNote} role="status">

            {cancelSuccessMessage}

          </p>

        ) : null}

        {rescheduleSuccessMessage ? (

          <p className={styles.registrySuccessNote} role="status">

            {rescheduleSuccessMessage}

          </p>

        ) : null}

        {participantsSuccessMessage ? (

          <p className={styles.registrySuccessNote} role="status">

            {participantsSuccessMessage}

          </p>

        ) : null}

      </div>

    </>

  );

}

