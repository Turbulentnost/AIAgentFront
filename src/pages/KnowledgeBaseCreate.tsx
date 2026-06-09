import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Cog,
  Database,
  FilePlus2,
  FileText,
  Info,
  ListTree,
  Lock,
  LockKeyhole,
  CloudUpload,
  MoreVertical,
  ScanText,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  SplitSquareHorizontal,
  Table2,
  Upload,
  X
} from "lucide-react";
import { isAxiosError } from "axios";
import { agentsApi, departmentsApi, documentsApi, knowledgeBasesApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import DepartmentSelect from "@/components/DepartmentSelect";
import { FormAutocomplete, FormSelect, SourceFilterBar, Switch } from "@/components/form-controls";
import type {
  AgentAccess,
  Department,
  Document,
  DocumentType,
  KnowledgeBaseAccessType,
  KnowledgeBaseAgentAccessMode,
  KnowledgeBaseCreate,
  User
} from "@/types";
import { filterActiveDepartments } from "@/utils/departments";
import styles from "./KnowledgeBaseCreate.module.css";

type StepId = "main" | "sources" | "readiness" | "processing" | "access" | "agents" | "preview";
type BaseKind = "normative" | "technical" | "project" | "contract" | "process";
type AccessMode = "users" | "departments" | "mixed" | "admins" | "agents";

type ProcessingMode = "standard" | "advanced";

type ProcessingToggleKey =
  | "ocr"
  | "textExtraction"
  | "tableExtraction"
  | "preserveStructure"
  | "chunking"
  | "embeddings"
  | "qdrantIndexing"
  | "manualReview";

interface ProcessingSettings {
  mode: ProcessingMode;
  ocr: boolean;
  textExtraction: boolean;
  tableExtraction: boolean;
  preserveStructure: boolean;
  chunking: boolean;
  embeddings: boolean;
  qdrantIndexing: boolean;
  manualReview: boolean;
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  vectorStore: string;
  qdrantCollection: string;
}

const embeddingModelOptions = [{ value: "bge-m3", label: "BAAI/bge-m3 (1024)" }] as const;

const processingStageDefinitions: {
  key: ProcessingToggleKey;
  title: string;
  description: string;
  tooltip: string;
  icon: typeof FileText;
  alwaysOn: boolean;
}[] = [
  {
    key: "ocr",
    title: "OCR распознавание",
    description: "Распознавание текста на сканах и изображениях",
    tooltip: "Преобразует сканы и изображения в текст, чтобы документы без текстового слоя можно было индексировать и искать.",
    icon: ScanText,
    alwaysOn: false
  },
  {
    key: "textExtraction",
    title: "Извлечение текста",
    description: "Получение текста из PDF, DOCX, PPTX и других форматов",
    tooltip: "Обязательный этап: извлекает текст из офисных и PDF-файлов перед дальнейшей обработкой и индексацией.",
    icon: FileText,
    alwaysOn: true
  },
  {
    key: "tableExtraction",
    title: "Извлечение таблиц",
    description: "Распознавание и извлечение таблиц в структурированном виде",
    tooltip: "Сохраняет табличные данные отдельно, чтобы агент мог точнее отвечать на вопросы по числам и строкам таблиц.",
    icon: Table2,
    alwaysOn: false
  },
  {
    key: "preserveStructure",
    title: "Сохранение структуры",
    description: "Сохранение заголовков, разделов, списков и иерархии документа",
    tooltip: "Учитывает заголовки, разделы и списки, чтобы поиск и цитирование сохраняли логику исходного документа.",
    icon: ListTree,
    alwaysOn: false
  },
  {
    key: "chunking",
    title: "Разбиение на chunks",
    description: "Разделение текста на фрагменты для индексации",
    tooltip: "Делит текст на фрагменты подходящего размера для векторного поиска и ответов агента.",
    icon: SplitSquareHorizontal,
    alwaysOn: false
  },
  {
    key: "embeddings",
    title: "Создание embeddings",
    description: "Преобразование текста в векторные представления",
    tooltip: "Обязательный этап: преобразует фрагменты текста в векторы для семантического поиска по базе знаний.",
    icon: Sparkles,
    alwaysOn: true
  },
  {
    key: "qdrantIndexing",
    title: "Индексация в Qdrant",
    description: "Сохранение векторов в векторное хранилище Qdrant",
    tooltip: "Обязательный этап: записывает векторы в Qdrant, чтобы агенты могли быстро находить релевантные фрагменты.",
    icon: Database,
    alwaysOn: true
  },
  {
    key: "manualReview",
    title: "Ручная проверка перед публикацией",
    description: "Требовать подтверждение перед публикацией базы знаний",
    tooltip: "Блокирует публикацию базы до ручного подтверждения администратором или ответственным.",
    icon: ClipboardCheck,
    alwaysOn: false
  }
];

const processingAdvancedParamHints = {
  chunkSize: "Размер одного фрагмента в токенах. Большие значения дают больше контекста, но могут снизить точность поиска.",
  chunkOverlap: "Количество пересекающихся токенов между соседними фрагментами. Помогает не терять смысл на границах chunks.",
  embeddingModel: "Модель, которая преобразует текст в векторы. От неё зависит качество семантического поиска.",
  vectorStore: "Основное векторное хранилище платформы. Для типовых баз используется Qdrant без дополнительной настройки.",
  qdrantCollection: "Имя коллекции в Qdrant, куда будут записаны векторы этой базы знаний. Допустимы латиница, цифры и _."
} as const;

const sidebarSteps = [
  { label: "Основные сведения", hint: "Информация о базе знаний", stepIndexes: [0] },
  { label: "Источники", hint: "Выбор документов и файлов", stepIndexes: [1, 2] },
  { label: "Обработка", hint: "Извлечение и индексация", stepIndexes: [3] },
  { label: "Доступ и агенты", hint: "Права и подключение", stepIndexes: [4, 5] },
  { label: "Проверка и создание", hint: "Итоговая проверка", stepIndexes: [6] }
] as const;

const steps: { id: StepId; label: string; hint: string; navLabel: string }[] = [
  { id: "main", label: "Основные сведения", hint: "Информация о базе знаний", navLabel: "Основные сведения" },
  { id: "sources", label: "Источники", hint: "Выбор документов и файлов", navLabel: "Выбор источников" },
  { id: "readiness", label: "Источники", hint: "Проверка готовности документов", navLabel: "Проверка готовности" },
  { id: "processing", label: "Обработка", hint: "Извлечение и индексация", navLabel: "Обработка" },
  { id: "access", label: "Доступ и агенты", hint: "Права и подключение", navLabel: "Настройка доступа" },
  { id: "agents", label: "Доступ и агенты", hint: "Подключение ИИ-агентов", navLabel: "Подключение агентов" },
  { id: "preview", label: "Проверка и создание", hint: "Итоговая проверка", navLabel: "Проверка и создание" }
];

const documentTypeLabels: Partial<Record<DocumentType, string>> = {
  regulation: "Регламент",
  protocol: "Протокол",
  contract: "Договор",
  specification: "Спецификация",
  checklist: "Шаблон",
  memo: "Инструкция",
  order: "Приказ",
  act: "Акт",
  tz: "ТЗ",
  pmi: "ПМИ",
  kd: "КД",
  td: "ТД",
  other: "Прочее"
};

const sourceAcceptExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"];
const sourceAcceptAttr = sourceAcceptExtensions.join(",");

interface StagedSourceFile {
  id: string;
  file: File;
}

const documentTypeFilterOptions: { value: DocumentType; label: string }[] = [
  { value: "regulation", label: "Регламент" },
  { value: "protocol", label: "Протокол" },
  { value: "checklist", label: "Шаблон" },
  { value: "memo", label: "Инструкция" },
  { value: "contract", label: "Договор" },
  { value: "specification", label: "Спецификация" },
  { value: "other", label: "Прочее" }
];

const sourceStatusFilterOptions = [
  { value: "indexed", label: "Обработан" },
  { value: "text_extracted", label: "Текст извлечён" },
  { value: "uploaded", label: "Требует OCR" },
  { value: "failed", label: "Ошибка" }
];

const baseKindLabels: Record<BaseKind, string> = {
  normative: "Нормативная",
  technical: "Техническая",
  project: "Проектная",
  contract: "Договорная",
  process: "Процессная"
};

const accessLabels: Record<KnowledgeBaseAccessType, string> = {
  read: "Чтение",
  search: "Поиск",
  use_via_agent: "Использование через агента",
  manage_sources: "Управление источниками",
  reindex: "Переиндексация",
  manage_access: "Управление доступом",
  admin: "Администрирование"
};

const agentModeLabels: Record<KnowledgeBaseAgentAccessMode, string> = {
  search_only: "Только поиск",
  search_and_cite: "Поиск + цитирование",
  decision: "Поиск + принятие решений",
  auto_action: "Автоматические действия"
};

const defaultProcessing: ProcessingSettings = {
  mode: "standard",
  ocr: true,
  textExtraction: true,
  tableExtraction: true,
  preserveStructure: true,
  chunking: true,
  embeddings: true,
  qdrantIndexing: true,
  manualReview: true,
  chunkSize: 800,
  chunkOverlap: 100,
  embeddingModel: embeddingModelOptions[0].value,
  vectorStore: "Qdrant (основное)",
  qdrantCollection: "kb_default_collection"
};

export default function KnowledgeBaseCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [navError, setNavError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseKind, setBaseKind] = useState<BaseKind>("process");
  const [departmentId, setDepartmentId] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [topic, setTopic] = useState("");
  const [comment, setComment] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<DocumentType | "all">("all");
  const [sourceDepartmentFilter, setSourceDepartmentFilter] = useState("all");
  const [sourceStatusFilter, setSourceStatusFilter] = useState("all");
  const [extensionFilter, setExtensionFilter] = useState("all");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState<ProcessingSettings>(defaultProcessing);
  const [accessMode, setAccessMode] = useState<AccessMode>("departments");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [accessType, setAccessType] = useState<KnowledgeBaseAccessType>("search");
  const [includeChildren, setIncludeChildren] = useState(true);
  const [accessReason, setAccessReason] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Record<string, KnowledgeBaseAgentAccessMode>>({});
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [sourceOnlyCurrent, setSourceOnlyCurrent] = useState(true);
  const [stagedDropFiles, setStagedDropFiles] = useState<StagedSourceFile[]>([]);
  const [uploadingStagedIds, setUploadingStagedIds] = useState<string[]>([]);

  const documents = useQuery({ queryKey: ["documents"], queryFn: documentsApi.list });
  const departments = useQuery({ queryKey: ["departments"], queryFn: departmentsApi.list });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list({ limit: 1000, offset: 0 }),
    enabled: Boolean(currentUser?.is_superuser)
  });
  const agents = useQuery({ queryKey: ["agents", "available"], queryFn: agentsApi.available });

  useEffect(() => {
    if (!currentUser || responsibleUserId) return;
    setResponsibleUserId(currentUser.id);
  }, [currentUser, responsibleUserId]);

  const activeDepartments = useMemo(() => filterActiveDepartments(departments.data ?? []), [departments.data]);
  const activeStep = steps[stepIndex];
  const activeSidebarIndex = getSidebarActiveIndex(stepIndex);
  const selectedDocuments = useMemo(
    () => (documents.data ?? []).filter((document) => selectedSourceIds.includes(document.id)),
    [documents.data, selectedSourceIds]
  );
  const readiness = useMemo(() => selectedDocuments.map((document) => checkDocumentReadiness(document)), [selectedDocuments]);
  const warnings = readiness.filter((item) => item.level !== "ok");
  const filteredDocuments = useMemo(
    () =>
      (documents.data ?? []).filter((document) => {
        const extension = getExtension(document.original_filename);
        const matchesSearch = `${document.title} ${document.original_filename ?? ""}`.toLowerCase().includes(sourceSearch.toLowerCase());
        const matchesType = sourceTypeFilter === "all" || document.document_type === sourceTypeFilter;
        const matchesDepartment = sourceDepartmentFilter === "all" || document.department_id === sourceDepartmentFilter;
        const matchesStatus = sourceStatusFilter === "all" || document.processing_status === sourceStatusFilter;
        const matchesExtension = extensionFilter === "all" || extension === extensionFilter;
        const matchesCurrent =
          !sourceOnlyCurrent || document.processing_status === "indexed" || document.processing_status === "text_extracted";
        return matchesSearch && matchesType && matchesDepartment && matchesStatus && matchesExtension && matchesCurrent;
      }),
    [documents.data, extensionFilter, sourceDepartmentFilter, sourceOnlyCurrent, sourceSearch, sourceStatusFilter, sourceTypeFilter]
  );

  const uploadDocument = useMutation({
    mutationFn: () => documentsApi.upload(uploadFile!, { title: uploadTitle || uploadFile?.name || undefined, document_type: "other" }),
    onSuccess: async (document) => {
      setSelectedSourceIds((ids) => [...new Set([...ids, document.id])]);
      setUploadFile(null);
      setUploadTitle("");
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  });

  const stageDropFiles = useCallback((files: FileList | File[]) => {
    const incoming = [...files].filter(isAcceptedSourceFile);
    if (!incoming.length) return;
    setStagedDropFiles((current) => {
      const next = [...current];
      for (const file of incoming) {
        const duplicate = next.some((item) => item.file.name === file.name && item.file.size === file.size);
        if (!duplicate) next.push({ id: crypto.randomUUID(), file });
      }
      return next;
    });
  }, []);

  const removeStagedFile = useCallback((id: string) => {
    setStagedDropFiles((current) => current.filter((item) => item.id !== id));
  }, []);

  const uploadStagedFile = useCallback(
    async (id: string) => {
      const staged = stagedDropFiles.find((item) => item.id === id);
      if (!staged || uploadingStagedIds.includes(id)) return;
      setUploadingStagedIds((ids) => [...ids, id]);
      try {
        const title = staged.file.name.replace(/\.[^.]+$/, "") || staged.file.name;
        const document = await documentsApi.upload(staged.file, { title, document_type: "other" });
        setSelectedSourceIds((ids) => [...new Set([...ids, document.id])]);
        setStagedDropFiles((current) => current.filter((item) => item.id !== id));
        await queryClient.invalidateQueries({ queryKey: ["documents"] });
      } finally {
        setUploadingStagedIds((ids) => ids.filter((item) => item !== id));
      }
    },
    [queryClient, stagedDropFiles, uploadingStagedIds]
  );

  const uploadAllStagedFiles = useCallback(async () => {
    for (const staged of stagedDropFiles) {
      if (!uploadingStagedIds.includes(staged.id)) await uploadStagedFile(staged.id);
    }
  }, [stagedDropFiles, uploadStagedFile, uploadingStagedIds]);

  const createKnowledgeBase = useMutation({
    mutationFn: async ({ startIndexing }: { startIndexing: boolean }) => {
      const created = await knowledgeBasesApi.create(buildCreatePayload());
      const agentPayload = Object.entries(selectedAgents).map(([agentId, accessMode]) => ({
        agent_id: agentId,
        access_mode: accessMode,
        is_enabled: true
      }));
      if (agentPayload.length) await knowledgeBasesApi.updateAgents(created.id, agentPayload);
      if (startIndexing) await knowledgeBasesApi.index(created.id, { job_type: "full" });
      return created;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      navigate(`/knowledge-base?kb=${created.id}`);
    }
  });

  const canCreateDraft = validateStep("main");
  const canCreateFull = validateCreate();

  function buildCreatePayload(): KnowledgeBaseCreate {
    const trimmedTopic = topic.trim();
    return {
      name: name.trim(),
      description: description.trim() || null,
      department_id: optionalUuid(departmentId),
      responsible_user_id: optionalUuid(responsibleUserId),
      topic: trimmedTopic || null,
      process_slug: trimmedTopic ? trimmedTopic.toLowerCase().replace(/\s+/g, "-") : null,
      access_grants: buildAccessGrants(),
      source_document_ids: selectedSourceIds,
      embedding_model: getEmbeddingModelApiValue(processing.embeddingModel),
      metadata: {
        base_kind: baseKind,
        comment,
        processing_settings: processing,
        qdrant_collection: processing.qdrantCollection.trim() || null,
        readiness_warnings: warnings.map((warning) => warning.message)
      }
    };
  }

  function buildAccessGrants() {
    if (accessMode === "admins") {
      return [{ grantee_type: "admin_only" as const, grantee_id: null, access_type: "admin" as const, reason: accessReason || "Только администраторы" }];
    }
    const grants = [];
    if (accessMode === "users" || accessMode === "mixed") {
      grants.push(
        ...selectedUserIds.map((userId) => ({
          grantee_type: "user" as const,
          grantee_id: userId,
          access_type: accessType,
          reason: accessReason || "Доступ к базе знаний"
        }))
      );
    }
    if (accessMode === "departments" || accessMode === "mixed") {
      grants.push(
        ...selectedDepartmentIds.map((deptId) => ({
          grantee_type: "department" as const,
          grantee_id: deptId,
          access_type: accessType,
          include_child_departments: includeChildren,
          reason: accessReason || "Доступ подразделения к базе знаний"
        }))
      );
    }
    if (accessMode === "agents") {
      grants.push({ grantee_type: "admin_only" as const, grantee_id: null, access_type: "admin" as const, reason: "База доступна только выбранным агентам с учетом прав пользователя" });
    }
    return grants.length ? grants : [{ grantee_type: "admin_only" as const, grantee_id: null, access_type: "admin" as const, reason: "Черновик без расширенного доступа" }];
  }

  function getStepValidationMessage(step: StepId) {
    if (step === "main") {
      if (!name.trim()) return "Укажите название базы знаний.";
      if (!description.trim()) return "Заполните описание базы знаний.";
      if (!departmentId) return "Выберите подразделение-владелец.";
      if (!responsibleUserId) return "Выберите ответственного.";
      return null;
    }
    if (step === "sources") return selectedSourceIds.length > 0 ? null : "Выберите хотя бы один документ-источник.";
    if (step === "access") {
      if (accessMode === "users" && selectedUserIds.length === 0) return "Выберите пользователей с доступом к базе.";
      if (accessMode === "departments" && selectedDepartmentIds.length === 0) return "Выберите подразделения с доступом к базе.";
      if (accessMode === "mixed" && selectedDepartmentIds.length === 0 && selectedUserIds.length === 0) {
        return "Выберите пользователей или подразделения с доступом к базе.";
      }
      if (accessMode === "agents" && Object.keys(selectedAgents).length === 0) return "Подключите хотя бы одного ИИ-агента.";
    }
    return null;
  }

  function validateStep(step: StepId) {
    return getStepValidationMessage(step) === null;
  }

  function validateCreate() {
    return validateStep("main") && validateStep("sources") && validateStep("access");
  }

  function goNext() {
    const message = getStepValidationMessage(activeStep.id);
    if (message) {
      setNavError(message);
      return;
    }
    setNavError(null);
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  function goBack() {
    setNavError(null);
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  const backStepLabel = stepIndex > 0 ? steps[stepIndex - 1].navLabel : null;
  const nextStepLabel = stepIndex < steps.length - 1 ? steps[stepIndex + 1].navLabel : null;

  return (
    <div className={`${styles.page} ${activeStep.id === "sources" ? styles.pageSourcesWide : ""}`}>
      <header className={styles.header}>
        <Link to="/knowledge-base" className={styles.backLink}>
          <ChevronLeft size={16} />
          Назад к списку баз знаний
        </Link>
        <div className={styles.headerRow}>
          <div>
            <h1>Создание базы знаний</h1>
            <p>Пошагово настройте источники, обработку данных, права доступа и подключение агентов.</p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => createKnowledgeBase.mutate({ startIndexing: false })} disabled={!canCreateDraft || createKnowledgeBase.isPending}>
              Сохранить как черновик
            </button>
          </div>
        </div>
      </header>

      <main className={styles.layout}>
        <aside className={styles.stepsCard} aria-label="Этапы создания базы знаний">
          <div className={styles.stepsList} role="list">
            {sidebarSteps.map((step, index) => (
              <div
                key={step.label}
                role="listitem"
                aria-current={index === activeSidebarIndex ? "step" : undefined}
                className={`${styles.stepItem} ${index === activeSidebarIndex ? styles.stepItemActive : ""}`}
              >
                <span className={styles.stepCircle}>{index + 1}</span>
                <span className={styles.stepCopy}>
                  <strong className={styles.stepItemTitle}>{step.label}</strong>
                  <small className={styles.stepHint}>{step.hint}</small>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section className={`${styles.contentCard} ${activeStep.id === "sources" ? styles.contentCardSources : ""}`}>
          {activeStep.id === "main" && (
            <StepMain
              name={name}
              description={description}
              baseKind={baseKind}
              departmentId={departmentId}
              responsibleUserId={responsibleUserId}
              topic={topic}
              comment={comment}
              departments={activeDepartments}
              users={usersQuery.data ?? []}
              currentUserId={currentUser?.id}
              onName={setName}
              onDescription={setDescription}
              onBaseKind={setBaseKind}
              onDepartment={setDepartmentId}
              onResponsible={setResponsibleUserId}
              onTopic={setTopic}
              onComment={setComment}
            />
          )}
          {activeStep.id === "sources" && (
            <StepSources
              documents={filteredDocuments}
              selectedSourceIds={selectedSourceIds}
              sourceSearch={sourceSearch}
              sourceTypeFilter={sourceTypeFilter}
              sourceDepartmentFilter={sourceDepartmentFilter}
              sourceStatusFilter={sourceStatusFilter}
              showOnlyCurrent={sourceOnlyCurrent}
              departments={activeDepartments}
              readiness={readiness}
              uploadFile={uploadFile}
              uploadTitle={uploadTitle}
              uploadPending={uploadDocument.isPending}
              onSearch={setSourceSearch}
              onTypeFilter={setSourceTypeFilter}
              onDepartmentFilter={setSourceDepartmentFilter}
              onStatusFilter={setSourceStatusFilter}
              onShowOnlyCurrent={setSourceOnlyCurrent}
              onToggleSource={(id) =>
                setSelectedSourceIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))
              }
              onUploadFile={setUploadFile}
              onUploadTitle={setUploadTitle}
              onUpload={() => uploadFile && uploadDocument.mutate()}
              stagedFiles={stagedDropFiles}
              uploadingStagedIds={uploadingStagedIds}
              onStageFiles={stageDropFiles}
              onRemoveStaged={removeStagedFile}
              onUploadStaged={uploadStagedFile}
              onUploadAllStaged={uploadAllStagedFiles}
            />
          )}
          {activeStep.id === "readiness" && <StepReadiness checks={readiness} />}
          {activeStep.id === "processing" && <StepProcessing settings={processing} onChange={setProcessing} />}
          {activeStep.id === "access" && (
            <StepAccess
              accessMode={accessMode}
              accessType={accessType}
              includeChildren={includeChildren}
              accessReason={accessReason}
              users={usersQuery.data ?? []}
              departments={activeDepartments}
              selectedUserIds={selectedUserIds}
              selectedDepartmentIds={selectedDepartmentIds}
              selectedDocuments={selectedDocuments}
              onMode={setAccessMode}
              onAccessType={setAccessType}
              onIncludeChildren={setIncludeChildren}
              onReason={setAccessReason}
              onToggleUser={(id) => setSelectedUserIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))}
              onToggleDepartment={(id) => setSelectedDepartmentIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))}
              onSelectDepartments={(ids) => setSelectedDepartmentIds((current) => [...new Set([...current, ...ids])])}
              onDeselectDepartments={(ids) => setSelectedDepartmentIds((current) => current.filter((id) => !ids.includes(id)))}
            />
          )}
          {activeStep.id === "agents" && (
            <StepAgents agents={agents.data ?? []} selectedAgents={selectedAgents} onChange={setSelectedAgents} />
          )}
          {activeStep.id === "preview" && (
            <StepPreview
              name={name}
              description={description}
              baseKind={baseKind}
              department={activeDepartments.find((item) => item.id === departmentId)}
              responsible={usersQuery.data?.find((item) => item.id === responsibleUserId)}
              users={usersQuery.data ?? []}
              topic={topic}
              selectedDocuments={selectedDocuments}
              processing={processing}
              accessMode={accessMode}
              selectedUserIds={selectedUserIds}
              selectedDepartmentIds={selectedDepartmentIds}
              selectedAgents={selectedAgents}
              warnings={warnings}
            />
          )}
        </section>

        <aside className={styles.summaryCard}>
          <Summary
            stepIndex={stepIndex}
            name={name}
            baseKind={baseKind}
            department={activeDepartments.find((item) => item.id === departmentId)}
            responsible={usersQuery.data?.find((item) => item.id === responsibleUserId)}
            topic={topic}
            selectedDocuments={selectedDocuments}
            stagedDropCount={stagedDropFiles.length}
            readiness={readiness}
            users={usersQuery.data ?? []}
            processing={processing}
            accessMode={accessMode}
            selectedAgents={selectedAgents}
            warningsCount={warnings.length}
            onNavigateToStep={(index) => {
              setNavError(null);
              setStepIndex(index);
            }}
          />
        </aside>
      </main>

      {createKnowledgeBase.isError && (
        <div className={styles.createError}>{formatApiError(createKnowledgeBase.error)}</div>
      )}

      {navError && <div className={styles.navError}>{navError}</div>}

      <footer className={styles.footerNav}>
        <div className={styles.footerNavSide}>
          {backStepLabel ? (
            <button type="button" className={styles.navBackButton} onClick={goBack}>
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              Назад: {backStepLabel}
            </button>
          ) : null}
        </div>

        <ProgressDots activeIndex={activeSidebarIndex} />

        <div className={`${styles.footerNavSide} ${styles.footerNavSideRight}`}>
          {stepIndex < steps.length - 1 ? (
            <button type="button" className={styles.navNextButton} onClick={goNext}>
              Далее: {nextStepLabel}
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : (
            <div className={styles.footerFinalActions}>
              <button type="button" className={styles.navBackButton} onClick={() => navigate("/knowledge-base")}>
                Отмена
              </button>
              <button type="button" className={styles.navBackButton} onClick={() => createKnowledgeBase.mutate({ startIndexing: false })} disabled={!canCreateDraft || createKnowledgeBase.isPending}>
                Сохранить как черновик
              </button>
              <button type="button" className={styles.navNextButton} onClick={() => createKnowledgeBase.mutate({ startIndexing: true })} disabled={!canCreateFull || createKnowledgeBase.isPending}>
                Создать и запустить индексацию
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function StepMain(props: {
  name: string;
  description: string;
  baseKind: BaseKind;
  departmentId: string;
  responsibleUserId: string;
  topic: string;
  comment: string;
  departments: Department[];
  users: User[];
  currentUserId?: string;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
  onBaseKind: (value: BaseKind) => void;
  onDepartment: (value: string) => void;
  onResponsible: (value: string) => void;
  onTopic: (value: string) => void;
  onComment: (value: string) => void;
}) {
  return (
    <div className={styles.stepBody}>
      <StepTitle
        icon={FilePlus2}
        title="Основные сведения"
        text="Заполните ключевые параметры базы знаний. Статус по умолчанию — «Черновик»."
      />
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Название базы знаний <span className={styles.required}>*</span>
          </span>
          <input
            className={styles.control}
            value={props.name}
            onChange={(event) => props.onName(event.target.value)}
            placeholder="Совещания и протоколы"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Тип базы знаний <span className={styles.required}>*</span>
          </span>
          <FormSelect
            value={props.baseKind}
            onChange={(value) => props.onBaseKind(value as BaseKind)}
            options={Object.entries(baseKindLabels).map(([value, label]) => ({ value, label }))}
            ariaLabel="Тип базы знаний"
          />
        </label>
        <label className={`${styles.field} ${styles.wideField}`}>
          <span className={styles.fieldLabel}>
            Описание <span className={styles.required}>*</span>
          </span>
          <textarea
            className={`${styles.control} ${styles.textarea}`}
            value={props.description}
            onChange={(event) => props.onDescription(event.target.value)}
            placeholder="Для чего нужна база и какие вопросы она закрывает"
          />
        </label>
        <label className={`${styles.field} ${styles.wideField}`}>
          <span className={styles.fieldLabel}>Тематика / процесс</span>
          <div className={styles.selectField}>
            <input
              className={styles.control}
              value={props.topic}
              onChange={(event) => props.onTopic(event.target.value)}
              placeholder="Совещания"
            />
            {props.topic ? (
              <button
                className={styles.clearButton}
                type="button"
                aria-label="Очистить тематику"
                onClick={() => props.onTopic("")}
              >
                <X size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            ) : null}
            <ChevronDown className={styles.selectChevron} size={16} strokeWidth={2} aria-hidden="true" />
          </div>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Подразделение-владелец <span className={styles.required}>*</span>
          </span>
          <DepartmentSelect
            value={props.departmentId}
            onChange={props.onDepartment}
            departments={props.departments}
            placeholder="Выберите подразделение"
            allowEmpty={false}
            ariaLabel="Подразделение-владелец"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Ответственный <span className={styles.required}>*</span>
          </span>
          <FormAutocomplete
            value={props.responsibleUserId}
            onChange={props.onResponsible}
            options={props.users.map((user) => ({
              value: user.id,
              label: getUserPickerLabel(user, props.currentUserId)
            }))}
            placeholder="Выберите пользователя"
            emptyValue=""
            emptyLabel="Выберите пользователя"
            ariaLabel="Ответственный"
          />
        </label>
        <div className={`${styles.field} ${styles.wideField}`}>
          <span className={styles.fieldLabel}>Статус</span>
          <span className={styles.statusBadge}>Черновик</span>
        </div>
        <label className={`${styles.field} ${styles.wideField}`}>
          <span className={styles.fieldLabel}>Комментарий</span>
          <textarea
            className={`${styles.control} ${styles.textarea} ${styles.textareaShort}`}
            value={props.comment}
            onChange={(event) => props.onComment(event.target.value)}
            placeholder="Дополнительная информация"
          />
        </label>
      </div>
      <InfoCallout text="После создания базы знаний вы сможете добавить документы, настроить обработку, доступ и подключить ИИ-агентов." />
    </div>
  );
}

function StepSources(props: {
  documents: Document[];
  selectedSourceIds: string[];
  sourceSearch: string;
  sourceTypeFilter: DocumentType | "all";
  sourceDepartmentFilter: string;
  sourceStatusFilter: string;
  showOnlyCurrent: boolean;
  departments: Department[];
  readiness: ReturnType<typeof checkDocumentReadiness>[];
  uploadFile: File | null;
  uploadTitle: string;
  uploadPending: boolean;
  stagedFiles: StagedSourceFile[];
  uploadingStagedIds: string[];
  onSearch: (value: string) => void;
  onTypeFilter: (value: DocumentType | "all") => void;
  onDepartmentFilter: (value: string) => void;
  onStatusFilter: (value: string) => void;
  onShowOnlyCurrent: (value: boolean) => void;
  onToggleSource: (id: string) => void;
  onUploadFile: (file: File | null) => void;
  onUploadTitle: (value: string) => void;
  onUpload: () => void;
  onStageFiles: (files: FileList | File[]) => void;
  onRemoveStaged: (id: string) => void;
  onUploadStaged: (id: string) => void;
  onUploadAllStaged: () => void;
}) {
  const readyCount = props.readiness.filter((item) => item.level === "ok").length;
  const ocrCount = props.readiness.filter((item) => item.level === "warning").length;
  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    if (event.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      if (event.dataTransfer.files.length) props.onStageFiles(event.dataTransfer.files);
    },
    [props.onStageFiles]
  );

  return (
    <div className={styles.stepBody}>
      <header className={`${styles.stepTitle} ${styles.sourcesStepIntro}`}>
        <span><FileText size={20} /></span>
        <div>
          <h2>Выбор источников</h2>
          <p>Выберите документы и файлы, которые будут использованы для формирования базы знаний.</p>
        </div>
      </header>

      <SourceFilterBar
        search={props.sourceSearch}
        onSearch={props.onSearch}
        typeFilter={props.sourceTypeFilter}
        onTypeFilter={(value) => props.onTypeFilter(value as DocumentType | "all")}
        typeOptions={documentTypeFilterOptions}
        departmentFilter={props.sourceDepartmentFilter}
        onDepartmentFilter={props.onDepartmentFilter}
        departments={props.departments}
        statusFilter={props.sourceStatusFilter}
        onStatusFilter={props.onStatusFilter}
        statusOptions={sourceStatusFilterOptions}
        showOnlyCurrent={props.showOnlyCurrent}
        onShowOnlyCurrent={props.onShowOnlyCurrent}
        selectedCount={props.selectedSourceIds.length}
      />

      <div
        className={`${styles.sourcesTableWrap} ${isDragOver ? styles.sourcesTableWrapDragOver : ""}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragOver ? (
          <div className={styles.sourcesDropOverlay} aria-hidden="true">
            <span className={styles.sourcesDropOverlayIcon}><Upload size={28} strokeWidth={2} /></span>
            <strong>Отпустите файлы для добавления</strong>
            <span>PDF, DOCX, XLSX, PPTX, TXT</span>
          </div>
        ) : null}
        <table className={styles.sourcesTable}>
          <colgroup>
            <col className={styles.sourcesColCheck} />
            <col className={styles.sourcesColDoc} />
            <col className={styles.sourcesColType} />
            <col className={styles.sourcesColVersion} />
            <col className={styles.sourcesColStatus} />
            <col className={styles.sourcesColDept} />
            <col className={styles.sourcesColDate} />
            <col className={styles.sourcesColSize} />
            <col className={styles.sourcesColAccess} />
            <col className={styles.sourcesColAction} />
          </colgroup>
          <thead>
            <tr>
              <th className={styles.sourcesCheckHead} aria-label="Выбор" />
              <th>Документ</th>
              <th>Тип</th>
              <th>Версия</th>
              <th>Статус</th>
              <th>Подразделение</th>
              <th>Дата</th>
              <th>Размер</th>
              <th>Доступ</th>
              <th className={styles.sourcesActionHead} aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {props.documents.map((document) => {
              const selected = props.selectedSourceIds.includes(document.id);
              const extension = getExtension(document.original_filename);
              const extKey = extension.replace(".", "") || "default";
              const tableStatus = documentTableStatus(document);
              return (
                <tr key={document.id} className={selected ? styles.sourcesTableRowSelected : undefined}>
                  <td className={styles.sourcesCheckCell}>
                    <input type="checkbox" checked={selected} onChange={() => props.onToggleSource(document.id)} aria-label={`Выбрать ${document.title}`} />
                  </td>
                  <td className={styles.sourcesDocColumn}>
                    <div className={styles.sourcesDocCell}>
                      <span className={`${styles.sourcesDocIcon} ${styles[`sourcesDocIcon_${extKey}`] ?? styles.sourcesDocIcon_default}`}>
                        {(extKey || "file").slice(0, 4)}
                      </span>
                      <div className={styles.sourcesDocCopy}>
                        <strong>{document.title}</strong>
                        <small>{documentMetaLine(document)}</small>
                      </div>
                    </div>
                  </td>
                  <td className={styles.sourcesTypeCell}>{documentTypeLabel(document.document_type)}</td>
                  <td className={styles.sourcesVersionCell}>{document.version || 1}</td>
                  <td>
                    <span className={`${styles.docStatusBadge} ${styles[`docStatus_${tableStatus.tone}`]}`}>{tableStatus.label}</span>
                  </td>
                  <td className={styles.sourcesDeptCell}>{departmentName(props.departments, document.department_id)}</td>
                  <td className={styles.sourcesDateCell}>{formatDocumentDate(document.created_at)}</td>
                  <td className={styles.sourcesSizeCell}>{formatBytes(document.file_size)}</td>
                  <td className={styles.sourcesAccessCell}>{documentAccessLabel(document)}</td>
                  <td className={styles.sourcesActionCell}>
                    <button type="button" className={styles.sourcesRowAction} aria-label="Действия с документом">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!props.documents.length && (
              <tr>
                <td colSpan={10} className={styles.emptyCell}>Документы не найдены. Измените фильтры или перетащите файлы в таблицу.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.sourcesUploadCard}>
        <div className={styles.sourcesUploadLead}>
          <span className={styles.sourcesUploadIcon}><CloudUpload size={20} /></span>
          <div>
            <strong>Загрузить новый документ</strong>
            <p>Документ будет загружен, обработан и добавлен в список источников.</p>
          </div>
        </div>
        <input
          className={styles.control}
          value={props.uploadTitle}
          onChange={(event) => props.onUploadTitle(event.target.value)}
          placeholder="Название документа"
        />
        <label className={styles.sourcesFileButton}>
          Выбрать файл
          <input type="file" accept={sourceAcceptAttr} onChange={(event) => props.onUploadFile(event.target.files?.[0] ?? null)} />
        </label>
        <button type="button" className={styles.navNextButton} onClick={props.onUpload} disabled={!props.uploadFile || props.uploadPending}>
          {props.uploadPending ? "Загружаем..." : "Загрузить и добавить"}
        </button>
      </div>
      {props.uploadFile ? <p className={styles.sourcesFileName}>Выбран файл: {props.uploadFile.name}</p> : null}

      {props.stagedFiles.length > 0 ? (
        <section className={styles.sourcesStagedSection} aria-label="Файлы для загрузки">
          <div className={styles.sourcesStagedHeader}>
            <h3>Добавленные файлы ({props.stagedFiles.length})</h3>
            <button
              type="button"
              className={styles.linkButton}
              onClick={props.onUploadAllStaged}
              disabled={props.stagedFiles.every((item) => props.uploadingStagedIds.includes(item.id))}
            >
              Загрузить все
            </button>
          </div>
          <div className={styles.sourcesStagedList}>
            {props.stagedFiles.map((staged) => {
              const extKey = getExtension(staged.file.name).replace(".", "") || "default";
              const uploading = props.uploadingStagedIds.includes(staged.id);
              return (
                <article key={staged.id} className={styles.sourcesStagedCard}>
                  <span className={`${styles.sourcesDocIcon} ${styles[`sourcesDocIcon_${extKey}`] ?? styles.sourcesDocIcon_default}`}>
                    {(extKey || "file").slice(0, 4)}
                  </span>
                  <div className={styles.sourcesStagedCopy}>
                    <strong title={staged.file.name}>{shortFileName(staged.file.name)}</strong>
                    <small>{formatBytes(staged.file.size)}</small>
                  </div>
                  <button
                    type="button"
                    className={styles.sourcesStagedUpload}
                    onClick={() => props.onUploadStaged(staged.id)}
                    disabled={uploading}
                    aria-label={`Загрузить ${staged.file.name}`}
                  >
                    {uploading ? "…" : "Загрузить"}
                  </button>
                  <button
                    type="button"
                    className={styles.sourcesStagedRemove}
                    onClick={() => props.onRemoveStaged(staged.id)}
                    disabled={uploading}
                    aria-label={`Удалить ${staged.file.name}`}
                  >
                    <X size={14} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {props.selectedSourceIds.length > 0 ? (
        <InfoCallout
          className={styles.sourcesCheckCallout}
          text={`Проверка источников: ${readyCount} ${pluralDocs(readyCount)} ${readyCount === 1 ? "готов" : "готовы"} к индексации${ocrCount ? `, ${ocrCount} ${pluralDocs(ocrCount)} ${ocrCount === 1 ? "требует" : "требуют"} OCR` : ""}.`}
        />
      ) : null}
    </div>
  );
}

function StepReadiness({ checks }: { checks: ReturnType<typeof checkDocumentReadiness>[] }) {
  return (
    <div className={styles.stepBody}>
      <StepTitle icon={AlertTriangle} title="Проверка готовности документов" text="Система проверяет существование, статус, расширение, обработку, актуальность и версии источников." />
      <div className={styles.checkList}>
        {checks.map((check) => (
          <article key={check.document.id} className={styles[`check_${check.level}`]}>
            {check.level === "ok" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <div>
              <strong>{check.document.title}</strong>
              <p>{check.message}</p>
            </div>
          </article>
        ))}
        {!checks.length && <div className={styles.emptyCell}>Сначала выберите источники.</div>}
      </div>
    </div>
  );
}

function StepProcessing({ settings, onChange }: { settings: ProcessingSettings; onChange: (value: ProcessingSettings) => void }) {
  const [advancedExpanded, setAdvancedExpanded] = useState(true);

  function updateStage(key: ProcessingToggleKey, value: boolean) {
    onChange({ ...settings, [key]: value });
  }

  function updateNumberField(key: "chunkSize" | "chunkOverlap", rawValue: string, clamp: (value: number) => number) {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return;
    onChange({ ...settings, [key]: clamp(parsed) });
  }

  function updateCollection(value: string) {
    onChange({ ...settings, qdrantCollection: value.replace(/[^a-zA-Z0-9_]/g, "") });
  }

  return (
    <div className={styles.stepBody}>
      <StepTitle
        icon={Cog}
        title="Обработка и индексация"
        text="Настройте этапы обработки документов и параметры индексации для поискового контура."
      />

      <div className={styles.processingModeCards}>
        {(
          [
            ["standard", "Стандартный режим", "Рекомендуемые настройки для большинства баз знаний."],
            ["advanced", "Расширенный режим", "Полный контроль над параметрами обработки и индексации."]
          ] as const
        ).map(([mode, title, description]) => {
          const selected = settings.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              className={`${styles.processingModeCard} ${selected ? styles.processingModeCardSelected : ""}`}
              aria-pressed={selected}
              onClick={() => onChange({ ...settings, mode })}
            >
              <span className={`${styles.processingModeRadio} ${selected ? styles.processingModeRadioSelected : ""}`} aria-hidden="true" />
              <span className={styles.processingModeCopy}>
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section className={styles.processingStagesSection}>
        <h3 className={styles.processingStagesTitle}>Этапы обработки</h3>
        <div className={styles.processingStagesList}>
          {processingStageDefinitions.map((stage) => {
            const Icon = stage.icon;
            const checked = Boolean(settings[stage.key]);
            return (
              <article key={stage.key} className={styles.processingStageRow}>
                <span className={styles.processingStageIcon}>
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                </span>
                <div className={styles.processingStageCopy}>
                  <strong>{stage.title}</strong>
                  <p>{stage.description}</p>
                </div>
                <div className={styles.processingStageControl}>
                  {stage.alwaysOn ? (
                    <span className={styles.processingAlwaysBadge}>
                      <Lock size={13} strokeWidth={2.2} aria-hidden="true" />
                      Всегда включено
                    </span>
                  ) : (
                    <Switch checked={checked} onChange={(value) => updateStage(stage.key, value)} />
                  )}
                </div>
                <InfoTooltip text={stage.tooltip} placement="left" triggerClassName={styles.processingStageInfo} />
              </article>
            );
          })}
        </div>
      </section>

      {settings.mode === "advanced" ? (
        <section className={styles.processingAdvancedPanel}>
          <button
            type="button"
            className={styles.processingAdvancedHead}
            aria-expanded={advancedExpanded}
            onClick={() => setAdvancedExpanded((current) => !current)}
          >
            <strong>Дополнительные параметры (расширенные)</strong>
            <ChevronDown className={`${styles.processingAdvancedChevron} ${advancedExpanded ? styles.processingAdvancedChevronOpen : ""}`} size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          {advancedExpanded ? (
            <div className={styles.processingAdvancedBody}>
              <div className={styles.processingAdvancedGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    <span className={styles.fieldLabelText}>Размер chunk (токенов)</span>
                    <InfoTooltip text={processingAdvancedParamHints.chunkSize} placement="top" size={14} inline />
                  </span>
                  <input
                    type="number"
                    className={styles.control}
                    min={500}
                    max={1500}
                    step={1}
                    value={settings.chunkSize}
                    onChange={(event) => updateNumberField("chunkSize", event.target.value, clampChunkSize)}
                    onBlur={(event) => updateNumberField("chunkSize", event.target.value, clampChunkSize)}
                  />
                  <span className={styles.fieldHint}>Рекомендуется: 500-1200</span>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    <span className={styles.fieldLabelText}>Перекрытие chunk (токенов)</span>
                    <InfoTooltip text={processingAdvancedParamHints.chunkOverlap} placement="top" size={14} inline />
                  </span>
                  <input
                    type="number"
                    className={styles.control}
                    min={50}
                    max={200}
                    step={1}
                    value={settings.chunkOverlap}
                    onChange={(event) => updateNumberField("chunkOverlap", event.target.value, clampChunkOverlap)}
                    onBlur={(event) => updateNumberField("chunkOverlap", event.target.value, clampChunkOverlap)}
                  />
                  <span className={styles.fieldHint}>Рекомендуется: 50-200</span>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    <span className={styles.fieldLabelText}>Модель embeddings</span>
                    <InfoTooltip text={processingAdvancedParamHints.embeddingModel} placement="top" size={14} inline />
                  </span>
                  <FormSelect
                    value={settings.embeddingModel}
                    onChange={(value) => onChange({ ...settings, embeddingModel: value })}
                    options={embeddingModelOptions.map((option) => ({ value: option.value, label: option.label }))}
                    ariaLabel="Модель embeddings"
                  />
                  <span className={styles.fieldHint}>Размер вектора: 1024</span>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    <span className={styles.fieldLabelText}>Векторное хранилище</span>
                    <InfoTooltip text={processingAdvancedParamHints.vectorStore} placement="top" size={14} inline />
                  </span>
                  <input className={`${styles.control} ${styles.controlReadonly}`} value={settings.vectorStore} readOnly tabIndex={-1} aria-readonly="true" />
                  <span className={styles.fieldHint}>Выберите хранилище для индексации</span>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    <span className={styles.fieldLabelText}>Коллекция Qdrant</span>
                    <InfoTooltip text={processingAdvancedParamHints.qdrantCollection} placement="top" size={14} inline />
                  </span>
                  <input
                    className={styles.control}
                    value={settings.qdrantCollection}
                    onChange={(event) => updateCollection(event.target.value)}
                    placeholder="kb_default_collection"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <span className={styles.fieldHint}>Будет создана автоматически, если не существует</span>
                </label>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <InfoCallout
        className={styles.processingInfoCallout}
        text="Большинство параметров оптимальны для типовых документов. Изменяйте их только при необходимости."
      />
    </div>
  );
}

function StepAccess(props: {
  accessMode: AccessMode;
  accessType: KnowledgeBaseAccessType;
  includeChildren: boolean;
  accessReason: string;
  users: User[];
  departments: Department[];
  selectedUserIds: string[];
  selectedDepartmentIds: string[];
  selectedDocuments: Document[];
  onMode: (value: AccessMode) => void;
  onAccessType: (value: KnowledgeBaseAccessType) => void;
  onIncludeChildren: (value: boolean) => void;
  onReason: (value: string) => void;
  onToggleUser: (id: string) => void;
  onToggleDepartment: (id: string) => void;
  onSelectDepartments: (ids: string[]) => void;
  onDeselectDepartments: (ids: string[]) => void;
}) {
  return (
    <div className={styles.stepBody}>
      <StepTitle icon={LockKeyhole} title="Настройка доступа" text="Обязательный шаг. По умолчанию база создаётся с ограниченным доступом, а не общедоступной." />
      <div className={styles.accessModes}>
        {[
          ["users", "Доступ по пользователям"],
          ["departments", "Доступ по подразделениям"],
          ["mixed", "Смешанный доступ"],
          ["admins", "Только администраторы"],
          ["agents", "Только выбранные агенты"]
        ].map(([value, label]) => (
          <button key={value} type="button" className={props.accessMode === value ? styles.selectedMode : undefined} onClick={() => props.onMode(value as AccessMode)}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.formGrid}>
        <label>
          Тип доступа
          <select value={props.accessType} onChange={(event) => props.onAccessType(event.target.value as KnowledgeBaseAccessType)} disabled={props.accessMode === "admins"}>
            {Object.entries(accessLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Основание доступа
          <input value={props.accessReason} onChange={(event) => props.onReason(event.target.value)} placeholder="Проект, приказ, задача, распоряжение" />
        </label>
        {(props.accessMode === "departments" || props.accessMode === "mixed") && (
          <label className={styles.checkboxLine}>
            <input type="checkbox" checked={props.includeChildren} onChange={(event) => props.onIncludeChildren(event.target.checked)} />
            Распространять доступ на дочерние подразделения
          </label>
        )}
      </div>
      {(props.accessMode === "users" || props.accessMode === "mixed") && (
        <SelectableList
          title="Пользователи"
          items={props.users.map((user) => ({
            id: user.id,
            title: user.full_name || user.email,
            subtitle: `${user.email} · ${user.position || "Должность не указана"}`
          }))}
          selectedIds={props.selectedUserIds}
          onToggle={props.onToggleUser}
        />
      )}
      {(props.accessMode === "departments" || props.accessMode === "mixed") && (
        <SelectableList
          title="Подразделения"
          items={props.departments.map((department) => ({ id: department.id, title: department.name, subtitle: department.description || "Без описания" }))}
          selectedIds={props.selectedDepartmentIds}
          onToggle={props.onToggleDepartment}
          enableSearch
          searchPlaceholder="Найти подразделение"
          enableSelectAll
          onSelectAll={props.onSelectDepartments}
          onDeselectAll={props.onDeselectDepartments}
        />
      )}
      {props.selectedDocuments.length > 0 && (
        <WarningCallout text="Если пользователь имеет доступ к базе, но не имеет доступа к части документов-источников, агент и поиск будут использовать только разрешённые для него фрагменты." />
      )}
    </div>
  );
}

function StepAgents({ agents, selectedAgents, onChange }: { agents: AgentAccess[]; selectedAgents: Record<string, KnowledgeBaseAgentAccessMode>; onChange: (value: Record<string, KnowledgeBaseAgentAccessMode>) => void }) {
  return (
    <div className={styles.stepBody}>
      <StepTitle icon={Bot} title="Подключение ИИ-агентов" text="Выберите агентов из доступных вам и режим использования базы. Загрузивший источники может ограничить список агентов." />
      <div className={styles.agentGrid}>
        {agents.map((agent) => {
          const selected = selectedAgents[agent.id];
          return (
            <article key={agent.id} className={selected ? styles.selectedAgent : undefined}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(selected)}
                  onChange={(event) => {
                    const next = { ...selectedAgents };
                    if (event.target.checked) next[agent.id] = "search_only";
                    else delete next[agent.id];
                    onChange(next);
                  }}
                />
                <span>
                  <strong>{agent.name}</strong>
                  <small>{agent.purpose || agent.slug}</small>
                </span>
              </label>
              <select
                value={selected || "search_only"}
                disabled={!selected}
                onChange={(event) => onChange({ ...selectedAgents, [agent.id]: event.target.value as KnowledgeBaseAgentAccessMode })}
              >
                {Object.entries(agentModeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </article>
          );
        })}
        {!agents.length && <div className={styles.emptyCell}>Агенты пока не настроены.</div>}
      </div>
      <InfoCallout text="Ключевое правило: агент может использовать только те фрагменты базы знаний, к которым имеет доступ пользователь, запустивший агента." />
    </div>
  );
}

function StepPreview(props: {
  name: string;
  description: string;
  baseKind: BaseKind;
  department?: Department;
  responsible?: User;
  topic: string;
  selectedDocuments: Document[];
  users: User[];
  processing: ProcessingSettings;
  accessMode: AccessMode;
  selectedUserIds: string[];
  selectedDepartmentIds: string[];
  selectedAgents: Record<string, KnowledgeBaseAgentAccessMode>;
  warnings: ReturnType<typeof checkDocumentReadiness>[];
}) {
  return (
    <div className={styles.stepBody}>
      <StepTitle icon={ShieldCheck} title="Предпросмотр и подтверждение" text="Проверьте итоговую сводку перед созданием базы знаний." />
      <div className={styles.previewGrid}>
        <SummaryBlock title="Основные сведения" rows={[["Название", props.name], ["Описание", props.description], ["Тип", baseKindLabels[props.baseKind]], ["Подразделение", props.department?.name || "-"], ["Ответственный", formatShortPersonName(props.responsible?.full_name, props.responsible?.email)], ["Тематика", props.topic || "-"]]} />
        <SummaryBlock title="Источники" rows={[["Документов", String(props.selectedDocuments.length)], ...props.selectedDocuments.slice(0, 5).map((document) => [document.title, userName(props.users, document.uploaded_by_user_id)] as [string, string])]} />
        <section className={styles.summaryBlock}>
          <ProcessingChecklistCard title="Обработка" subtitle="Текущие настройки" items={buildProcessingChecklist(props.processing)} />
        </section>
        <SummaryBlock title="Доступ" rows={[["Режим", accessModeLabel(props.accessMode)], ["Пользователей", String(props.selectedUserIds.length)], ["Подразделений", String(props.selectedDepartmentIds.length)]]} />
        <SummaryBlock title="Агенты" rows={[["Подключено", String(Object.keys(props.selectedAgents).length)], ...Object.values(props.selectedAgents).slice(0, 4).map((mode, index) => [`Агент ${index + 1}`, agentModeLabels[mode]] as [string, string])]} />
        <SummaryBlock title="Предупреждения" rows={props.warnings.length ? props.warnings.map((warning) => [warning.document.title, warning.message] as [string, string]) : [["Ошибки", "Нет критичных предупреждений"]]} />
      </div>
    </div>
  );
}

function Summary(props: {
  stepIndex: number;
  name: string;
  baseKind: BaseKind;
  department?: Department;
  responsible?: User;
  topic: string;
  selectedDocuments: Document[];
  stagedDropCount: number;
  readiness: ReturnType<typeof checkDocumentReadiness>[];
  users: User[];
  processing: ProcessingSettings;
  accessMode: AccessMode;
  selectedAgents: Record<string, KnowledgeBaseAgentAccessMode>;
  warningsCount: number;
  onNavigateToStep: (stepIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sourcesConfigured = props.stepIndex >= 2 || (props.stepIndex === 1 && props.selectedDocuments.length > 0);
  const processingConfigured = props.stepIndex >= 3;
  const accessConfigured = props.stepIndex >= 4;
  const agentsConfigured = props.stepIndex >= 5;
  const previewConfigured = props.stepIndex >= 6;

  const selectedSize = useMemo(
    () => props.selectedDocuments.reduce((sum, document) => sum + (document.file_size ?? 0), 0),
    [props.selectedDocuments]
  );

  const sourcesReady = props.readiness.length > 0 && props.readiness.every((item) => item.level === "ok");

  const sections = useMemo(
    () => [
      {
        id: "main",
        title: "Основные сведения",
        stepIndex: 0,
        configured: Boolean(props.name.trim()),
        collapsedStatus: props.name.trim() ? "Черновик" : "Не заполнено",
        rows: [
          ["Название", props.name || "Не заполнено"],
          ["Тип", baseKindLabels[props.baseKind]],
          ["Тематика", props.topic || "-"],
          ["Подразделение", props.department?.name || "Не выбрано"],
          ["Ответственный", formatShortPersonName(props.responsible?.full_name, props.responsible?.email)]
        ] as [string, string][],
        statusBadge: "Черновик"
      },
      {
        id: "sources",
        title: "Источники",
        stepIndex: 1,
        configured: sourcesConfigured,
        collapsedStatus: sourcesConfigured
          ? `${props.selectedDocuments.length} документов`
          : "Не настроено",
        rows: [
          ["Выбрано документов", String(props.selectedDocuments.length)],
          ["Новых загрузок", String(props.stagedDropCount)],
          ["Всего файлов", String(props.selectedDocuments.length + props.stagedDropCount)],
          ["Общий размер", formatBytes(selectedSize)]
        ] as [string, string][],
        footerNote: sourcesConfigured && sourcesReady ? "Все документы готовы к обработке" : undefined
      },
      {
        id: "processing",
        title: "Обработка и индексация",
        stepIndex: 3,
        configured: processingConfigured,
        collapsedStatus: processingConfigured ? "Настроено" : "Не настроено",
        checklistSubtitle: "Текущие настройки",
        checklistItems: buildProcessingChecklist(props.processing)
      },
      {
        id: "access",
        title: "Доступ и агенты",
        stepIndex: 4,
        configured: accessConfigured,
        collapsedStatus: accessConfigured ? accessModeLabel(props.accessMode) : "Не настроено",
        rows: [
          ["Тип доступа", accessModeLabel(props.accessMode)],
          ["Предупреждения", String(props.warningsCount)]
        ] as [string, string][]
      },
      {
        id: "agents",
        title: "Подключение агентов",
        stepIndex: 5,
        configured: agentsConfigured,
        collapsedStatus: agentsConfigured
          ? `${Object.keys(props.selectedAgents).length} агентов`
          : "Не настроено",
        rows: [["Подключено агентов", String(Object.keys(props.selectedAgents).length)]] as [string, string][]
      },
      {
        id: "preview",
        title: "Проверка и создание",
        stepIndex: 6,
        configured: previewConfigured,
        collapsedStatus: previewConfigured ? "Готово к проверке" : "Не выполнено",
        rows: previewConfigured ? ([["Статус", "Ожидает подтверждения"]] as [string, string][]) : undefined
      }
    ],
    [
      accessConfigured,
      agentsConfigured,
      previewConfigured,
      processingConfigured,
      props.accessMode,
      props.baseKind,
      props.department?.name,
      props.name,
      props.processing,
      props.responsible,
      props.selectedAgents,
      props.selectedDocuments.length,
      props.stagedDropCount,
      props.topic,
      props.warningsCount,
      selectedSize,
      sourcesConfigured,
      sourcesReady
    ]
  );

  useEffect(() => {
    const stepSectionIds: Partial<Record<number, string>> = {
      0: "main",
      1: "sources",
      2: "sources",
      3: "processing",
      4: "access",
      5: "agents",
      6: "preview"
    };
    const id = stepSectionIds[props.stepIndex];
    if (id) setExpanded((state) => ({ ...state, [id]: true }));
  }, [props.stepIndex]);

  function isSectionOpen(id: string, sectionStep: number) {
    if (id in expanded) return expanded[id];
    return props.stepIndex === sectionStep;
  }

  function toggleSection(id: string, sectionStep: number) {
    setExpanded((state) => {
      const currentlyOpen = id in state ? state[id] : props.stepIndex === sectionStep;
      return { ...state, [id]: !currentlyOpen };
    });
  }

  return (
    <div className={styles.summaryPanel}>
      <h2 className={styles.summaryTitle}>Сводка создаваемой базы</h2>
      <div className={styles.summarySections}>
        {sections.map((section) => (
          <SummaryAccordionSection
            key={section.id}
            title={section.title}
            collapsedStatus={section.collapsedStatus}
            configured={section.configured}
            isOpen={isSectionOpen(section.id, section.stepIndex)}
            rows={section.rows}
            checklistSubtitle={"checklistSubtitle" in section ? section.checklistSubtitle : undefined}
            checklistItems={"checklistItems" in section ? section.checklistItems : undefined}
            statusBadge={section.id === "main" && section.configured ? section.statusBadge : undefined}
            footerNote={section.footerNote}
            onToggle={() => toggleSection(section.id, section.stepIndex)}
            onEdit={() => props.onNavigateToStep(section.stepIndex)}
          />
        ))}
      </div>
      {props.warningsCount > 0 && props.stepIndex >= 2 ? (
        <WarningCallout text="База знаний будет доступна агентам только после завершения индексации и настройки прав доступа." />
      ) : null}
    </div>
  );
}

function SummaryAccordionSection({
  title,
  collapsedStatus,
  configured,
  isOpen,
  rows,
  checklistSubtitle,
  checklistItems,
  statusBadge,
  footerNote,
  onToggle,
  onEdit
}: {
  title: string;
  collapsedStatus: string;
  configured: boolean;
  isOpen: boolean;
  rows?: [string, string][];
  checklistSubtitle?: string;
  checklistItems?: string[];
  statusBadge?: string;
  footerNote?: string;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const showEdit = isOpen && configured;
  const hasChecklist = Boolean(checklistItems?.length);
  const hasRows = Boolean(rows?.length);

  return (
    <section className={`${styles.summaryAccordion} ${isOpen ? styles.summaryAccordionOpen : ""}`}>
      <div className={styles.summaryAccordionHead}>
        <button type="button" className={styles.summaryAccordionHeadMain} onClick={onToggle} aria-expanded={isOpen}>
          <span className={styles.summaryAccordionHeadCopy}>
            <strong className={styles.summaryAccordionTitle}>{title}</strong>
            {!isOpen ? <span className={styles.summaryAccordionStatus}>{collapsedStatus}</span> : null}
          </span>
        </button>
        <div className={styles.summaryAccordionAside}>
          {showEdit ? (
            <button
              type="button"
              className={styles.summaryEditLink}
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              Изменить
            </button>
          ) : null}
          <button type="button" className={styles.summaryAccordionToggle} onClick={onToggle} aria-expanded={isOpen} aria-label={isOpen ? "Свернуть блок" : "Развернуть блок"}>
            <ChevronDown className={`${styles.summaryAccordionChevron} ${isOpen ? styles.summaryAccordionChevronOpen : ""}`} size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
      {isOpen ? (
        <div className={styles.summaryAccordionBody}>
          {configured && (hasChecklist || hasRows) ? (
            <>
              {hasChecklist ? (
                <ProcessingChecklistCard subtitle={checklistSubtitle} items={checklistItems ?? []} compact />
              ) : (
                <div className={styles.summaryRows}>
                  {rows?.map(([label, value]) => (
                    <div key={`${title}-${label}`} className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>{label}</span>
                      <span className={styles.summaryValue}>{value || "-"}</span>
                    </div>
                  ))}
                  {statusBadge ? (
                    <div className={`${styles.summaryRow} ${styles.summaryRowBadge}`}>
                      <span className={styles.summaryLabel}>Статус</span>
                      <span className={styles.statusBadge}>{statusBadge}</span>
                    </div>
                  ) : null}
                </div>
              )}
              {footerNote ? (
                <p className={styles.summarySectionNote}>
                  <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
                  {footerNote}
                </p>
              ) : null}
            </>
          ) : (
            <div className={styles.summaryAccordionPending}>
              <p>{collapsedStatus}</p>
              <button type="button" className={styles.summaryEditLink} onClick={onEdit}>
                Перейти к настройке
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ProcessingChecklistCard({
  title,
  subtitle,
  items,
  compact = false
}: {
  title?: string;
  subtitle?: string;
  items: string[];
  compact?: boolean;
}) {
  return (
    <section className={`${styles.processingChecklistCard} ${compact ? styles.processingChecklistCardCompact : ""}`}>
      {title ? <h3 className={styles.processingChecklistTitle}>{title}</h3> : null}
      {subtitle ? <p className={styles.processingChecklistSubtitle}>{subtitle}</p> : null}
      <ul className={styles.processingChecklist}>
        {items.map((item) => (
          <li key={item}>
            <Check size={15} strokeWidth={2.5} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StepTitle({ icon: Icon, title, text }: { icon: typeof FileText; title: string; text: string }) {
  return (
    <header className={styles.stepTitle}>
      <span><Icon size={20} /></span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </header>
  );
}

function SelectableList({
  title,
  items,
  selectedIds,
  onToggle,
  enableSearch = false,
  searchPlaceholder = "Поиск",
  enableSelectAll = false,
  onSelectAll,
  onDeselectAll
}: {
  title: string;
  items: { id: string; title: string; subtitle: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  enableSelectAll?: boolean;
  onSelectAll?: (ids: string[]) => void;
  onDeselectAll?: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(query));
  }, [items, search]);
  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));

  return (
    <section className={styles.selectableList}>
      <div className={styles.selectableListHeader}>
        <h3>{title}</h3>
        {enableSelectAll && (
          <button
            type="button"
            className={styles.linkButton}
            disabled={!filteredItems.length}
            onClick={() => {
              const ids = filteredItems.map((item) => item.id);
              if (allVisibleSelected) onDeselectAll?.(ids);
              else onSelectAll?.(ids);
            }}
          >
            {allVisibleSelected ? "Снять выделение" : "Выбрать все"}
          </button>
        )}
      </div>
      {enableSearch && (
        <label className={styles.selectableSearch}>
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} />
        </label>
      )}
      <div>
        {filteredItems.map((item) => (
          <label key={item.id}>
            <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </span>
          </label>
        ))}
        {!filteredItems.length && <div className={styles.emptyCell}>Ничего не найдено.</div>}
      </div>
    </section>
  );
}

function SummaryBlock({
  title,
  rows,
  outlined = false,
  statusBadge
}: {
  title: string;
  rows: [string, string][];
  outlined?: boolean;
  statusBadge?: string;
}) {
  return (
    <section className={`${styles.summaryBlock} ${outlined ? styles.summaryBlockOutlined : ""}`}>
      <h3 className={styles.summaryBlockTitle}>{title}</h3>
      <div className={styles.summaryRows}>
        {rows.map(([label, value]) => (
          <div key={`${title}-${label}`} className={styles.summaryRow}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryValue}>{value || "-"}</span>
          </div>
        ))}
        {statusBadge ? (
          <div className={`${styles.summaryRow} ${styles.summaryRowBadge}`}>
            <span className={styles.summaryLabel}>Статус</span>
            <span className={styles.statusBadge}>{statusBadge}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProgressDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className={styles.progressDots} aria-label="Прогресс по этапам">
      {sidebarSteps.map((step, index) => (
        <span
          key={step.label}
          className={`${styles.progressDot} ${index < activeIndex ? styles.progressDotDone : ""} ${index === activeIndex ? styles.progressDotActive : ""}`}
          aria-current={index === activeIndex ? "step" : undefined}
          title={step.label}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}

function getSidebarActiveIndex(stepIndex: number) {
  const found = sidebarSteps.findIndex((step) => (step.stepIndexes as readonly number[]).includes(stepIndex));
  return found >= 0 ? found : 0;
}

function InfoTooltip({
  text,
  placement = "top",
  size = 15,
  inline = false,
  triggerClassName,
  className
}: {
  text: string;
  placement?: "top" | "left" | "right" | "bottom";
  size?: number;
  inline?: boolean;
  triggerClassName?: string;
  className?: string;
}) {
  return (
    <span className={`${styles.infoTooltip} ${inline ? styles.infoTooltipInline : ""} ${className ?? ""}`.trim()}>
      <button type="button" className={`${styles.infoTooltipTrigger} ${triggerClassName ?? ""}`.trim()} aria-label={text}>
        <Info size={size} strokeWidth={2} aria-hidden="true" />
      </button>
      <span className={`${styles.infoTooltipBubble} ${styles[`infoTooltipBubble_${placement}`]}`} role="tooltip">
        {text}
      </span>
    </span>
  );
}

function InfoCallout({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`${styles.infoCallout} ${className ?? ""}`.trim()}>
      <Info size={18} strokeWidth={2.1} aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function WarningCallout({ text }: { text: string }) {
  return <div className={styles.warningCallout}><AlertTriangle size={17} />{text}</div>;
}

function checkDocumentReadiness(document: Document) {
  const extension = getExtension(document.original_filename);
  const allowed = [".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".doc", ".xls", ".ppt"];
  if (!extension || !allowed.includes(extension)) {
    return { document, level: "error" as const, message: "Документ имеет некорректное или неподдерживаемое расширение." };
  }
  if (document.processing_status === "failed") {
    return { document, level: "error" as const, message: "Документ содержит ошибку обработки. Добавление возможно после исправления или подтверждения администратором." };
  }
  if (!["indexed", "text_extracted"].includes(document.processing_status)) {
    return { document, level: "warning" as const, message: "Документ ещё не обработан. Его можно добавить, но индексация начнётся после завершения обработки документа." };
  }
  return { document, level: "ok" as const, message: "Документ готов к добавлению в базу знаний." };
}

function getExtension(filename?: string | null) {
  if (!filename || !filename.includes(".")) return "";
  return `.${filename.split(".").pop()?.toLowerCase() ?? ""}`;
}

function documentStatusLabel(document: Document) {
  if (document.processing_status === "failed") return "Ошибка";
  if (document.processing_status === "indexed" || document.processing_status === "text_extracted") return "Обработан";
  return "На обработке";
}

function departmentName(departments: Department[], departmentId?: string | null) {
  return departments.find((department) => department.id === departmentId)?.name || "-";
}

function getUserPickerLabel(user: User, currentUserId?: string) {
  const label =
    user.full_name?.trim() ||
    [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(" ") ||
    user.email ||
    "Пользователь";
  return currentUserId && user.id === currentUserId ? `${label} (вы)` : label;
}

function userName(users: User[], userId?: string | null, currentUserId?: string) {
  if (!userId) return "Не указан";
  if (currentUserId && userId === currentUserId) return "Вы";
  const user = users.find((item) => item.id === userId);
  return user?.full_name || user?.email || "Пользователь";
}

function optionalUuid(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function formatApiError(error: unknown) {
  if (!isAxiosError(error)) return "Не удалось создать базу знаний.";
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item))).join("; ");
  }
  if (detail && typeof detail === "object" && "message" in detail) return String(detail.message);
  return error.message || "Не удалось создать базу знаний.";
}

function formatBytes(value?: number | null) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

function documentTypeLabel(type: DocumentType) {
  return documentTypeLabels[type] ?? "Прочее";
}

function documentTableStatus(document: Document): { label: string; tone: "processed" | "ocr" | "draft" | "error" } {
  if (document.processing_status === "failed") return { label: "Ошибка", tone: "error" };
  if (document.processing_status === "indexed" || document.processing_status === "text_extracted") {
    return { label: "Обработан", tone: "processed" };
  }
  if (document.processing_status === "uploaded") return { label: "Требует OCR", tone: "ocr" };
  return { label: "Черновик", tone: "draft" };
}

function formatDocumentDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function documentMetaLine(document: Document) {
  const extension = getExtension(document.original_filename).replace(".", "").toUpperCase() || "FILE";
  const metadata = document.metadata;
  const pages =
    metadata && typeof metadata === "object" && "pages" in metadata && typeof metadata.pages === "number"
      ? metadata.pages
      : null;
  if (pages) {
    const unit = extension === "XLS" || extension === "XLSX" ? "листов" : "страниц";
    return `${extension} • ${pages} ${unit}`;
  }
  return extension;
}

function documentAccessLabel(document: Document) {
  const metadata = document.metadata;
  const access =
    metadata && typeof metadata === "object" && "access" in metadata ? String(metadata.access) : null;
  if (access) return access;
  return document.department_id ? "По подразделению" : "Публичный";
}

function pluralDocs(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "документ";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "документа";
  return "документов";
}

function isAcceptedSourceFile(file: File) {
  const extension = getExtension(file.name);
  return sourceAcceptExtensions.includes(extension);
}

function shortFileName(name: string, maxLength = 24) {
  if (name.length <= maxLength) return name;
  const dotIndex = name.lastIndexOf(".");
  const extension = dotIndex > 0 ? name.slice(dotIndex) : "";
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const keep = Math.max(8, maxLength - extension.length - 1);
  return `${base.slice(0, keep)}…${extension}`;
}

function formatShortPersonName(fullName?: string | null, fallback?: string | null) {
  const trimmed = fullName?.trim();
  if (!trimmed) return fallback?.trim() || "Не выбран";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const [lastName, ...rest] = parts;
  const initials = rest.map((part) => `${part.charAt(0).toUpperCase()}.`).join(" ");
  return `${lastName} ${initials}`.trim();
}

function clampChunkSize(value: number) {
  return Math.min(1500, Math.max(500, value));
}

function clampChunkOverlap(value: number) {
  return Math.min(200, Math.max(50, value));
}

function getEmbeddingModelLabel(model: string) {
  return embeddingModelOptions.find((option) => option.value === model)?.label ?? model;
}

function getEmbeddingModelShortLabel(model: string) {
  return getEmbeddingModelLabel(model).replace(/\s*\(\d+\)\s*$/, "");
}

function getEmbeddingModelApiValue(model: string) {
  const label = getEmbeddingModelShortLabel(model);
  return label || null;
}

function buildProcessingChecklist(processing: ProcessingSettings) {
  const items: string[] = [];
  if (processing.ocr) items.push("OCR распознавание");
  items.push("Извлечение текста");
  if (processing.tableExtraction) items.push("Извлечение таблиц");
  if (processing.preserveStructure) items.push("Сохранение структуры");
  if (processing.chunking) items.push(`Разбиение на chunks (${processing.chunkSize} / ${processing.chunkOverlap})`);
  items.push(`Создание embeddings (${getEmbeddingModelShortLabel(processing.embeddingModel)})`);
  items.push("Индексация в Qdrant");
  if (processing.manualReview) items.push("Ручная проверка перед публикацией");
  return items;
}

function yesNo(value: boolean) {
  return value ? "Да" : "Нет";
}

function accessModeLabel(value: AccessMode) {
  const labels: Record<AccessMode, string> = {
    users: "По пользователям",
    departments: "По подразделениям",
    mixed: "Смешанный",
    admins: "Только администраторы",
    agents: "Только выбранные агенты"
  };
  return labels[value];
}
