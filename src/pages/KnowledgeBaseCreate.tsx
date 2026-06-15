import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
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
  PanelLeft,
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
import { agentsApi, departmentsApi, documentsApi, knowledgeBasesApi, rolesApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import AnimatedSidebarSteps from "@/components/AnimatedSidebarSteps";
import { useFooterExpandProgress } from "@/hooks/useFooterExpandProgress";
import DepartmentSelect from "@/components/DepartmentSelect";
import SourceFileTreeEditor from "@/components/SourceFileTreeEditor";
import { FormAutocomplete, FormSelect, SourceFilterBar, Switch } from "@/components/form-controls";
import type {
  AgentAccess,
  Department,
  Document,
  DocumentType,
  KnowledgeBaseAccessType,
  KnowledgeBaseAgentAccessMode,
  KnowledgeBaseCreate,
  ResponsibleUser,
  Role
} from "@/types";
import { filterActiveDepartments } from "@/utils/departments";
import { createId } from "@/utils/createId";
import {
  collectFilesFromDataTransfer,
  collectFilesFromFileList,
  titleFromRelativePath,
  type FolderUploadFile
} from "@/utils/folderUpload";
import {
  buildFolderPath,
  buildSourceFileTree,
  collectAllFolderPaths,
  mergeCustomFoldersIntoTree,
  moveFileRelativePath,
  type SourceTreeRoot
} from "@/utils/sourceFileTree";
import styles from "./KnowledgeBaseCreate.module.css";

type StepId = "main" | "sources" | "readiness" | "processing" | "access" | "agents" | "preview";
type BaseKind = "normative" | "technical" | "project" | "contract" | "process";
type AccessMode = "admins" | "everyone" | "departments" | "users" | "roles" | "mixed";
type AccessSubjectType = "organization" | "department" | "user" | "role";
type AccessTermMode = "forever" | "until";
type AccessBasis =
  | "process_owner"
  | "order"
  | "project"
  | "task"
  | "job_duties"
  | "admin_assignment"
  | "ope_testing"
  | "other";

interface AccessRule {
  id: string;
  granteeType: AccessSubjectType;
  granteeId: string | null;
  granteeLabel: string;
  level: KnowledgeBaseAccessType;
  basis: AccessBasis;
  comment: string;
  termMode: AccessTermMode;
  expiresAt: string;
  includeChildren: boolean;
}

interface AccessExceptionRule {
  id: string;
  granteeType: Exclude<AccessSubjectType, "organization">;
  granteeId: string;
  granteeLabel: string;
  reason: string;
  termMode: AccessTermMode;
  expiresAt: string;
}

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

const RIGHT_SIDEBAR_FLIP_MS = 540;

const sidebarSteps = [
  { label: "Основные сведения", hint: "Информация о базе знаний", stepIndexes: [0] },
  { label: "Источники", hint: "Выбор документов и файлов", stepIndexes: [1, 2] },
  { label: "Обработка", hint: "Извлечение и индексация", stepIndexes: [3] },
  { label: "Доступ пользователей", hint: "Права пользователей", stepIndexes: [4] },
  { label: "Подключение агентов", hint: "Доступ агентов к базе", stepIndexes: [5] },
  { label: "Проверка и создание", hint: "Итоговая проверка", stepIndexes: [6] }
] as const;

const steps: { id: StepId; label: string; hint: string; navLabel: string }[] = [
  { id: "main", label: "Основные сведения", hint: "Информация о базе знаний", navLabel: "Основные сведения" },
  { id: "sources", label: "Источники", hint: "Выбор документов и файлов", navLabel: "Выбор источников" },
  { id: "readiness", label: "Источники", hint: "Проверка готовности документов", navLabel: "Проверка готовности" },
  { id: "processing", label: "Обработка", hint: "Извлечение и индексация", navLabel: "Обработка" },
  { id: "access", label: "Доступ пользователей", hint: "Права пользователей", navLabel: "Настройка доступа" },
  { id: "agents", label: "Подключение агентов", hint: "Подключение ИИ-агентов", navLabel: "Подключение агентов" },
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
  relativePath: string;
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
  read: "Просмотр карточки",
  search: "Поиск",
  use_via_agent: "Поиск и цитирование",
  manage_sources: "Управление источниками",
  reindex: "Переиндексация",
  manage_access: "Управление доступом",
  admin: "Администратор базы"
};

const mainAccessLevels: KnowledgeBaseAccessType[] = ["read", "search", "use_via_agent"];
const advancedAccessLevels: KnowledgeBaseAccessType[] = ["manage_sources", "reindex", "manage_access", "admin"];

const accessModeDescriptions: Record<AccessMode, { title: string; text: string }> = {
  admins: {
    title: "Только владелец и администраторы",
    text: "База еще не готова или содержит чувствительные данные."
  },
  everyone: {
    title: "Все сотрудники организации",
    text: "Корпоративная база для общих регламентов, инструкций и шаблонов."
  },
  departments: {
    title: "Выбранные подразделения",
    text: "База относится к конкретному процессу или службе."
  },
  users: {
    title: "Выбранные пользователи",
    text: "Точечный доступ отдельным сотрудникам."
  },
  roles: {
    title: "Роли",
    text: "Типовые права для руководителей, согласующих, аудиторов."
  },
  mixed: {
    title: "Смешанный доступ",
    text: "Комбинация подразделений, пользователей, ролей и исключений."
  }
};

const accessBasisLabels: Record<AccessBasis, string> = {
  process_owner: "Владелец процесса",
  order: "Приказ / распоряжение",
  project: "Проект",
  task: "Задача / поручение",
  job_duties: "Должностные обязанности",
  admin_assignment: "Административное назначение",
  ope_testing: "ОПЭ / тестирование",
  other: "Другое"
};

const subjectTypeLabels: Record<AccessSubjectType, string> = {
  organization: "Общий доступ",
  department: "Подразделение",
  user: "Пользователь",
  role: "Роль"
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
  manualReview: false,
  chunkSize: 800,
  chunkOverlap: 100,
  embeddingModel: embeddingModelOptions[0].value,
  vectorStore: "Qdrant (основное)",
  qdrantCollection: "kb_default_collection"
};

export default function KnowledgeBaseCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const canLoadReferenceData = isAuthenticated && !authLoading;
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
  const [defaultAccessLevel, setDefaultAccessLevel] = useState<KnowledgeBaseAccessType>("search");
  const [defaultAccessBasis, setDefaultAccessBasis] = useState<AccessBasis>("process_owner");
  const [accessComment, setAccessComment] = useState("");
  const [accessTermMode, setAccessTermMode] = useState<AccessTermMode>("forever");
  const [accessExpiresAt, setAccessExpiresAt] = useState("");
  const [includeChildren, setIncludeChildren] = useState(true);
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [accessExceptions, setAccessExceptions] = useState<AccessExceptionRule[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Record<string, KnowledgeBaseAgentAccessMode>>({});
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [sourceOnlyCurrent, setSourceOnlyCurrent] = useState(true);
  const [stagedDropFiles, setStagedDropFiles] = useState<StagedSourceFile[]>([]);
  const [customFolderPaths, setCustomFolderPaths] = useState<string[]>([]);
  const [uploadingStagedIds, setUploadingStagedIds] = useState<string[]>([]);
  const [rightSidebarView, setRightSidebarView] = useState<"summary" | "tree">("summary");
  const [isRightSidebarAnimating, setIsRightSidebarAnimating] = useState(false);
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(false);
  const stagedDropCountRef = useRef(0);
  const rightSidebarFlipTimerRef = useRef<number | null>(null);

  const beginRightSidebarFlip = useCallback(() => {
    setIsRightSidebarAnimating(true);
    if (rightSidebarFlipTimerRef.current) window.clearTimeout(rightSidebarFlipTimerRef.current);
    rightSidebarFlipTimerRef.current = window.setTimeout(() => {
      setIsRightSidebarAnimating(false);
      rightSidebarFlipTimerRef.current = null;
    }, RIGHT_SIDEBAR_FLIP_MS);
  }, []);

  const showRightSidebarPanel = useCallback(
    (view: "summary" | "tree") => {
      if (view === rightSidebarView) return;
      beginRightSidebarFlip();
      setRightSidebarView(view);
    },
    [beginRightSidebarFlip, rightSidebarView]
  );

  useEffect(
    () => () => {
      if (rightSidebarFlipTimerRef.current) window.clearTimeout(rightSidebarFlipTimerRef.current);
    },
    []
  );

  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: documentsApi.list,
    enabled: canLoadReferenceData
  });
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list,
    enabled: canLoadReferenceData,
    staleTime: 5 * 60 * 1000
  });
  const platformUsers = useQuery({
    queryKey: ["users", "platform-access"],
    queryFn: usersApi.listResponsibleCandidates,
    enabled: canLoadReferenceData,
    staleTime: 5 * 60 * 1000
  });
  const agents = useQuery({
    queryKey: ["agents", "available"],
    queryFn: agentsApi.available,
    enabled: canLoadReferenceData
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: rolesApi.list,
    enabled: canLoadReferenceData,
    staleTime: 5 * 60 * 1000
  });

  const activeDepartments = useMemo(() => filterActiveDepartments(departments.data ?? []), [departments.data]);
  const activeStep = steps[stepIndex];

  const stagedFileTree = useMemo(() => {
    const baseTree = buildSourceFileTree(
      stagedDropFiles.map((item) => ({
        id: item.id,
        relativePath: item.relativePath,
        fileSize: item.file.size
      }))
    );
    return mergeCustomFoldersIntoTree(baseTree, customFolderPaths);
  }, [customFolderPaths, stagedDropFiles]);

  const createStagedFolder = useCallback(
    (parentPath: string, name: string) => {
      const path = buildFolderPath(parentPath, name);
      if (!path) return false;
      const existing = collectAllFolderPaths(stagedFileTree);
      if (existing.has(path)) return false;
      setCustomFolderPaths((current) => (current.includes(path) ? current : [...current, path]));
      return true;
    },
    [stagedFileTree]
  );

  const moveStagedFileToFolder = useCallback((fileId: string, targetFolderPath: string) => {
    setStagedDropFiles((current) =>
      current.map((item) =>
        item.id === fileId
          ? { ...item, relativePath: moveFileRelativePath(item.relativePath, targetFolderPath) }
          : item
      )
    );
  }, []);

  const canFlipRightSidebar =
    (stagedDropFiles.length > 0 || customFolderPaths.length > 0) &&
    (activeStep.id === "sources" || activeStep.id === "readiness");

  const showRightSidebarExpand = activeStep.id === "sources" || activeStep.id === "readiness";

  useEffect(() => {
    if (!canFlipRightSidebar) {
      setRightSidebarView("summary");
      stagedDropCountRef.current = stagedDropFiles.length;
      return;
    }

    if (activeStep.id === "sources" && stagedDropFiles.length > stagedDropCountRef.current) {
      beginRightSidebarFlip();
      setRightSidebarView("tree");
    }

    if (stagedDropFiles.length === 0) {
      setRightSidebarView("summary");
    }

    stagedDropCountRef.current = stagedDropFiles.length;
  }, [activeStep.id, beginRightSidebarFlip, canFlipRightSidebar, stagedDropFiles.length]);

  useEffect(() => {
    if (!showRightSidebarExpand) setIsRightSidebarExpanded(false);
  }, [showRightSidebarExpand]);

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

  const stageIncomingFiles = useCallback((incoming: FolderUploadFile[]) => {
    const accepted = incoming.filter((item) => isAcceptedSourceFile(item.file));
    if (!accepted.length) return;
    setStagedDropFiles((current) => {
      const next = [...current];
      for (const item of accepted) {
        const duplicate = next.some(
          (existing) => existing.relativePath === item.relativePath && existing.file.size === item.file.size
        );
        if (!duplicate) next.push({ id: createId(), file: item.file, relativePath: item.relativePath });
      }
      return next;
    });
  }, []);

  const stageDropFiles = useCallback(
    (files: FileList | File[]) => {
      stageIncomingFiles(collectFilesFromFileList(files));
    },
    [stageIncomingFiles]
  );

  const removeStagedFile = useCallback((id: string) => {
    setStagedDropFiles((current) => current.filter((item) => item.id !== id));
  }, []);

  const uploadStagedFile = useCallback(
    async (id: string) => {
      const staged = stagedDropFiles.find((item) => item.id === id);
      if (!staged || uploadingStagedIds.includes(id)) return;
      setUploadingStagedIds((ids) => [...ids, id]);
      try {
        const title = titleFromRelativePath(staged.relativePath);
        const document = await documentsApi.upload(staged.file, {
          title,
          document_type: "other",
          relative_path: staged.relativePath
        });
        setSelectedSourceIds((ids) => [...new Set([...ids, document.id])]);
        setStagedDropFiles((current) => current.filter((item) => item.id !== id));
        await queryClient.invalidateQueries({ queryKey: ["documents"] });
      } catch (error) {
        console.error("Не удалось загрузить файл:", staged.relativePath, error);
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
      await knowledgeBasesApi.updateAccess(created.id, {
        grants: buildAccessGrants(),
        exceptions: buildAccessExceptions()
      });
      const agentPayload = Object.entries(selectedAgents).map(([agentId, accessMode]) => ({
        agent_id: agentId,
        access_mode: accessMode,
        is_enabled: true
      }));
      if (agentPayload.length) await knowledgeBasesApi.updateAgents(created.id, agentPayload);
      if (startIndexing) await knowledgeBasesApi.index(created.id, { job_type: "full" });
      return created;
    },
    onSuccess: async (created, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      const suffix = variables.startIndexing ? "&tab=indexing" : "";
      navigate(`/knowledge-base?kb=${created.id}${suffix}`);
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
      access_grants: [ownerAdminGrant()],
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
      return [ownerAdminGrant()];
    }
    const grants = accessRules.map((rule) => ({
      grantee_type: rule.granteeType,
      grantee_id: rule.granteeId,
      access_type: rule.level,
      include_child_departments: rule.granteeType === "department" ? rule.includeChildren : false,
      expires_at: rule.termMode === "until" && rule.expiresAt ? new Date(rule.expiresAt).toISOString() : null,
      reason: accessBasisLabels[rule.basis],
      comment: rule.comment || null
    }));
    return grants.length ? grants : [ownerAdminGrant()];
  }

  function buildAccessExceptions() {
    return accessExceptions.map((exception) => ({
      grantee_type: exception.granteeType,
      grantee_id: exception.granteeId,
      access_type: defaultAccessLevel,
      is_deny: true,
      expires_at: exception.termMode === "until" && exception.expiresAt ? new Date(exception.expiresAt).toISOString() : null,
      reason: exception.reason || "Исключение доступа",
      comment: null
    }));
  }

  function ownerAdminGrant() {
    return {
      grantee_type: "admin_only" as const,
      grantee_id: null,
      access_type: "admin" as const,
      reason: "Только владелец и администраторы"
    };
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
      if (accessMode === "admins" || accessMode === "everyone") return null;
      if (accessMode === "departments" && !accessRules.some((rule) => rule.granteeType === "department")) return "Добавьте подразделение в правила доступа.";
      if (accessMode === "users" && !accessRules.some((rule) => rule.granteeType === "user")) return "Добавьте пользователя в правила доступа.";
      if (accessMode === "roles" && !accessRules.some((rule) => rule.granteeType === "role")) return "Добавьте роль в правила доступа.";
      if (accessMode === "mixed" && accessRules.length === 0) return "Добавьте хотя бы одно правило доступа.";
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
  const footerExpandProgress = useFooterExpandProgress([stepIndex, activeStep.id]);
  const footerExpandStyle = { "--footer-expand": footerExpandProgress } as CSSProperties;

  const summaryPanelProps = {
    stepIndex,
    name,
    baseKind,
    department: activeDepartments.find((item) => item.id === departmentId),
    responsible: platformUsers.data?.find((item) => item.id === responsibleUserId),
    topic,
    selectedDocuments,
    stagedDropCount: stagedDropFiles.length,
    stagedFileTree,
    readiness,
    users: platformUsers.data ?? [],
    processing,
    accessMode,
    accessRules,
    accessExceptions,
    defaultAccessLevel,
    defaultAccessBasis,
    includeChildren,
    selectedAgents,
    warningsCount: warnings.length,
    onNavigateToStep: (index: number) => {
      setNavError(null);
      setStepIndex(index);
    }
  };

  return (
    <div
      className={`${styles.page} ${activeStep.id === "sources" ? styles.pageSourcesWide : ""}`}
      style={footerExpandStyle}
    >
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
          <AnimatedSidebarSteps steps={sidebarSteps} activeIndex={activeSidebarIndex} />
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
              departmentsLoading={departments.isPending}
              departmentsError={departments.isError}
              responsibleUsers={platformUsers.data ?? []}
              responsibleUsersLoading={platformUsers.isPending}
              responsibleUsersError={platformUsers.isError}
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
              onStageIncoming={stageIncomingFiles}
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
              defaultAccessLevel={defaultAccessLevel}
              defaultAccessBasis={defaultAccessBasis}
              accessComment={accessComment}
              accessTermMode={accessTermMode}
              accessExpiresAt={accessExpiresAt}
              includeChildren={includeChildren}
              users={platformUsers.data ?? []}
              departments={activeDepartments}
              roles={roles.data ?? []}
              accessRules={accessRules}
              accessExceptions={accessExceptions}
              selectedDocuments={selectedDocuments}
              onMode={setAccessMode}
              onDefaultAccessLevel={setDefaultAccessLevel}
              onDefaultAccessBasis={setDefaultAccessBasis}
              onAccessComment={setAccessComment}
              onAccessTermMode={setAccessTermMode}
              onAccessExpiresAt={setAccessExpiresAt}
              onIncludeChildren={setIncludeChildren}
              onRulesChange={setAccessRules}
              onExceptionsChange={setAccessExceptions}
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
              responsible={platformUsers.data?.find((item) => item.id === responsibleUserId)}
              users={platformUsers.data ?? []}
              topic={topic}
              selectedDocuments={selectedDocuments}
              processing={processing}
              accessMode={accessMode}
              accessRules={accessRules}
              accessExceptions={accessExceptions}
              selectedAgents={selectedAgents}
              warnings={warnings}
            />
          )}
        </section>

        <div className={styles.summaryCardShell}>
          <aside
            className={`${styles.summaryCard} ${canFlipRightSidebar ? styles.summaryCardFlipHost : ""} ${
              canFlipRightSidebar && rightSidebarView === "tree" ? styles.summaryCardShowingTree : ""
            } ${isRightSidebarAnimating ? styles.summaryCardAnimating : ""} ${
              isRightSidebarExpanded ? styles.summaryCardExpanded : ""
            } ${showRightSidebarExpand || canFlipRightSidebar ? styles.summaryCardWithControls : ""}`.trim()}
          >
            {showRightSidebarExpand ? (
              <button
                type="button"
                className={styles.summaryWidthToggle}
                aria-label={isRightSidebarExpanded ? "Сузить правую панель" : "Развернуть правую панель"}
                aria-expanded={isRightSidebarExpanded}
                onClick={() => setIsRightSidebarExpanded((current) => !current)}
              >
                <PanelLeft size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
            {canFlipRightSidebar ? (
              <>
                <div
                  className={`${styles.summaryFlipInner} ${rightSidebarView === "tree" ? styles.summaryFlipInnerFlipped : ""}`}
                >
                  <div className={styles.summaryFlipFront}>
                    <Summary {...summaryPanelProps} />
                  </div>
                  <div className={styles.summaryFlipBack}>
                    <SourceTreeSidebarPanel
                      tree={stagedFileTree}
                      onCreateFolder={createStagedFolder}
                      onMoveFile={moveStagedFileToFolder}
                    />
                  </div>
                </div>
                <div className={styles.summarySidebarFooter}>
                  {rightSidebarView === "summary" ? (
                    <button
                      type="button"
                      className={styles.summarySidebarNavButton}
                      onClick={() => showRightSidebarPanel("tree")}
                    >
                      <ListTree size={16} strokeWidth={2} aria-hidden="true" />
                      Структура загрузки ({stagedFileTree.fileCount})
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.summarySidebarNavButton}
                      onClick={() => showRightSidebarPanel("summary")}
                    >
                      <ClipboardList size={16} strokeWidth={2} aria-hidden="true" />
                      Сводка
                    </button>
                  )}
                </div>
              </>
            ) : (
              <Summary {...summaryPanelProps} />
            )}
          </aside>
        </div>
      </main>

      {createKnowledgeBase.isError && (
        <div className={styles.createError}>{formatApiError(createKnowledgeBase.error)}</div>
      )}

      {navError ? <div className={styles.navError}>{navError}</div> : null}

      <footer className={styles.footerNav} style={footerExpandStyle}>
        <div className={styles.footerNavClusterShell} style={footerExpandStyle}>
          <div className={styles.footerNavCluster}>
            <div className={styles.footerNavSlot}>
            {backStepLabel ? (
              <MorphNavButton
                variant="secondary"
                expandProgress={footerExpandProgress}
                label={`Назад: ${backStepLabel}`}
                shortLabel="Назад"
                onClick={goBack}
                icon={<ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />}
              />
            ) : null}
          </div>

          <div className={styles.progressStepsShell} style={footerExpandStyle}>
            <MorphingProgressSteps activeIndex={activeSidebarIndex} expandProgress={footerExpandProgress} />
          </div>

          <div className={`${styles.footerNavSlot} ${styles.footerNavSlotRight}`}>
            {stepIndex < steps.length - 1 ? (
              <MorphNavButton
                variant="primary"
                expandProgress={footerExpandProgress}
                label={`Далее: ${nextStepLabel}`}
                shortLabel="Далее"
                onClick={goNext}
                icon={<ChevronRight size={16} strokeWidth={2} aria-hidden="true" />}
                iconAfter
              />
            ) : (
              <div className={styles.footerFinalActions} style={footerExpandStyle}>
                <MorphNavButton
                  variant="secondary"
                  expandProgress={footerExpandProgress}
                  label="Отмена"
                  shortLabel="Отмена"
                  onClick={() => navigate("/knowledge-base")}
                  icon={<X size={16} strokeWidth={2} aria-hidden="true" />}
                />
                <MorphNavButton
                  variant="secondary"
                  expandProgress={footerExpandProgress}
                  label="Сохранить как черновик"
                  shortLabel="Черновик"
                  onClick={() => createKnowledgeBase.mutate({ startIndexing: false })}
                  disabled={!canCreateDraft || createKnowledgeBase.isPending}
                  icon={<FilePlus2 size={16} strokeWidth={2} aria-hidden="true" />}
                />
                <MorphNavButton
                  variant="primary"
                  expandProgress={footerExpandProgress}
                  label="Создать и запустить индексацию"
                  shortLabel="Создать"
                  onClick={() => createKnowledgeBase.mutate({ startIndexing: true })}
                  disabled={!canCreateFull || createKnowledgeBase.isPending}
                  icon={<ChevronRight size={16} strokeWidth={2} aria-hidden="true" />}
                  iconAfter
                />
              </div>
            )}
            </div>
          </div>
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
  departmentsLoading?: boolean;
  departmentsError?: boolean;
  responsibleUsers: ResponsibleUser[];
  responsibleUsersLoading?: boolean;
  responsibleUsersError?: boolean;
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
            placeholder={
              props.departmentsLoading
                ? "Загружаем подразделения..."
                : props.departmentsError
                  ? "Не удалось загрузить подразделения"
                  : props.departments.length
                    ? "Выберите подразделение"
                    : "Список подразделений пуст"
            }
            allowEmpty={false}
            ariaLabel="Подразделение-владелец"
          />
          {props.departmentsError ? (
            <p className={styles.fieldHint}>Не удалось загрузить подразделения. Обновите страницу или обратитесь к администратору.</p>
          ) : null}
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Ответственный <span className={styles.required}>*</span>
          </span>
          <FormAutocomplete
            value={props.responsibleUserId}
            onChange={props.onResponsible}
            options={props.responsibleUsers.map((user) => ({
              value: user.id,
              label: formatResponsibleUserLabel(user)
            }))}
            placeholder={
              props.responsibleUsersLoading
                ? "Загружаем зарегистрированных сотрудников..."
                : props.responsibleUsersError
                  ? "Не удалось загрузить список сотрудников"
                  : props.responsibleUsers.length
                    ? "Начните вводить ФИО, должность или отдел"
                    : "Нет зарегистрированных сотрудников с доступом к платформе"
            }
            noResultsText="Сотрудник не найден"
            ariaLabel="Ответственный"
          />
          {props.responsibleUsersError ? (
            <p className={styles.fieldHint}>Не удалось загрузить сотрудников. Обновите страницу или обратитесь к администратору.</p>
          ) : null}
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

function folderPathLabel(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) return "Корень";
  parts.pop();
  return parts.join("/");
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
  onStageIncoming: (files: FolderUploadFile[]) => void;
  onRemoveStaged: (id: string) => void;
  onUploadStaged: (id: string) => void;
  onUploadAllStaged: () => void;
}) {
  const readyCount = props.readiness.filter((item) => item.level === "ok").length;
  const ocrCount = props.readiness.filter((item) => item.level === "warning").length;
  const dragDepthRef = useRef(0);
  const stagedScrollerRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [stagedSearch, setStagedSearch] = useState("");

  const filteredStagedFiles = useMemo(() => {
    const query = stagedSearch.trim().toLowerCase();
    if (!query) return props.stagedFiles;
    return props.stagedFiles.filter((item) =>
      `${item.relativePath} ${item.file.name}`.toLowerCase().includes(query)
    );
  }, [props.stagedFiles, stagedSearch]);

  const scrollStagedFiles = useCallback((direction: -1 | 1) => {
    const scroller = stagedScrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth, behavior: "smooth" });
  }, []);

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

      void (async () => {
        try {
          setDropError(null);
          const incoming = await collectFilesFromDataTransfer(event.dataTransfer);
          const accepted = incoming.filter((item) => isAcceptedSourceFile(item.file));
          if (accepted.length) {
            props.onStageIncoming(accepted);
          } else if (incoming.length) {
            setDropError("Нет файлов подходящего формата. Поддерживаются PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT.");
          } else {
            setDropError("Не удалось прочитать перетащенные файлы или папку.");
          }
        } catch {
          setDropError("Не удалось обработать перетаскивание");
        }
      })();
    },
    [props.onStageIncoming]
  );

  useEffect(() => {
    const resetDragState = () => {
      dragDepthRef.current = 0;
      setIsDragOver(false);
    };
    window.addEventListener("dragend", resetDragState);
    return () => window.removeEventListener("dragend", resetDragState);
  }, []);

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
            <strong>Отпустите файлы или папку для добавления</strong>
            <span>PDF, DOCX, XLSX, PPTX, TXT — структура папок сохранится</span>
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

      {dropError ? <p className={styles.createError} role="alert">{dropError}</p> : null}

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
        <label className={styles.sourcesFileButton}>
          Выбрать папку
          <input
            type="file"
            multiple
            // @ts-expect-error non-standard directory picker attributes
            webkitdirectory=""
            directory=""
            onChange={(event) => {
              if (event.target.files?.length) props.onStageFiles(event.target.files);
              event.target.value = "";
            }}
          />
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
          <label className={styles.sourcesStagedSearch}>
            <Search size={14} aria-hidden="true" />
            <input
              value={stagedSearch}
              onChange={(event) => setStagedSearch(event.target.value)}
              placeholder="Поиск по имени или пути..."
            />
          </label>
          <div className={styles.sourcesStagedCarousel}>
            <button
              type="button"
              className={styles.sourcesStagedNav}
              aria-label="Прокрутить файлы назад"
              onClick={() => scrollStagedFiles(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <div ref={stagedScrollerRef} className={styles.sourcesStagedList}>
              {filteredStagedFiles.map((staged) => {
                const extKey = getExtension(staged.file.name).replace(".", "") || "default";
                const uploading = props.uploadingStagedIds.includes(staged.id);
                return (
                  <article
                    key={staged.id}
                    className={`${styles.sourcesStagedCard} ${uploading ? styles.sourcesStagedCardUploading : ""}`}
                    draggable={!uploading}
                    title={staged.relativePath}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/x-staged-file-id", staged.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <span className={`${styles.sourcesDocIcon} ${styles[`sourcesDocIcon_${extKey}`] ?? styles.sourcesDocIcon_default}`}>
                      {(extKey || "file").slice(0, 4)}
                    </span>
                    <p className={styles.sourcesStagedName}>{staged.file.name}</p>
                    <button
                      type="button"
                      className={styles.sourcesStagedUpload}
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onUploadStaged(staged.id);
                      }}
                      disabled={uploading}
                      aria-label={`Загрузить ${staged.file.name}`}
                      title="Загрузить"
                    >
                      {uploading ? <span aria-hidden="true">…</span> : <ArrowUp size={12} strokeWidth={2.5} />}
                    </button>
                    <button
                      type="button"
                      className={styles.sourcesStagedRemove}
                      onClick={() => props.onRemoveStaged(staged.id)}
                      disabled={uploading}
                      aria-label={`Удалить ${staged.file.name}`}
                    >
                      <X size={12} />
                    </button>
                  </article>
                );
              })}
              {!filteredStagedFiles.length ? (
                <p className={styles.sourcesStagedEmpty}>Ничего не найдено по запросу «{stagedSearch}»</p>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.sourcesStagedNav}
              aria-label="Прокрутить файлы вперёд"
              onClick={() => scrollStagedFiles(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <p className={styles.sourcesStagedHint}>
            Правый клик по структуре справа — создать папку. Перетащите карточки в нужные папки перед загрузкой.
          </p>
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
  defaultAccessLevel: KnowledgeBaseAccessType;
  defaultAccessBasis: AccessBasis;
  accessComment: string;
  accessTermMode: AccessTermMode;
  accessExpiresAt: string;
  includeChildren: boolean;
  users: ResponsibleUser[];
  departments: Department[];
  roles: Role[];
  accessRules: AccessRule[];
  accessExceptions: AccessExceptionRule[];
  selectedDocuments: Document[];
  onMode: (value: AccessMode) => void;
  onDefaultAccessLevel: (value: KnowledgeBaseAccessType) => void;
  onDefaultAccessBasis: (value: AccessBasis) => void;
  onAccessComment: (value: string) => void;
  onAccessTermMode: (value: AccessTermMode) => void;
  onAccessExpiresAt: (value: string) => void;
  onIncludeChildren: (value: boolean) => void;
  onRulesChange: (value: AccessRule[]) => void;
  onExceptionsChange: (value: AccessExceptionRule[]) => void;
}) {
  const [modal, setModal] = useState<"grant" | "exception" | null>(null);
  const [subjectType, setSubjectType] = useState<AccessSubjectType>(
    props.accessMode === "users" ? "user" : props.accessMode === "roles" ? "role" : props.accessMode === "everyone" ? "organization" : "department"
  );
  const [subjectQuery, setSubjectQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedSubjectLabel, setSelectedSubjectLabel] = useState("");
  const [showAdvancedRights, setShowAdvancedRights] = useState(false);

  const allowedSubjectTypes = subjectTypesForMode(props.accessMode);
  const candidates = subjectCandidates(subjectType, props.departments, props.users, props.roles, subjectQuery);
  const canAddOrganization = subjectType === "organization";
  const canConfirm =
    modal === "grant"
      ? canAddOrganization || Boolean(selectedSubjectId)
      : subjectType !== "organization" && Boolean(selectedSubjectId);

  function addRule() {
    const label = canAddOrganization ? "Все активные сотрудники" : selectedSubjectLabel;
    props.onRulesChange([
      ...props.accessRules,
      {
        id: createId(),
        granteeType: subjectType,
        granteeId: canAddOrganization ? null : selectedSubjectId,
        granteeLabel: label,
        level: props.defaultAccessLevel,
        basis: props.defaultAccessBasis,
        comment: props.accessComment,
        termMode: props.accessTermMode,
        expiresAt: props.accessExpiresAt,
        includeChildren: subjectType === "department" ? props.includeChildren : false
      }
    ]);
    resetModal();
  }

  function addException() {
    if (subjectType === "organization" || !selectedSubjectId) return;
    props.onExceptionsChange([
      ...props.accessExceptions,
      {
        id: createId(),
        granteeType: subjectType,
        granteeId: selectedSubjectId,
        granteeLabel: selectedSubjectLabel,
        reason: props.accessComment || "Исключение доступа",
        termMode: props.accessTermMode,
        expiresAt: props.accessExpiresAt
      }
    ]);
    resetModal();
  }

  function resetModal() {
    setModal(null);
    setSubjectQuery("");
    setSelectedSubjectId(null);
    setSelectedSubjectLabel("");
  }

  function openModal(kind: "grant" | "exception", preferredType?: AccessSubjectType) {
    const nextType = preferredType ?? allowedSubjectTypes[0] ?? "department";
    setSubjectType(kind === "exception" && nextType === "organization" ? "user" : nextType);
    setSelectedSubjectId(null);
    setSelectedSubjectLabel("");
    setSubjectQuery("");
    setModal(kind);
  }

  function handleModeChange(mode: AccessMode) {
    props.onMode(mode);
    const allowed = subjectTypesForMode(mode);
    if (mode === "admins") {
      props.onRulesChange([]);
      props.onExceptionsChange([]);
    } else if (mode === "everyone") {
      props.onRulesChange([
        organizationRule(
          props.defaultAccessLevel,
          props.defaultAccessBasis,
          props.accessComment,
          props.accessTermMode,
          props.accessExpiresAt,
          props.users.length
        )
      ]);
    } else {
      props.onRulesChange(props.accessRules.filter((rule) => allowed.includes(rule.granteeType)));
    }
  }


  return (
    <div className={styles.stepBody}>
      <StepTitle icon={LockKeyhole} title="Доступ пользователей" text="Настройте, кто из сотрудников сможет пользоваться этой базой знаний и на каком уровне прав." />
      <section className={styles.accessConstructorSection}>
        <h3>1. Режим доступа</h3>
        <div className={styles.accessModes}>
          {(Object.keys(accessModeDescriptions) as AccessMode[]).map((value) => (
            <button key={value} type="button" className={props.accessMode === value ? styles.selectedMode : undefined} onClick={() => handleModeChange(value)}>
              <strong>{accessModeDescriptions[value].title}</strong>
              <span>{accessModeDescriptions[value].text}</span>
            </button>
          ))}
        </div>
      </section>

      {props.accessMode === "everyone" ? (
        <>
          <WarningCallout text="Общий доступ не отменяет ограничения на исходные документы. Если сотрудник не имеет права на конкретный документ, его фрагменты не будут выданы в поиске." />
          <section className={styles.accessConstructorSection}>
            <h3>Сотрудники с доступом к платформе ({props.users.length})</h3>
            <p className={styles.fieldHint}>
              К базе будут допущены только зарегистрированные пользователи, которые могут войти в систему (через 1С или обычную регистрацию). Сотрудники из оргструктуры без учётной записи в список не попадают.
            </p>
            <RegisteredUsersList users={props.users} />
          </section>
        </>
      ) : null}

      <section className={styles.accessConstructorSection}>
        <h3>2. Уровень прав по умолчанию</h3>
        <div className={styles.rightsGrid}>
          {[...mainAccessLevels, ...(showAdvancedRights ? advancedAccessLevels : [])].map((value) => (
            <button
              key={value}
              type="button"
              className={props.defaultAccessLevel === value ? styles.selectedMode : undefined}
              onClick={() => props.onDefaultAccessLevel(value)}
            >
              {accessLabels[value]}
            </button>
          ))}
          <button type="button" onClick={() => setShowAdvancedRights((value) => !value)}>
            {showAdvancedRights ? "Скрыть расширенные права" : "Расширенные права"}
          </button>
        </div>
      </section>

      <div className={styles.formGrid}>
        <label>
          Основание выдачи доступа
          <select value={props.defaultAccessBasis} onChange={(event) => props.onDefaultAccessBasis(event.target.value as AccessBasis)}>
            {Object.entries(accessBasisLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Комментарий
          <input value={props.accessComment} onChange={(event) => props.onAccessComment(event.target.value)} placeholder="Например: доступ для работы с регламентами совещаний" />
        </label>
        <label>
          Срок действия
          <select value={props.accessTermMode} onChange={(event) => props.onAccessTermMode(event.target.value as AccessTermMode)}>
            <option value="forever">Бессрочно</option>
            <option value="until">До даты</option>
          </select>
        </label>
        {props.accessTermMode === "until" ? (
          <label>
            Дата окончания
            <input type="date" value={props.accessExpiresAt} onChange={(event) => props.onAccessExpiresAt(event.target.value)} />
          </label>
        ) : null}
        <label className={styles.checkboxLine}>
          <input type="checkbox" checked={props.includeChildren} onChange={(event) => props.onIncludeChildren(event.target.checked)} />
          Распространять на дочерние подразделения
        </label>
      </div>

      <section className={styles.accessConstructorSection}>
        <div className={styles.sectionHeaderLine}>
          <h3>5. Правила доступа</h3>
          <div>
            <button type="button" className={styles.secondaryButton} onClick={() => openModal("grant")}>+ Добавить доступ</button>
            {props.accessMode === "departments" || props.accessMode === "mixed" ? (
              <button type="button" className={styles.secondaryButton} onClick={() => openModal("grant", "department")}>+ Добавить подразделение</button>
            ) : null}
            {props.accessMode === "roles" || props.accessMode === "mixed" ? (
              <button type="button" className={styles.secondaryButton} onClick={() => openModal("grant", "role")}>+ Добавить роль</button>
            ) : null}
          </div>
        </div>
        <CompactRulesTable
          headers={["Кому предоставлен доступ", "Тип субъекта", "Уровень прав", "Наследование", "Основание", "Срок", "Действия"]}
          rows={props.accessRules.map((rule) => [
            rule.granteeLabel,
            subjectTypeLabels[rule.granteeType],
            accessLabels[rule.level],
            rule.includeChildren ? "Да" : "Нет",
            accessBasisLabels[rule.basis],
            formatAccessTerm(rule.termMode, rule.expiresAt),
            <button key={rule.id} type="button" onClick={() => props.onRulesChange(props.accessRules.filter((item) => item.id !== rule.id))}>Удалить</button>
          ])}
          empty="Правила доступа ещё не добавлены."
        />
      </section>

      <section className={styles.accessConstructorSection}>
        <div className={styles.sectionHeaderLine}>
          <h3>6. Исключения доступа</h3>
          <button type="button" className={styles.secondaryButton} onClick={() => openModal("exception")}>+ Добавить исключение</button>
        </div>
        <CompactRulesTable
          headers={["Кому закрыт доступ", "Тип субъекта", "Причина", "Срок", "Действия"]}
          rows={props.accessExceptions.map((exception) => [
            exception.granteeLabel,
            subjectTypeLabels[exception.granteeType],
            exception.reason || "Исключение доступа",
            formatAccessTerm(exception.termMode, exception.expiresAt),
            <button key={exception.id} type="button" onClick={() => props.onExceptionsChange(props.accessExceptions.filter((item) => item.id !== exception.id))}>Удалить</button>
          ])}
          empty="Исключений нет."
        />
      </section>

      {props.selectedDocuments.length > 0 && (
        <WarningCallout text="Если пользователь имеет доступ к базе, но не имеет доступа к части документов-источников, агент и поиск будут использовать только разрешённые для него фрагменты." />
      )}

      {modal ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.accessModal}>
            <header>
              <h3>{modal === "grant" ? "Добавить доступ" : "Добавить исключение"}</h3>
              <button type="button" onClick={resetModal}>×</button>
            </header>
            <div className={styles.formGrid}>
              <label>
                Кому
                <select value={subjectType} onChange={(event) => {
                  setSubjectType(event.target.value as AccessSubjectType);
                  setSelectedSubjectId(null);
                  setSelectedSubjectLabel("");
                }}>
                  {allowedSubjectTypes.filter((type) => modal === "grant" || type !== "organization").map((type) => (
                    <option key={type} value={type}>{subjectTypeLabels[type]}</option>
                  ))}
                </select>
              </label>
              {subjectType !== "organization" ? (
                <label>
                  Найти
                  <input value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} placeholder={subjectType === "user" ? "ФИО, должность или подразделение" : "Введите название"} />
                </label>
              ) : null}
            </div>
            {subjectType !== "organization" ? (
              <div className={styles.modalPickList}>
                {candidates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={selectedSubjectId === item.id ? styles.selectedMode : undefined}
                    onClick={() => {
                      setSelectedSubjectId(item.id);
                      setSelectedSubjectLabel(item.title);
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </button>
                ))}
              </div>
            ) : (
              <InfoCallout text="База знаний будет доступна всем зарегистрированным сотрудникам с учётной записью в платформе. Сотрудники без входа в систему не получат доступ." />
            )}
            <footer>
              <button type="button" className={styles.navBackButton} onClick={resetModal}>Отмена</button>
              <button type="button" className={styles.navNextButton} disabled={!canConfirm} onClick={modal === "grant" ? addRule : addException}>
                {modal === "grant" ? "Добавить доступ" : "Добавить исключение"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function subjectTypesForMode(mode: AccessMode): AccessSubjectType[] {
  if (mode === "everyone") return ["organization"];
  if (mode === "departments") return ["department"];
  if (mode === "users") return ["user"];
  if (mode === "roles") return ["role"];
  if (mode === "mixed") return ["department", "user", "role"];
  return ["user"];
}

function subjectCandidates(
  type: AccessSubjectType,
  departments: Department[],
  users: ResponsibleUser[],
  roles: Role[],
  query: string
): { id: string; title: string; subtitle: string }[] {
  const normalized = query.trim().toLowerCase();
  const match = (text: string) => !normalized || text.toLowerCase().includes(normalized);
  if (type === "department") {
    return departments
      .map((department) => ({
        id: department.id,
        title: department.name,
        subtitle: department.description || "Без описания"
      }))
      .filter((item) => match(`${item.title} ${item.subtitle}`))
      .slice(0, 30);
  }
  if (type === "user") {
    return users
      .map((user) => ({
        id: user.id,
        title: user.full_name || "Пользователь",
        subtitle: [user.position, user.department_name].filter(Boolean).join(" · ") || "Должность не указана"
      }))
      .filter((item) => match(`${item.title} ${item.subtitle}`))
      .slice(0, 30);
  }
  if (type === "role") {
    return roles
      .map((role) => ({
        id: role.id,
        title: role.name,
        subtitle: role.description || role.code
      }))
      .filter((item) => match(`${item.title} ${item.subtitle}`))
      .slice(0, 30);
  }
  return [];
}

function formatAccessTerm(termMode: AccessTermMode, expiresAt: string) {
  return termMode === "until" && expiresAt ? `До ${expiresAt}` : "Бессрочно";
}

function RegisteredUsersList({ users }: { users: ResponsibleUser[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = users.filter((user) => {
    if (!normalized) return true;
    const haystack = `${user.full_name ?? ""} ${user.position ?? ""} ${user.department_name ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
  });

  if (!users.length) {
    return <InfoCallout text="Зарегистрированных сотрудников пока нет. Добавьте пользователей или выполните вход через 1С." />;
  }

  return (
    <>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Поиск в списке</span>
        <input
          className={styles.control}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ФИО, должность или подразделение"
        />
      </label>
      <div className={styles.registeredUsersList}>
        {filtered.slice(0, 100).map((user) => (
          <article key={user.id}>
            <strong>{user.full_name || "Пользователь"}</strong>
            <span>{[user.position, user.department_name].filter(Boolean).join(" · ") || "Подразделение не указано"}</span>
          </article>
        ))}
        {!filtered.length ? <p className={styles.fieldHint}>Сотрудники не найдены.</p> : null}
        {filtered.length > 100 ? <p className={styles.fieldHint}>Показаны первые 100 из {filtered.length}.</p> : null}
      </div>
    </>
  );
}

function organizationRule(
  level: KnowledgeBaseAccessType,
  basis: AccessBasis,
  comment: string,
  termMode: AccessTermMode,
  expiresAt: string,
  usersCount = 0
): AccessRule {
  return {
    id: createId(),
    granteeType: "organization",
    granteeId: null,
    granteeLabel: usersCount ? `Все зарегистрированные сотрудники (${usersCount})` : "Все зарегистрированные сотрудники",
    level,
    basis,
    comment,
    termMode,
    expiresAt,
    includeChildren: false
  };
}

function CompactRulesTable({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  return (
    <table className={styles.accessRulesTable}>
      <thead>
        <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={headers.length} className={styles.emptyCell}>{empty}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function StepAgents({ agents, selectedAgents, onChange }: { agents: AgentAccess[]; selectedAgents: Record<string, KnowledgeBaseAgentAccessMode>; onChange: (value: Record<string, KnowledgeBaseAgentAccessMode>) => void }) {
  return (
    <div className={styles.stepBody}>
      <StepTitle icon={Bot} title="Подключение агентов" text="Выберите, какие агенты смогут использовать базу знаний через зарегистрированный инструмент search_knowledge_base." />
      <CompactRulesTable
        headers={["Агент", "Назначение", "Режим использования базы", "Статус агента", "Доступ пользователя учитывается", "Действие"]}
        rows={agents.map((agent) => {
          const selected = selectedAgents[agent.id];
          return [
            agent.name,
            agent.purpose || agent.slug,
            <select
              key={`${agent.id}-mode`}
              value={selected || "search_only"}
              disabled={!selected}
              onChange={(event) => onChange({ ...selectedAgents, [agent.id]: event.target.value as KnowledgeBaseAgentAccessMode })}
            >
              {Object.entries(agentModeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>,
            agent.status,
            "Да",
            <button
              key={`${agent.id}-toggle`}
              type="button"
              onClick={() => {
                const next = { ...selectedAgents };
                if (selected) delete next[agent.id];
                else next[agent.id] = "search_only";
                onChange(next);
              }}
            >
              {selected ? "Отключить" : "Подключить"}
            </button>
          ];
        })}
        empty="Агенты пока не настроены."
      />
      <InfoCallout text="Ключевое правило: агент может использовать только те фрагменты базы знаний, к которым имеет доступ пользователь, запустивший агента." />
    </div>
  );
}

function StepPreview(props: {
  name: string;
  description: string;
  baseKind: BaseKind;
  department?: Department;
  responsible?: ResponsibleUser;
  topic: string;
  selectedDocuments: Document[];
  users: ResponsibleUser[];
  processing: ProcessingSettings;
  accessMode: AccessMode;
  accessRules: AccessRule[];
  accessExceptions: AccessExceptionRule[];
  selectedAgents: Record<string, KnowledgeBaseAgentAccessMode>;
  warnings: ReturnType<typeof checkDocumentReadiness>[];
}) {
  return (
    <div className={styles.stepBody}>
      <StepTitle icon={ShieldCheck} title="Предпросмотр и подтверждение" text="Проверьте итоговую сводку перед созданием базы знаний." />
      <div className={styles.previewGrid}>
        <SummaryBlock title="Основные сведения" rows={[["Название", props.name], ["Описание", props.description], ["Тип", baseKindLabels[props.baseKind]], ["Подразделение", props.department?.name || "-"], ["Ответственный", props.responsible ? formatResponsibleUserLabel(props.responsible) : "-"], ["Тематика", props.topic || "-"]]} />
        <SummaryBlock title="Источники" rows={[["Документов", String(props.selectedDocuments.length)], ...props.selectedDocuments.slice(0, 5).map((document) => [document.title, userName(props.users, document.uploaded_by_user_id)] as [string, string])]} />
        <section className={styles.summaryBlock}>
          <ProcessingChecklistCard title="Обработка" subtitle="Текущие настройки" items={buildProcessingChecklist(props.processing)} />
        </section>
        <SummaryBlock title="Доступ" rows={[
          ["Режим", accessModeLabel(props.accessMode)],
          ["Правил", String(props.accessRules.length)],
          ["Исключений", String(props.accessExceptions.length)]
        ]} />
        <SummaryBlock title="Агенты" rows={[["Подключено", String(Object.keys(props.selectedAgents).length)], ...Object.values(props.selectedAgents).slice(0, 4).map((mode, index) => [`Агент ${index + 1}`, agentModeLabels[mode]] as [string, string])]} />
        <SummaryBlock title="Предупреждения" rows={props.warnings.length ? props.warnings.map((warning) => [warning.document.title, warning.message] as [string, string]) : [["Ошибки", "Нет критичных предупреждений"]]} />
      </div>
    </div>
  );
}

function SourceTreeSidebarPanel({
  tree,
  onCreateFolder,
  onMoveFile
}: {
  tree: SourceTreeRoot;
  onCreateFolder: (parentPath: string, name: string) => boolean;
  onMoveFile: (fileId: string, targetFolderPath: string) => void;
}) {
  return (
    <section className={styles.sourceTreeSidebar} aria-label="Структура загруженных файлов">
      <div className={styles.sourceTreeHead}>
        <h3 className={styles.sourceTreeTitle}>Структура загрузки</h3>
        <p className={styles.sourceTreeMeta}>
          {tree.fileCount} файлов · {tree.folderCount} папок
        </p>
      </div>
      <div className={styles.sourceTreeBody}>
        <SourceFileTreeEditor tree={tree} onCreateFolder={onCreateFolder} onMoveFile={onMoveFile} />
      </div>
    </section>
  );
}

function Summary(props: {
  stepIndex: number;
  name: string;
  baseKind: BaseKind;
  department?: Department;
  responsible?: ResponsibleUser;
  topic: string;
  selectedDocuments: Document[];
  stagedDropCount: number;
  stagedFileTree: SourceTreeRoot;
  readiness: ReturnType<typeof checkDocumentReadiness>[];
  users: ResponsibleUser[];
  processing: ProcessingSettings;
  accessMode: AccessMode;
  accessRules: AccessRule[];
  accessExceptions: AccessExceptionRule[];
  defaultAccessLevel: KnowledgeBaseAccessType;
  defaultAccessBasis: AccessBasis;
  includeChildren: boolean;
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
          ["Ответственный", props.responsible ? formatResponsibleUserLabel(props.responsible) : "Не выбран"]
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
          ["Папок", String(props.stagedFileTree.folderCount)],
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
        title: "Доступ пользователей",
        stepIndex: 4,
        configured: accessConfigured,
        collapsedStatus: accessConfigured ? accessModeLabel(props.accessMode) : "Не настроено",
        rows: [
          ["Режим", accessModeLabel(props.accessMode)],
          ["Правил доступа", String(props.accessRules.length)],
          ["Исключений", String(props.accessExceptions.length)],
          ["Уровень по умолчанию", accessLabels[props.defaultAccessLevel]],
          ["Основание", accessBasisLabels[props.defaultAccessBasis]],
          ["Наследование", props.includeChildren ? "Да, на дочерние подразделения" : "Нет"],
          ["Что проверить", accessWarnings(props.accessMode, props.accessExceptions.length, props.warningsCount).join("; ")]
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
      props.accessExceptions,
      agentsConfigured,
      previewConfigured,
      processingConfigured,
      props.accessRules,
      props.accessMode,
      props.baseKind,
      props.defaultAccessBasis,
      props.defaultAccessLevel,
      props.department?.name,
      props.includeChildren,
      props.name,
      props.processing,
      props.responsible,
      props.selectedAgents,
      props.selectedDocuments.length,
      props.stagedDropCount,
      props.stagedFileTree.folderCount,
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

function MorphNavButton({
  expandProgress,
  label,
  shortLabel,
  onClick,
  icon,
  variant,
  disabled = false,
  iconAfter = false
}: {
  expandProgress: number;
  label: string;
  shortLabel: string;
  onClick: () => void;
  icon: ReactNode;
  variant: "primary" | "secondary";
  disabled?: boolean;
  iconAfter?: boolean;
}) {
  const variantClass = variant === "primary" ? styles.navMorphButtonPrimary : styles.navMorphButtonSecondary;
  const isCollapsed = expandProgress < 0.04;
  const isExpanded = expandProgress > 0.96;
  const stateClass = isCollapsed
    ? styles.navMorphButtonCollapsed
    : isExpanded
      ? styles.navMorphButtonExpanded
      : "";

  return (
    <button
      type="button"
      className={`${styles.navMorphButton} ${variantClass} ${stateClass}`.trim()}
      style={{ "--footer-expand": expandProgress } as CSSProperties}
      onClick={onClick}
      disabled={disabled}
      aria-label={isCollapsed ? shortLabel : label}
      title={label}
    >
      {!iconAfter ? <span className={styles.navMorphIcon}>{icon}</span> : null}
      <span className={styles.navMorphText} aria-hidden={isCollapsed}>
        {label}
      </span>
      {iconAfter ? <span className={styles.navMorphIcon}>{icon}</span> : null}
    </button>
  );
}

function MorphingProgressSteps({
  activeIndex,
  expandProgress
}: {
  activeIndex: number;
  expandProgress: number;
}) {
  const isCollapsed = expandProgress < 0.04;
  const isExpanded = expandProgress > 0.96;
  const stateClass = isCollapsed
    ? styles.progressStepsCollapsed
    : isExpanded
      ? styles.progressStepsExpanded
      : "";

  return (
    <div
      className={`${styles.progressSteps} ${stateClass}`.trim()}
      aria-label="Прогресс по этапам"
      style={{ "--footer-expand": expandProgress } as CSSProperties}
    >
      {sidebarSteps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        return (
          <span
            key={step.label}
            className={`${styles.progressMark} ${isDone ? styles.progressMarkDone : ""} ${isActive ? styles.progressMarkActive : ""}`}
            aria-current={isActive ? "step" : undefined}
            title={step.label}
          >
            <span className={styles.progressMarkLabel}>{index + 1}</span>
          </span>
        );
      })}
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

function userName(users: ResponsibleUser[], userId?: string | null, currentUserId?: string) {
  if (!userId) return "Не указан";
  if (currentUserId && userId === currentUserId) return "Вы";
  const user = users.find((item) => item.id === userId);
  return user?.full_name || "Пользователь";
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

function formatResponsibleUserLabel(user: ResponsibleUser) {
  const name = user.full_name?.trim() || "Пользователь";
  const position = user.position?.trim();
  const department = user.department_name?.trim();
  if (position && department) return `${name} — ${position} (${department})`;
  if (position) return `${name} — ${position}`;
  if (department) return `${name} (${department})`;
  return name;
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
    admins: "Только владелец и администраторы",
    everyone: "Общий доступ",
    departments: "Выбранные подразделения",
    users: "Выбранные пользователи",
    roles: "Роли",
    mixed: "Смешанный доступ"
  };
  return labels[value];
}

function accessWarnings(mode: AccessMode, exceptionsCount: number, warningsCount: number) {
  const warnings: string[] = [];
  if (mode === "everyone") warnings.push("Проверьте, что источники не содержат ограниченных данных");
  if (exceptionsCount === 0) warnings.push("Исключения не настроены");
  if (warningsCount > 0) warnings.push("Есть предупреждения по источникам");
  if (!warnings.length) warnings.push("Критичных предупреждений нет");
  return warnings;
}
