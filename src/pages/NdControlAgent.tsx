import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  FileDiff,
  FileText,
  Info,
  LoaderCircle,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { departmentsApi, ndChangeRequestsApi, usersApi } from "@/api/endpoints";
import { FormSelect } from "@/components/form-controls";
import LoadingPanel from "@/components/LoadingPanel";
import type {
  NdChangeCandidateDocument,
  NdChangeRequest,
  NdChangeRequestStatus,
  NdChangeTargetLocation
} from "@/types";
import styles from "./NdControlAgent.module.css";

const AGENT_TITLE = "Агент контроля НД и внесения изменений";
const AGENT_DESCRIPTION =
  "Помогает определить документ, найти место изменения, сформировать проект новой редакции, извещение и diff «было / стало» перед передачей на согласование.";

type WizardStep = "request" | "document" | "location" | "draft" | "approval";

const WIZARD_STEPS: Array<{ id: WizardStep; label: string; hint: string }> = [
  { id: "request", label: "Заявка", hint: "Причина и текст изменения" },
  { id: "document", label: "Документ", hint: "Определение целевого НД" },
  { id: "location", label: "Место изменения", hint: "Пункт и фрагмент" },
  { id: "draft", label: "Проект и diff", hint: "Было / стало, файлы" },
  { id: "approval", label: "Согласование", hint: "Передача на согласование" }
];

const STATUS_LABELS: Record<NdChangeRequestStatus, string> = {
  draft: "Черновик",
  submitted: "Отправлена",
  detecting_document: "Определение документа",
  requires_manual_document_selection: "Нужен выбор документа",
  document_selected: "Документ выбран",
  locating_change_place: "Поиск места изменения",
  requires_manual_location_selection: "Нужен выбор места",
  applying_changes: "Формирование проекта",
  ready_for_user_review: "На проверке",
  sent_to_approval: "Отправлено на согласование",
  approved: "Согласовано",
  rejected: "Отклонено",
  completed: "Завершено",
  failed: "Ошибка"
};

function extractError(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      return String((detail as { message?: string }).message ?? "Ошибка запроса");
    }
  }
  return error instanceof Error ? error.message : "Не удалось выполнить операцию";
}

function statusTone(status: NdChangeRequestStatus): string {
  if (status === "failed" || status === "rejected") return styles.statusFailed;
  if (status === "completed" || status === "approved" || status === "sent_to_approval") {
    return styles.statusDone;
  }
  if (
    status === "ready_for_user_review" ||
    status === "requires_manual_document_selection" ||
    status === "requires_manual_location_selection"
  ) {
    return styles.statusReview;
  }
  if (status === "draft") return styles.statusDraft;
  return styles.statusProgress;
}

function resolveWizardStep(status: NdChangeRequestStatus): WizardStep {
  if (
    status === "draft" ||
    status === "submitted" ||
    status === "detecting_document"
  ) {
    return "request";
  }
  if (
    status === "requires_manual_document_selection" ||
    status === "document_selected"
  ) {
    return "document";
  }
  if (
    status === "locating_change_place" ||
    status === "requires_manual_location_selection"
  ) {
    return "location";
  }
  if (
    status === "applying_changes" ||
    status === "ready_for_user_review"
  ) {
    return "draft";
  }
  return "approval";
}

function stepIndex(step: WizardStep) {
  return WIZARD_STEPS.findIndex((item) => item.id === step);
}

function isStepDone(current: WizardStep, step: WizardStep) {
  return stepIndex(step) < stepIndex(current);
}

function formatConfidence(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function candidateLabel(candidate: NdChangeCandidateDocument) {
  const code = candidate.document_code ? `${candidate.document_code} · ` : "";
  return `${code}${candidate.document_title ?? candidate.document_id.slice(0, 8)}`;
}

function locationLabel(location: NdChangeTargetLocation) {
  const section = location.section_number ? `п. ${location.section_number}` : "Раздел";
  const title = location.section_title ? ` — ${location.section_title}` : "";
  const page = location.page_number ? ` · стр. ${location.page_number}` : "";
  return `${section}${title}${page}`;
}

interface RequestFormState {
  reason: string;
  change_text: string;
  release_date: string;
  effective_date: string;
  assumed_document_code: string;
  initiator_comment: string;
  department_id: string;
}

const EMPTY_FORM: RequestFormState = {
  reason: "",
  change_text: "",
  release_date: "",
  effective_date: "",
  assumed_document_code: "",
  initiator_comment: "",
  department_id: ""
};

export default function NdControlAgent() {
  const queryClient = useQueryClient();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<WizardStep>("request");
  const [form, setForm] = useState<RequestFormState>(EMPTY_FORM);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [approvalUserIds, setApprovalUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["nd-change-requests"],
    queryFn: ndChangeRequestsApi.list
  });

  const previewQuery = useQuery({
    queryKey: ["nd-change-requests", selectedRequestId],
    queryFn: () => ndChangeRequestsApi.preview(selectedRequestId!),
    enabled: Boolean(selectedRequestId)
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list
  });

  const usersQuery = useQuery({
    queryKey: ["users", "responsible"],
    queryFn: usersApi.listResponsibleCandidates
  });

  const preview = previewQuery.data;
  const request = preview?.request;

  useEffect(() => {
    if (!request) return;
    setActiveStep(resolveWizardStep(request.status));
    const selectedCandidate = preview?.candidates.find((item) => item.is_selected);
    setSelectedCandidateId(selectedCandidate?.id ?? preview?.candidates[0]?.id ?? null);
    const confirmedLocation = preview?.target_locations.find((item) => item.status === "confirmed");
    setSelectedLocationId(confirmedLocation?.id ?? preview?.target_locations[0]?.id ?? null);
  }, [preview?.candidates, preview?.target_locations, request?.id, request?.status]);

  useEffect(() => {
    if (selectedRequestId || !requestsQuery.data?.length) return;
    setSelectedRequestId(requestsQuery.data[0].id);
  }, [requestsQuery.data, selectedRequestId]);

  const departmentOptions = useMemo(
    () =>
      (departmentsQuery.data ?? []).map((department) => ({
        value: department.id,
        label: department.name
      })),
    [departmentsQuery.data]
  );

  const approvalOptions = useMemo(
    () =>
      (usersQuery.data ?? []).map((user) => ({
        value: user.id,
        label: user.full_name || user.position || user.id.slice(0, 8)
      })),
    [usersQuery.data]
  );

  const invalidatePreview = async (requestId: string) => {
    await queryClient.invalidateQueries({ queryKey: ["nd-change-requests"] });
    await queryClient.invalidateQueries({ queryKey: ["nd-change-requests", requestId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      ndChangeRequestsApi.create({
        reason: form.reason.trim(),
        change_text: form.change_text.trim(),
        release_date: form.release_date || null,
        effective_date: form.effective_date || null,
        assumed_document_code: form.assumed_document_code.trim() || null,
        initiator_comment: form.initiator_comment.trim() || null,
        department_id: form.department_id || null
      }),
    onSuccess: async (created) => {
      setError(null);
      setSuccessMessage(`Создана заявка ${created.number}`);
      setSelectedRequestId(created.id);
      setForm(EMPTY_FORM);
      await invalidatePreview(created.id);
    },
    onError: (err) => setError(extractError(err))
  });

  const detectMutation = useMutation({
    mutationFn: (requestId: string) => ndChangeRequestsApi.detectDocument(requestId),
    onSuccess: async (_data, requestId) => {
      setError(null);
      setSuccessMessage("Кандидаты документов определены");
      await invalidatePreview(requestId);
      setActiveStep("document");
    },
    onError: (err) => setError(extractError(err))
  });

  const selectDocumentMutation = useMutation({
    mutationFn: ({
      requestId,
      candidate
    }: {
      requestId: string;
      candidate: NdChangeCandidateDocument;
    }) =>
      ndChangeRequestsApi.selectDocument(requestId, {
        document_id: candidate.document_id,
        document_version_id: candidate.document_version_id
      }),
    onSuccess: async (_data, variables) => {
      setError(null);
      setSuccessMessage("Документ выбран");
      await invalidatePreview(variables.requestId);
      setActiveStep("location");
    },
    onError: (err) => setError(extractError(err))
  });

  const findLocationMutation = useMutation({
    mutationFn: (requestId: string) => ndChangeRequestsApi.findLocation(requestId),
    onSuccess: async (_data, requestId) => {
      setError(null);
      setSuccessMessage("Места изменения найдены");
      await invalidatePreview(requestId);
      setActiveStep("location");
    },
    onError: (err) => setError(extractError(err))
  });

  const applyMutation = useMutation({
    mutationFn: ({
      requestId,
      locationId
    }: {
      requestId: string;
      locationId: string | null;
    }) =>
      ndChangeRequestsApi.applyChanges(requestId, {
        location_id: locationId,
        mark_user_reviewed: false
      }),
    onSuccess: async (_data, variables) => {
      setError(null);
      setSuccessMessage("Сформированы проект новой редакции и diff");
      await invalidatePreview(variables.requestId);
      setActiveStep("draft");
    },
    onError: (err) => setError(extractError(err))
  });

  const sendApprovalMutation = useMutation({
    mutationFn: (requestId: string) =>
      ndChangeRequestsApi.sendApproval(requestId, {
        approval_user_ids: approvalUserIds,
        mark_user_reviewed: true
      }),
    onSuccess: async (_data, requestId) => {
      setError(null);
      setSuccessMessage("Заявка отправлена на согласование");
      await invalidatePreview(requestId);
      setActiveStep("approval");
    },
    onError: (err) => setError(extractError(err))
  });

  const downloadDraftMutation = useMutation({
    mutationFn: (requestId: string) => ndChangeRequestsApi.downloadDraft(requestId),
    onSuccess: (blob) => downloadBlob(blob, "project-new-edition.docx"),
    onError: (err) => setError(extractError(err))
  });

  const downloadNoticeMutation = useMutation({
    mutationFn: (requestId: string) => ndChangeRequestsApi.downloadNotice(requestId),
    onSuccess: (blob) => downloadBlob(blob, "change-notice.docx"),
    onError: (err) => setError(extractError(err))
  });

  const isBusy =
    createMutation.isPending ||
    detectMutation.isPending ||
    selectDocumentMutation.isPending ||
    findLocationMutation.isPending ||
    applyMutation.isPending ||
    sendApprovalMutation.isPending ||
    downloadDraftMutation.isPending ||
    downloadNoticeMutation.isPending;

  const processingLabel = detectMutation.isPending
    ? "Определяем документ — это может занять до нескольких минут…"
    : findLocationMutation.isPending
      ? "Ищем место изменения — это может занять до нескольких минут…"
      : applyMutation.isPending
        ? "Формируем проект новой редакции и diff…"
        : selectDocumentMutation.isPending
          ? "Подтверждаем выбор документа…"
          : createMutation.isPending
            ? "Создаём заявку…"
            : sendApprovalMutation.isPending
              ? "Отправляем заявку на согласование…"
              : null;

  const isPreviewRefreshing =
    Boolean(selectedRequestId) && previewQuery.isFetching && !previewQuery.isLoading;

  const selectedCandidate =
    preview?.candidates.find((item) => item.id === selectedCandidateId) ?? null;
  const selectedLocation =
    preview?.target_locations.find((item) => item.id === selectedLocationId) ?? null;
  const diffRows =
    preview?.operations.flatMap((operation) => operation.diff ?? []) ?? [];
  const draftFile = preview?.draft_files.find((file) => file.file_type === "draft");
  const noticeFile = preview?.draft_files.find((file) => file.file_type === "notice");
  const warnings = preview?.result?.warnings ?? [];

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    createMutation.mutate();
  }

  function handleSelectRequest(item: NdChangeRequest) {
    setSelectedRequestId(item.id);
    setError(null);
    setSuccessMessage(null);
  }

  if (requestsQuery.isLoading) {
    return <LoadingPanel title="Загружаем заявки на изменение НД" />;
  }

  if (requestsQuery.isError) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <Link to="/agents" className={styles.backLink}>
            <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
            Каталог агентов
          </Link>
          <h1>{AGENT_TITLE}</h1>
        </header>
        <div className={styles.errorCallout} role="alert">
          <AlertTriangle size={18} strokeWidth={2.1} aria-hidden="true" />
          <p>{extractError(requestsQuery.error)}</p>
        </div>
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => requestsQuery.refetch()}
          >
            Повторить загрузку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/agents" className={styles.backLink}>
          <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
          Каталог агентов
        </Link>
        <div className={styles.headerRow}>
          <div>
            <h1>{AGENT_TITLE}</h1>
            <p>{AGENT_DESCRIPTION}</p>
          </div>
          <span className={styles.agentBadge}>
            <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
            nd_control_agent · v2.0
          </span>
        </div>
      </header>

      <section className={styles.requestsCard} aria-label="Список заявок">
        <h2>Заявки на изменение</h2>
        {!requestsQuery.data?.length ? (
          <div className={styles.emptyState}>Заявок пока нет — создайте первую ниже.</div>
        ) : (
          <div className={styles.requestList}>
            {requestsQuery.data.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.requestItem} ${
                  selectedRequestId === item.id ? styles.requestItemActive : ""
                }`}
                onClick={() => handleSelectRequest(item)}
              >
                <span className={styles.requestItemHead}>
                  <span className={styles.requestNumber}>{item.number}</span>
                  <span className={`${styles.statusBadge} ${statusTone(item.status)}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </span>
                <span className={styles.requestReason}>{item.reason}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className={styles.layout}>
        <aside className={styles.stepsCard} aria-label="Этапы агента">
          <h2>Workflow агента</h2>
          <div className={styles.stepList}>
            {WIZARD_STEPS.map((step, index) => {
              const done = isStepDone(activeStep, step.id);
              const active = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`${styles.stepItem} ${active ? styles.stepItemActive : ""} ${
                    done ? styles.stepItemDone : ""
                  }`}
                  onClick={() => setActiveStep(step.id)}
                  disabled={isBusy}
                >
                  <span className={styles.stepIndex}>
                    {done ? <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" /> : index + 1}
                  </span>
                  <span>
                    <span className={styles.stepTitle}>{step.label}</span>
                    <span className={styles.stepHint}>{step.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className={styles.contentCard}>
          {processingLabel ? (
            <div className={styles.processingBanner} role="status" aria-live="polite">
              <LoaderCircle size={18} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
              <span>{processingLabel}</span>
            </div>
          ) : null}

          {isPreviewRefreshing ? (
            <div className={styles.processingBanner} role="status" aria-live="polite">
              <LoaderCircle size={18} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
              <span>Обновляем данные заявки…</span>
            </div>
          ) : null}

          {error ? (
            <div className={styles.errorCallout} role="alert">
              <AlertTriangle size={18} strokeWidth={2.1} aria-hidden="true" />
              <p>{error}</p>
            </div>
          ) : null}

          {successMessage ? (
            <div className={styles.infoCallout}>
              <CheckCircle2 size={18} strokeWidth={2.1} aria-hidden="true" />
              <p>{successMessage}</p>
            </div>
          ) : null}

          {activeStep === "request" ? (
            <>
              <div>
                <h2>Новая заявка на изменение</h2>
                <p className={styles.contentIntro}>
                  Укажите причину и текст изменения. Агент не изменяет действующую редакцию напрямую —
                  только формирует проект и извещение после вашего подтверждения.
                </p>
              </div>
              <form className={styles.formGrid} onSubmit={handleCreateSubmit}>
                <label className={`${styles.field} ${styles.wideField}`}>
                  <span className={styles.fieldLabel}>
                    Причина изменения <span className={styles.required}>*</span>
                  </span>
                  <input
                    className={styles.control}
                    value={form.reason}
                    onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                    placeholder="Например: актуализация требований по охране труда"
                    required
                  />
                </label>
                <label className={`${styles.field} ${styles.wideField}`}>
                  <span className={styles.fieldLabel}>
                    Текст изменения <span className={styles.required}>*</span>
                  </span>
                  <textarea
                    className={`${styles.control} ${styles.textarea}`}
                    value={form.change_text}
                    onChange={(event) => setForm((prev) => ({ ...prev, change_text: event.target.value }))}
                    placeholder="Опишите, что нужно изменить в документе"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Дата выпуска извещения</span>
                  <input
                    className={styles.control}
                    type="date"
                    value={form.release_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, release_date: event.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Дата вступления в силу</span>
                  <input
                    className={styles.control}
                    type="date"
                    value={form.effective_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, effective_date: event.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Предполагаемый код документа</span>
                  <input
                    className={styles.control}
                    value={form.assumed_document_code}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, assumed_document_code: event.target.value }))
                    }
                    placeholder="СТО-00-000"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Подразделение</span>
                  <FormSelect
                    value={form.department_id}
                    onChange={(value) => setForm((prev) => ({ ...prev, department_id: value }))}
                    options={departmentOptions}
                    placeholder="Выберите подразделение"
                    ariaLabel="Подразделение"
                  />
                </label>
                <label className={`${styles.field} ${styles.wideField}`}>
                  <span className={styles.fieldLabel}>Комментарий инициатора</span>
                  <textarea
                    className={`${styles.control} ${styles.textarea} ${styles.textareaShort}`}
                    value={form.initiator_comment}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, initiator_comment: event.target.value }))
                    }
                    placeholder="Дополнительная информация для маршрута согласования"
                  />
                </label>
                <div className={`${styles.actionsRow} ${styles.wideField}`}>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={createMutation.isPending || !form.reason.trim() || !form.change_text.trim()}
                  >
                    {createMutation.isPending ? (
                      <LoaderCircle size={16} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
                    ) : null}
                    Создать заявку
                  </button>
                  {selectedRequestId ? (
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={detectMutation.isPending}
                      onClick={() => detectMutation.mutate(selectedRequestId)}
                    >
                      {detectMutation.isPending ? (
                        <LoaderCircle size={16} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
                      ) : (
                        <FileText size={16} strokeWidth={2.2} aria-hidden="true" />
                      )}
                      Определить документ
                    </button>
                  ) : null}
                </div>
              </form>
            </>
          ) : null}

          {activeStep === "document" ? (
            <>
              <div>
                <h2>Определение документа</h2>
                <p className={styles.contentIntro}>
                  Агент ищет целевой нормативный документ в доступных базах знаний. При низкой уверенности
                  выберите документ вручную.
                </p>
              </div>
              {!selectedRequestId ? (
                <div className={styles.emptyState}>Сначала создайте заявку.</div>
              ) : previewQuery.isLoading ? (
                <div className={styles.loadingState}>Загружаем кандидатов…</div>
              ) : previewQuery.isError ? (
                <div className={styles.errorCallout} role="alert">
                  <AlertTriangle size={18} strokeWidth={2.1} aria-hidden="true" />
                  <p>{extractError(previewQuery.error)}</p>
                </div>
              ) : !preview?.candidates.length ? (
                <div className={styles.infoCallout}>
                  <Info size={18} strokeWidth={2.1} aria-hidden="true" />
                  <p>Кандидаты ещё не определены. Запустите поиск документа.</p>
                </div>
              ) : (
                <div className={styles.optionGrid}>
                  {preview.candidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      className={`${styles.optionCard} ${
                        selectedCandidateId === candidate.id ? styles.optionCardSelected : ""
                      }`}
                      onClick={() => setSelectedCandidateId(candidate.id)}
                    >
                      <div className={styles.optionHead}>
                        <span className={styles.optionTitle}>{candidateLabel(candidate)}</span>
                        <span className={styles.confidenceBadge}>
                          {formatConfidence(candidate.score)}
                        </span>
                      </div>
                      <div className={styles.optionMeta}>
                        {candidate.match_reason ?? "Совпадение по тексту заявки"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={!selectedRequestId || detectMutation.isPending}
                  onClick={() => selectedRequestId && detectMutation.mutate(selectedRequestId)}
                >
                  Повторить поиск
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={
                    !selectedRequestId ||
                    !selectedCandidate ||
                    selectDocumentMutation.isPending
                  }
                  onClick={() =>
                    selectedRequestId &&
                    selectedCandidate &&
                    selectDocumentMutation.mutate({
                      requestId: selectedRequestId,
                      candidate: selectedCandidate
                    })
                  }
                >
                  Подтвердить документ
                  <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : null}

          {activeStep === "location" ? (
            <>
              <div>
                <h2>Место изменения</h2>
                <p className={styles.contentIntro}>
                  Агент определяет пункт, раздел или фрагмент документа, который нужно изменить.
                </p>
              </div>
              {!selectedRequestId ? (
                <div className={styles.emptyState}>Сначала выберите документ.</div>
              ) : previewQuery.isLoading ? (
                <div className={styles.loadingState}>Загружаем места изменения…</div>
              ) : previewQuery.isError ? (
                <div className={styles.errorCallout} role="alert">
                  <AlertTriangle size={18} strokeWidth={2.1} aria-hidden="true" />
                  <p>{extractError(previewQuery.error)}</p>
                </div>
              ) : !preview?.target_locations.length ? (
                <div className={styles.infoCallout}>
                  <MapPin size={18} strokeWidth={2.1} aria-hidden="true" />
                  <p>Места изменения ещё не найдены.</p>
                </div>
              ) : (
                <div className={styles.optionGrid}>
                  {preview.target_locations.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      className={`${styles.optionCard} ${
                        selectedLocationId === location.id ? styles.optionCardSelected : ""
                      }`}
                      onClick={() => setSelectedLocationId(location.id)}
                    >
                      <div className={styles.optionHead}>
                        <span className={styles.optionTitle}>{locationLabel(location)}</span>
                        <span className={styles.confidenceBadge}>
                          {formatConfidence(location.confidence)}
                        </span>
                      </div>
                      {location.current_text ? (
                        <div className={styles.optionMeta}>{location.current_text}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={!selectedRequestId || findLocationMutation.isPending}
                  onClick={() => selectedRequestId && findLocationMutation.mutate(selectedRequestId)}
                >
                  Найти место изменения
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={
                    !selectedRequestId ||
                    applyMutation.isPending ||
                    (!selectedLocationId && request?.requires_manual_location_selection)
                  }
                  onClick={() =>
                    selectedRequestId &&
                    applyMutation.mutate({
                      requestId: selectedRequestId,
                      locationId: selectedLocationId
                    })
                  }
                >
                  Сформировать проект
                  <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : null}

          {activeStep === "draft" ? (
            <>
              <div>
                <h2>Проект новой редакции и diff</h2>
                <p className={styles.contentIntro}>
                  Проверьте изменения «было / стало», скачайте проект документа и извещение об изменении.
                </p>
              </div>
              {warnings.length ? (
                <div className={styles.warningCallout}>
                  <AlertTriangle size={18} strokeWidth={2.1} aria-hidden="true" />
                  <ul className={styles.warningsList}>
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {diffRows.length ? (
                <div className={styles.diffPanel}>
                  {diffRows.map((row, index) => (
                    <article key={`${row.section_number ?? "section"}-${index}`} className={styles.diffBlock}>
                      {row.section_number ? (
                        <div className={styles.diffSectionTitle}>Пункт {row.section_number}</div>
                      ) : null}
                      <div className={styles.diffColumns}>
                        <div className={styles.diffColumn}>
                          <div className={styles.diffLabel}>Было</div>
                          <div className={`${styles.diffText} ${styles.diffOld}`}>
                            {row.old_text || "—"}
                          </div>
                        </div>
                        <div className={styles.diffColumn}>
                          <div className={styles.diffLabel}>Стало</div>
                          <div className={`${styles.diffText} ${styles.diffNew}`}>
                            {row.new_text || "—"}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.infoCallout}>
                  <FileDiff size={18} strokeWidth={2.1} aria-hidden="true" />
                  <p>Diff появится после формирования проекта новой редакции.</p>
                </div>
              )}
              <div className={styles.fileList}>
                {draftFile ? (
                  <div className={styles.fileRow}>
                    <div>
                      <div className={styles.fileName}>{draftFile.generated_filename}</div>
                      <div className={styles.fileMeta}>Проект новой редакции</div>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={!selectedRequestId || downloadDraftMutation.isPending}
                      onClick={() => selectedRequestId && downloadDraftMutation.mutate(selectedRequestId)}
                    >
                      {downloadDraftMutation.isPending ? (
                        <LoaderCircle size={16} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
                      ) : (
                        <Download size={16} strokeWidth={2.2} aria-hidden="true" />
                      )}
                      Скачать
                    </button>
                  </div>
                ) : null}
                {noticeFile ? (
                  <div className={styles.fileRow}>
                    <div>
                      <div className={styles.fileName}>{noticeFile.generated_filename}</div>
                      <div className={styles.fileMeta}>Извещение об изменении</div>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={!selectedRequestId || downloadNoticeMutation.isPending}
                      onClick={() => selectedRequestId && downloadNoticeMutation.mutate(selectedRequestId)}
                    >
                      {downloadNoticeMutation.isPending ? (
                        <LoaderCircle size={16} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
                      ) : (
                        <Download size={16} strokeWidth={2.2} aria-hidden="true" />
                      )}
                      Скачать
                    </button>
                  </div>
                ) : null}
              </div>
              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={!selectedRequestId || isBusy}
                  onClick={() => setActiveStep("approval")}
                >
                  Перейти к согласованию
                  <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : null}

          {activeStep === "approval" ? (
            <>
              <div>
                <h2>Согласование</h2>
                <p className={styles.contentIntro}>
                  После проверки diff и файлов передайте заявку на согласование ответственным лицам.
                </p>
              </div>
              <label className={`${styles.field} ${styles.wideField}`}>
                <span className={styles.fieldLabel}>Согласующие</span>
                <FormSelect
                  value={approvalUserIds[0] ?? ""}
                  onChange={(value) => setApprovalUserIds(value ? [value] : [])}
                  options={approvalOptions}
                  placeholder="Выберите согласующего"
                  ariaLabel="Согласующий"
                />
              </label>
              {preview?.approval_routes.length ? (
                <div className={styles.infoCallout}>
                  <ShieldCheck size={18} strokeWidth={2.1} aria-hidden="true" />
                  <p>
                    Маршрут согласования уже создан · статус{" "}
                    {preview.approval_routes[0].status}
                  </p>
                </div>
              ) : null}
              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={
                    !selectedRequestId ||
                    !approvalUserIds.length ||
                    sendApprovalMutation.isPending
                  }
                  onClick={() => selectedRequestId && sendApprovalMutation.mutate(selectedRequestId)}
                >
                  {sendApprovalMutation.isPending ? (
                    <LoaderCircle size={16} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
                  ) : (
                    <Send size={16} strokeWidth={2.2} aria-hidden="true" />
                  )}
                  Отправить на согласование
                </button>
              </div>
            </>
          ) : null}
        </main>

        <aside className={styles.summaryCard} aria-label="Сводка заявки">
          <h2>Сводка</h2>
          {selectedRequestId && previewQuery.isLoading ? (
            <div className={styles.loadingState}>Загружаем сводку…</div>
          ) : selectedRequestId && previewQuery.isError ? (
            <div className={styles.errorCallout} role="alert">
              <AlertTriangle size={18} strokeWidth={2.1} aria-hidden="true" />
              <p>{extractError(previewQuery.error)}</p>
            </div>
          ) : !request ? (
            <div className={styles.emptyState}>Выберите или создайте заявку.</div>
          ) : (
            <>
              <div className={styles.summaryBlock}>
                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Номер</span>
                    <span className={styles.summaryValue}>{request.number}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Статус</span>
                    <span className={`${styles.statusBadge} ${statusTone(request.status)}`}>
                      {STATUS_LABELS[request.status]}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Уверенность</span>
                    <span className={styles.summaryValue}>
                      {formatConfidence(request.detection_confidence)}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Выпуск извещения</span>
                    <span className={styles.summaryValue}>{formatDate(request.release_date)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Вступление в силу</span>
                    <span className={styles.summaryValue}>{formatDate(request.effective_date)}</span>
                  </div>
                </div>
              </div>
              <div className={styles.summaryBlock}>
                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Документ</span>
                    <span className={styles.summaryValue}>
                      {selectedCandidate ? candidateLabel(selectedCandidate) : "Не выбран"}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Место изменения</span>
                    <span className={styles.summaryValue}>
                      {selectedLocation ? locationLabel(selectedLocation) : "Не определено"}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Файлы</span>
                    <span className={styles.summaryValue}>
                      {(draftFile ? 1 : 0) + (noticeFile ? 1 : 0)} шт.
                    </span>
                  </div>
                </div>
              </div>
              {preview?.result?.summary ? (
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Итог агента</span>
                    <span className={styles.summaryValue}>{preview.result.summary}</span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
