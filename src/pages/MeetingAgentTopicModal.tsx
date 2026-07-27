import { useEffect, useMemo, useRef, useState } from "react";

import { AlertTriangle, CheckCircle2, Loader2, Users, X } from "lucide-react";

import {

  useMeetingTopicCheckSimilar,

  useMeetingTopicResolve

} from "@/hooks/useMeetingMemoDetail";

import { getMeetingRequestError } from "@/hooks/useMeetingDashboard";

import type {
  MeetingDashboardItem,
  MeetingMemoDetail,
  MeetingTopicCheckSimilarRead,
  MeetingTopicParticipant,
  MeetingTopicResolveRead,
  MeetingTopicSimilarityBreakdown,
  MeetingTopicSummary
} from "@/types/meetings";

import {
  MEETING_TOPIC_TYPES,
  buildMeetingTopicCheckPayload,
  buildResolveTopicParticipantFios,
  buildScheduleMeetingTopicCheckPayload,
  formatMeetingTopicParticipantScore,
  formatMeetingTopicSimilarityBreakdown,
  formatMeetingTopicSimilarityScore,
  mapScheduleTypeToMeetingTopicType,
  normalizeMeetingTopicType,
  type ScheduleTopicFormSnapshot
} from "@/utils/meetingTopic";
import { isRequestAborted } from "@/utils/requestAbort";

import styles from "./MeetingAgent.module.css";



type ModalStep = "checking" | "similar" | "create" | "resolved";



type CreateFormState = {

  description: string;

  managerFio: string;

  meetingType: string;

  topicDetails: string;

  participantFios: string;

};



type MemoTopicModalProps = {

  mode: "memo";

  detail: MeetingMemoDetail;

  queueItem: MeetingDashboardItem | null;

};



type ScheduleTopicModalProps = {

  mode: "schedule";

  schedule: ScheduleTopicFormSnapshot;

};



type Props = {

  open: boolean;

  onClose: () => void;

  onResolved: (result: MeetingTopicResolveRead) => void;

} & (MemoTopicModalProps | ScheduleTopicModalProps);



function buildCreateFormStateFromMemo(

  detail: MeetingMemoDetail,

  queueItem: MeetingDashboardItem | null

): CreateFormState {

  const payload = buildMeetingTopicCheckPayload(detail, queueItem);

  const participantFios = payload?.participant_fios?.join("\n") ?? "";

  return {

    description: payload?.description ?? detail.title ?? "",

    managerFio: payload?.manager_fio ?? detail.application.manager?.full_name ?? "",

    meetingType: payload?.meeting_type ?? normalizeMeetingTopicType(detail.application.meeting_type),

    topicDetails: payload?.topic_details ?? detail.application.agenda ?? "",

    participantFios

  };

}



function buildCreateFormStateFromSchedule(schedule: ScheduleTopicFormSnapshot): CreateFormState {

  const payload = buildScheduleMeetingTopicCheckPayload(schedule);

  const participantFios = payload?.participant_fios?.join("\n") ?? "";

  return {

    description: payload?.description ?? schedule.title,

    managerFio: payload?.manager_fio ?? schedule.managerFio,

    meetingType: payload?.meeting_type ?? mapScheduleTypeToMeetingTopicType(schedule.meetingType),

    topicDetails: payload?.topic_details ?? schedule.comment ?? "",

    participantFios

  };

}



function buildCreateFormState(props: Props): CreateFormState {

  if (props.mode === "schedule") {

    return buildCreateFormStateFromSchedule(props.schedule);

  }

  return buildCreateFormStateFromMemo(props.detail, props.queueItem);

}



function buildCheckPayload(props: Props) {

  if (props.mode === "schedule") {

    return buildScheduleMeetingTopicCheckPayload(props.schedule);

  }

  return buildMeetingTopicCheckPayload(props.detail, props.queueItem);

}



function modalHint(props: Props, checkResult: MeetingTopicCheckSimilarRead | null): string {

  if (checkResult?.message) {

    return checkResult.message;

  }

  if (props.mode === "schedule") {

    return "Перед сохранением серии проверяем, есть ли у руководителя похожая тема совещания в 1С.";

  }

  return "Перед подбором слота проверяем, есть ли у руководителя похожая тема совещания.";

}



function SimilarTopicCard({
  topic,
  similarityBreakdown
}: {
  topic: MeetingTopicSummary;
  similarityBreakdown?: MeetingTopicSimilarityBreakdown | null;
}) {
  const participants = topic.participants ?? [];
  const breakdown = similarityBreakdown ?? topic.similarity_breakdown;
  const participantsScore = formatMeetingTopicParticipantScore(breakdown?.participants);

  return (
    <div className={styles.topicSimilarCard}>
      <div className={styles.topicSimilarHeader}>
        <CheckCircle2 size={18} aria-hidden="true" />
        <div>
          <strong>
            Тема №{topic.code ?? "?"}{topic.description ? `: ${topic.description}` : ""}
          </strong>
          {topic.similarity_score != null ? (
            <p className={styles.topicSimilarScore}>
              Сходство: {formatMeetingTopicSimilarityScore(topic.similarity_score)}
              {breakdown ? ` · ${formatMeetingTopicSimilarityBreakdown(breakdown)}` : ""}
            </p>
          ) : null}
          {participantsScore ? (
            <p className={styles.topicSimilarParticipantsScore}>
              Совпадение участников: {participantsScore}
            </p>
          ) : null}
        </div>
      </div>



      <dl className={styles.topicSimilarFields}>

        {topic.meeting_type ? (

          <div>

            <dt>Вид совещания</dt>

            <dd>{topic.meeting_type}</dd>

          </div>

        ) : null}

        {topic.manager ? (

          <div>

            <dt>Руководитель</dt>

            <dd>{topic.manager}</dd>

          </div>

        ) : null}

        {topic.room ? (

          <div>

            <dt>Переговорная</dt>

            <dd>{topic.room}</dd>

          </div>

        ) : null}

        {topic.details ? (

          <div className={styles.topicSimilarDetails}>

            <dt>Описание</dt>

            <dd>{topic.details}</dd>

          </div>

        ) : null}

      </dl>



      {participants.length ? (

        <div className={styles.topicSimilarParticipants}>

          <span className={styles.topicSimilarParticipantsLabel}>

            <Users size={14} aria-hidden="true" />

            Участники ({participants.length})

          </span>

          <ul>

            {participants.map((participant) => (

              <li key={participant.participant_ref_key ?? participant.fio ?? "unknown"}>

                {participant.fio ?? "Без ФИО"}

              </li>

            ))}

          </ul>

        </div>

      ) : null}

    </div>

  );

}



function MissingParticipantsBlock({
  participants,
  unresolvedParticipants = [],
  message
}: {
  participants: MeetingTopicParticipant[];
  unresolvedParticipants?: MeetingTopicParticipant[];
  message?: string | null;
}) {
  if (!participants.length && !unresolvedParticipants.length && !message) return null;

  const unresolvedNames = new Set(
    unresolvedParticipants
      .map((item) => item.fio?.trim().toLocaleLowerCase("ru-RU"))
      .filter((value): value is string => Boolean(value))
  );

  return (
    <div className={styles.topicMissingParticipants}>
      {message ? <p className={styles.topicMissingParticipantsMessage}>{message}</p> : null}
      {participants.length ? (
        <>
          <strong className={styles.topicMissingParticipantsTitle}>
            Добавить в тему из СЗ ({participants.length})
          </strong>
          <p className={styles.topicMissingParticipantsMessage}>
            При выборе «Использовать эту тему» эти участники будут добавлены в тему в 1С.
          </p>
          <ul className={styles.topicMissingParticipantsList}>
            {participants.map((participant) => {
              const fio = participant.fio ?? "Без ФИО";
              const unresolved = unresolvedNames.has(fio.trim().toLocaleLowerCase("ru-RU"));
              return (
                <li key={participant.participant_ref_key ?? fio}>
                  {fio}
                  {unresolved ? " — не найден в 1С, добавить автоматически нельзя" : ""}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function TopicResolveResultBlock({ result }: { result: MeetingTopicResolveRead }) {
  const addedParticipants = result.added_participants ?? [];

  return (
    <div className={styles.topicResolveResult}>
      {result.message ? <p className={styles.topicResolveResultMessage}>{result.message}</p> : null}
      {addedParticipants.length ? (
        <>
          <strong className={styles.topicResolveResultTitle}>
            Добавлены в тему 1С ({addedParticipants.length})
          </strong>
          <ul className={styles.topicResolveResultList}>
            {addedParticipants.map((participant) => (
              <li key={participant.participant_ref_key ?? participant.fio ?? "unknown"}>
                {participant.fio ?? "Без ФИО"}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.topicResolveResultEmpty}>Новых участников в 1С не добавлено.</p>
      )}
    </div>
  );
}

function ExistingTopicUsageHint() {

  return (

    <p className={styles.modalHint}>

      При использовании этой темы совещание будет оформлено с тем же названием и видом совещания,

      что указаны в 1С.

    </p>

  );

}



export default function MeetingAgentTopicModal(props: Props) {

  const { open, onClose, onResolved } = props;

  const checkSimilarMutation = useMeetingTopicCheckSimilar();

  const resolveMutation = useMeetingTopicResolve();

  const [step, setStep] = useState<ModalStep>("checking");

  const [checkResult, setCheckResult] = useState<MeetingTopicCheckSimilarRead | null>(null);
  const [resolveResult, setResolveResult] = useState<MeetingTopicResolveRead | null>(null);
  const [form, setForm] = useState<CreateFormState>(() => buildCreateFormState(props));

  const [validationError, setValidationError] = useState<string | null>(null);
  const checkAbortRef = useRef<AbortController | null>(null);
  const resolveAbortRef = useRef<AbortController | null>(null);



  const checkPayload = useMemo(() => buildCheckPayload(props), [props]);



  const initiatorFio = useMemo(() => {

    if (props.mode === "schedule") {

      return props.schedule.responsibleFio?.trim() || null;

    }

    return props.detail.application.initiator?.full_name?.trim() || null;

  }, [props]);

  function abortInFlightTopicRequests() {
    checkAbortRef.current?.abort();
    resolveAbortRef.current?.abort();
    checkAbortRef.current = null;
    resolveAbortRef.current = null;
    checkSimilarMutation.reset();
    resolveMutation.reset();
  }

  function handleClose() {
    abortInFlightTopicRequests();
    onClose();
  }



  useEffect(() => {

    if (!open) {
      abortInFlightTopicRequests();
      return;
    }

    setStep("checking");
    setCheckResult(null);
    setResolveResult(null);
    setValidationError(null);

    setForm(buildCreateFormState(props));

    checkSimilarMutation.reset();

    resolveMutation.reset();



    if (!checkPayload) {

      setStep("create");

      setValidationError(

        props.mode === "schedule"

          ? "Не хватает данных серии для проверки темы: укажите название и руководителя."

          : "Не хватает данных заявки для проверки темы: укажите название и руководителя."

      );

      return;

    }

    checkAbortRef.current?.abort();
    const controller = new AbortController();
    checkAbortRef.current = controller;

    void checkSimilarMutation

      .mutateAsync({ payload: checkPayload, signal: controller.signal })

      .then((result) => {
        if (controller.signal.aborted) return;
        setCheckResult(result);

        setStep(result.similar_found ? "similar" : "create");

      })

      .catch((error) => {
        if (isRequestAborted(error, controller.signal)) return;
        setStep("create");

      });

    return () => {
      controller.abort();
    };

  }, [open, checkPayload, props.mode]);



  if (!open) return null;



  const loading = checkSimilarMutation.isPending || resolveMutation.isPending;

  const requestError =
    checkSimilarMutation.isError && !isRequestAborted(checkSimilarMutation.error)
      ? getMeetingRequestError(checkSimilarMutation.error)
      : resolveMutation.isError && !isRequestAborted(resolveMutation.error)
        ? getMeetingRequestError(resolveMutation.error)
        : null;



  function parseParticipantFios(value: string): string[] {

    return [

      ...new Set(

        value

          .split(/\r?\n|,/)

          .map((item) => item.trim())

          .filter(Boolean)

      )

    ];

  }



  function buildMergedParticipantFios(): string[] {

    return [

      ...new Set(

        [

          initiatorFio,

          form.managerFio.trim(),

          ...parseParticipantFios(form.participantFios)

        ].filter((name): name is string => Boolean(name))

      )

    ];

  }



  function validateCreateForm(): string | null {

    if (!form.description.trim()) return "Укажите наименование темы";

    if (!form.managerFio.trim()) return "Укажите ФИО руководителя";

    if (!form.meetingType.trim()) return "Выберите вид совещания";

    if (!buildMergedParticipantFios().length) {

      return "Укажите участников темы — они сохраняются в 1С и попадают в протокол";

    }

    return null;

  }



  function buildResolveParticipantFios(): string[] {
    return buildResolveTopicParticipantFios({
      participantFios: parseParticipantFios(form.participantFios),
      initiatorFio: initiatorFio,
      managerFio: form.managerFio,
      checkParticipantFios: checkPayload?.participant_fios
    });
  }

  async function handleUseExisting() {
    const refKey = checkResult?.similar_topic?.ref_key?.trim();
    const participantFios = buildResolveParticipantFios();
    const managerFio = form.managerFio.trim();

    if (!refKey) {
      setValidationError("У похожей темы нет ref_key");
      return;
    }

    if (!participantFios.length && !(checkResult?.missing_participants?.length ?? 0)) {
      setValidationError("Укажите участников совещания для добавления в тему 1С.");
      return;
    }

    setValidationError(null);

    resolveAbortRef.current?.abort();
    const controller = new AbortController();
    resolveAbortRef.current = controller;

    try {
      const result = await resolveMutation.mutateAsync({
        payload: {
          decision: "use_existing",
          existing_topic_ref_key: refKey,
          manager_fio: managerFio || null,
          initiator_fio: initiatorFio,
          participant_fios: participantFios
        },
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      setResolveResult(result);
      setStep("resolved");
    } catch (error) {
      if (isRequestAborted(error, controller.signal)) return;
      // surfaced below
    }
  }



  async function handleCreateNew() {

    const error = validateCreateForm();

    if (error) {

      setValidationError(error);

      return;

    }

    setValidationError(null);

    resolveAbortRef.current?.abort();
    const controller = new AbortController();
    resolveAbortRef.current = controller;

    try {

      const result = await resolveMutation.mutateAsync({
        payload: {
          decision: "create_new",
          description: form.description.trim(),
          manager_fio: form.managerFio.trim(),
          meeting_type: form.meetingType.trim(),
          topic_details: form.topicDetails.trim() || null,
          initiator_fio: initiatorFio,
          participant_fios: buildMergedParticipantFios()
        },
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      setResolveResult(result);
      setStep("resolved");

    } catch (error) {
      if (isRequestAborted(error, controller.signal)) return;
      // surfaced below

    }

  }



  const createButtonLabel =

    props.mode === "schedule" ? "Создать тему и сохранить серию" : "Создать тему и продолжить";



  return (

    <div className={styles.modalOverlay} onClick={handleClose} role="presentation">

      <div

        className={`${styles.modalCard} ${styles.topicModalCard}`}

        onClick={(event) => event.stopPropagation()}

        role="dialog"

        aria-modal="true"

        aria-labelledby="meeting-topic-title"

      >

        <div className={styles.modalHeader}>

          <h2 id="meeting-topic-title">Тема совещания в 1С</h2>

          <button

            type="button"

            className={styles.modalCloseButton}

            onClick={handleClose}

            aria-label="Закрыть"

          >

            <X size={18} aria-hidden="true" />

          </button>

        </div>



        <p className={styles.modalHint}>
          {step === "similar" && checkResult?.message
            ? checkResult.message
            : step === "resolved" && resolveResult?.message
              ? resolveResult.message
              : modalHint(props, checkResult)}
        </p>



        {step === "checking" ? (

          <div className={styles.modalLoader} role="status">

            <Loader2 size={18} className={styles.spinner} aria-hidden="true" />

            <span>Проверяем похожие темы…</span>

          </div>

        ) : null}



        {step === "similar" && checkResult?.similar_topic ? (
          <div className={styles.modalSection}>
            <SimilarTopicCard
              topic={checkResult.similar_topic}
              similarityBreakdown={checkResult.similarity_breakdown}
            />
            <MissingParticipantsBlock
              participants={checkResult.missing_participants ?? []}
              unresolvedParticipants={checkResult.unresolved_participants ?? []}
            />
            <ExistingTopicUsageHint />
          </div>
        ) : null}

        {step === "resolved" && resolveResult ? (
          <div className={styles.modalSection}>
            <TopicResolveResultBlock result={resolveResult} />
          </div>
        ) : null}



        {step === "create" ? (

          <div className={styles.topicCreateForm}>

            <div className={styles.rejectReasonField}>

              <label htmlFor="meeting-topic-description">Наименование темы</label>

              <input

                id="meeting-topic-description"

                className={styles.topicTextInput}

                value={form.description}

                onChange={(event) =>

                  setForm((current) => ({ ...current, description: event.target.value }))

                }

                disabled={loading}

              />

            </div>



            <div className={styles.rejectReasonField}>

              <label htmlFor="meeting-topic-manager">Руководитель</label>

              <input

                id="meeting-topic-manager"

                className={styles.topicTextInput}

                value={form.managerFio}

                onChange={(event) =>

                  setForm((current) => ({ ...current, managerFio: event.target.value }))

                }

                disabled={loading}

              />

            </div>



            <div className={styles.rejectReasonField}>

              <label htmlFor="meeting-topic-type">Вид совещания</label>

              <select

                id="meeting-topic-type"

                className={styles.topicSelectInput}

                value={form.meetingType}

                onChange={(event) =>

                  setForm((current) => ({ ...current, meetingType: event.target.value }))

                }

                disabled={loading}

              >

                {MEETING_TOPIC_TYPES.map((type) => (

                  <option key={type} value={type}>

                    {type}

                  </option>

                ))}

              </select>

            </div>



            <div className={styles.rejectReasonField}>

              <label htmlFor="meeting-topic-details">Описание</label>

              <textarea

                id="meeting-topic-details"

                className={styles.rejectReasonInput}

                value={form.topicDetails}

                onChange={(event) =>

                  setForm((current) => ({ ...current, topicDetails: event.target.value }))

                }

                disabled={loading}

              />

            </div>



            <div className={styles.rejectReasonField}>

              <label htmlFor="meeting-topic-participants">

                Участники (обязательно; ответственный и руководитель включаются автоматически)

              </label>

              <textarea

                id="meeting-topic-participants"

                className={styles.rejectReasonInput}

                value={form.participantFios}

                onChange={(event) =>

                  setForm((current) => ({ ...current, participantFios: event.target.value }))

                }

                disabled={loading}

              />

            </div>

          </div>

        ) : null}



        {validationError ? (

          <p className={styles.runError} role="alert">

            {validationError}

          </p>

        ) : null}



        {requestError ? (

          <div className={styles.modalError} role="alert">

            <AlertTriangle size={16} aria-hidden="true" />

            <span>{requestError}</span>

          </div>

        ) : null}



        <div className={`${styles.modalActions} ${styles.modalActionsSplit}`}>

          <div className={styles.modalActionsStart}>

            <button type="button" className={styles.ghostButton} onClick={handleClose}>

              Отмена

            </button>

          </div>

          <div className={styles.modalActionsEnd}>

            {step === "resolved" ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => resolveResult && onResolved(resolveResult)}
                disabled={loading || !resolveResult}
              >
                Продолжить
              </button>
            ) : null}

            {step === "similar" ? (
              <>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setValidationError(null);
                    setStep("create");
                  }}
                  disabled={loading}
                >
                  Создать новую
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleUseExisting()}
                  disabled={loading}
                >
                  {resolveMutation.isPending ? (
                    <>
                      <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                      Сохраняем…
                    </>
                  ) : (
                    "Использовать эту тему"
                  )}
                </button>
              </>
            ) : null}



            {step === "create" ? (

              <button

                type="button"

                className={styles.primaryButton}

                onClick={() => void handleCreateNew()}

                disabled={loading}

              >

                {resolveMutation.isPending ? (

                  <>

                    <Loader2 size={16} className={styles.spinner} aria-hidden="true" />

                    Создаём тему…

                  </>

                ) : (

                  createButtonLabel

                )}

              </button>

            ) : null}

          </div>

        </div>

      </div>

    </div>

  );

}

