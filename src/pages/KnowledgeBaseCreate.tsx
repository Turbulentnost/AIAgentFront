import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  LockKeyhole,
  Search,
  Settings2,
  ShieldCheck,
  Upload
} from "lucide-react";
import { agentsApi, departmentsApi, documentsApi, knowledgeBasesApi, usersApi } from "@/api/endpoints";
import type {
  Agent,
  Department,
  Document,
  DocumentType,
  KnowledgeBaseAccessType,
  KnowledgeBaseAgentAccessMode,
  KnowledgeBaseCreate,
  User
} from "@/types";
import styles from "./KnowledgeBaseCreate.module.css";

type StepId = "main" | "sources" | "readiness" | "processing" | "access" | "agents" | "preview";
type BaseKind = "normative" | "technical" | "project" | "contract" | "process";
type AccessMode = "users" | "departments" | "mixed" | "admins" | "agents";

interface ProcessingSettings {
  ocr: boolean;
  textExtraction: boolean;
  tableExtraction: boolean;
  preserveStructure: boolean;
  chunking: boolean;
  chunkSize: number;
  chunkOverlap: number;
  embeddings: boolean;
  qdrantIndexing: boolean;
  manualReview: boolean;
}

const steps: { id: StepId; label: string; hint: string }[] = [
  { id: "main", label: "Основные сведения", hint: "Информация о базе знаний" },
  { id: "sources", label: "Источники", hint: "Выбор документов и источников" },
  { id: "readiness", label: "Проверка", hint: "Готовность документов" },
  { id: "processing", label: "Обработка", hint: "Извлечение и индексация" },
  { id: "access", label: "Доступ", hint: "Пользователи и подразделения" },
  { id: "agents", label: "Агенты", hint: "Подключение ИИ-агентов" },
  { id: "preview", label: "Предпросмотр", hint: "Проверка и создание базы" }
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
  ocr: true,
  textExtraction: true,
  tableExtraction: true,
  preserveStructure: true,
  chunking: true,
  chunkSize: 800,
  chunkOverlap: 100,
  embeddings: true,
  qdrantIndexing: true,
  manualReview: true
};

export default function KnowledgeBaseCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
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

  const documents = useQuery({ queryKey: ["documents"], queryFn: documentsApi.list });
  const departments = useQuery({ queryKey: ["departments"], queryFn: departmentsApi.list });
  const users = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const agents = useQuery({ queryKey: ["agents"], queryFn: agentsApi.list });

  const activeStep = steps[stepIndex];
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
        return matchesSearch && matchesType && matchesDepartment && matchesStatus && matchesExtension;
      }),
    [documents.data, extensionFilter, sourceDepartmentFilter, sourceSearch, sourceStatusFilter, sourceTypeFilter]
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

  const canGoNext = validateStep(activeStep.id);

  function buildCreatePayload(): KnowledgeBaseCreate {
    return {
      name,
      description,
      department_id: departmentId,
      responsible_user_id: responsibleUserId,
      topic,
      process_slug: topic.toLowerCase().replace(/\s+/g, "-"),
      access_grants: buildAccessGrants(),
      source_document_ids: selectedSourceIds,
      metadata: {
        base_kind: baseKind,
        comment,
        processing_settings: processing,
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

  function validateStep(step: StepId) {
    if (step === "main") return Boolean(name.trim() && description.trim() && departmentId && responsibleUserId && baseKind);
    if (step === "sources") return selectedSourceIds.length > 0;
    if (step === "access") {
      if (accessMode === "users") return selectedUserIds.length > 0;
      if (accessMode === "departments") return selectedDepartmentIds.length > 0;
      if (accessMode === "mixed") return selectedDepartmentIds.length > 0 || selectedUserIds.length > 0;
      if (accessMode === "agents") return Object.keys(selectedAgents).length > 0;
    }
    return true;
  }

  function goNext() {
    if (canGoNext) setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  function goBack() {
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  return (
    <div className={styles.page}>
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
            <button type="button" className={styles.secondaryButton} onClick={() => createKnowledgeBase.mutate({ startIndexing: false })} disabled={!validateStep("main") || createKnowledgeBase.isPending}>
              Сохранить как черновик
            </button>
            <button type="button" className={styles.primaryButton} onClick={goNext} disabled={!canGoNext || stepIndex === steps.length - 1}>
              Далее: {steps[Math.min(stepIndex + 1, steps.length - 1)].label}
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className={styles.layout}>
        <aside className={styles.stepsCard}>
          {steps.map((step, index) => (
            <button key={step.id} type="button" className={index === stepIndex ? styles.activeStep : undefined} onClick={() => setStepIndex(index)}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.hint}</small>
              </div>
            </button>
          ))}
        </aside>

        <section className={styles.contentCard}>
          {activeStep.id === "main" && (
            <StepMain
              name={name}
              description={description}
              baseKind={baseKind}
              departmentId={departmentId}
              responsibleUserId={responsibleUserId}
              topic={topic}
              comment={comment}
              departments={departments.data ?? []}
              users={users.data ?? []}
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
              allDocuments={documents.data ?? []}
              selectedSourceIds={selectedSourceIds}
              sourceSearch={sourceSearch}
              sourceTypeFilter={sourceTypeFilter}
              sourceDepartmentFilter={sourceDepartmentFilter}
              sourceStatusFilter={sourceStatusFilter}
              extensionFilter={extensionFilter}
              departments={departments.data ?? []}
              uploadFile={uploadFile}
              uploadTitle={uploadTitle}
              uploadPending={uploadDocument.isPending}
              onSearch={setSourceSearch}
              onTypeFilter={setSourceTypeFilter}
              onDepartmentFilter={setSourceDepartmentFilter}
              onStatusFilter={setSourceStatusFilter}
              onExtensionFilter={setExtensionFilter}
              onToggleSource={(id) =>
                setSelectedSourceIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))
              }
              onUploadFile={setUploadFile}
              onUploadTitle={setUploadTitle}
              onUpload={() => uploadFile && uploadDocument.mutate()}
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
              users={users.data ?? []}
              departments={departments.data ?? []}
              selectedUserIds={selectedUserIds}
              selectedDepartmentIds={selectedDepartmentIds}
              selectedDocuments={selectedDocuments}
              onMode={setAccessMode}
              onAccessType={setAccessType}
              onIncludeChildren={setIncludeChildren}
              onReason={setAccessReason}
              onToggleUser={(id) => setSelectedUserIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))}
              onToggleDepartment={(id) => setSelectedDepartmentIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))}
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
              department={departments.data?.find((item) => item.id === departmentId)}
              responsible={users.data?.find((item) => item.id === responsibleUserId)}
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
            name={name}
            baseKind={baseKind}
            department={departments.data?.find((item) => item.id === departmentId)}
            responsible={users.data?.find((item) => item.id === responsibleUserId)}
            topic={topic}
            selectedDocuments={selectedDocuments}
            processing={processing}
            accessMode={accessMode}
            selectedAgents={selectedAgents}
            warningsCount={warnings.length}
          />
        </aside>
      </main>

      <footer className={styles.footerNav}>
        <ProgressDots activeIndex={stepIndex} />
        <div>
          <button type="button" className={styles.secondaryButton} onClick={goBack} disabled={stepIndex === 0}>
            Назад
          </button>
          {stepIndex < steps.length - 1 ? (
            <button type="button" className={styles.primaryButton} onClick={goNext} disabled={!canGoNext}>
              Далее
              <ChevronRight size={15} />
            </button>
          ) : (
            <>
              <button type="button" className={styles.secondaryButton} onClick={() => navigate("/knowledge-base")}>Отмена</button>
              <button type="button" className={styles.secondaryButton} onClick={() => createKnowledgeBase.mutate({ startIndexing: false })} disabled={createKnowledgeBase.isPending}>
                Сохранить как черновик
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => createKnowledgeBase.mutate({ startIndexing: true })} disabled={createKnowledgeBase.isPending}>
                Создать и запустить индексацию
              </button>
            </>
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
      <StepTitle icon={FilePlus2} title="Основные сведения" text="Заполните обязательные параметры базы знаний. Статус по умолчанию — «Черновик»." />
      <div className={styles.formGrid}>
        <label>
          Название базы знаний *
          <input value={props.name} onChange={(event) => props.onName(event.target.value)} placeholder="Совещания и протоколы" />
        </label>
        <label>
          Тип базы знаний *
          <select value={props.baseKind} onChange={(event) => props.onBaseKind(event.target.value as BaseKind)}>
            {Object.entries(baseKindLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className={styles.wideField}>
          Описание *
          <textarea value={props.description} onChange={(event) => props.onDescription(event.target.value)} placeholder="Для чего нужна база и какие вопросы она закрывает" />
        </label>
        <label>
          Подразделение-владелец *
          <select value={props.departmentId} onChange={(event) => props.onDepartment(event.target.value)}>
            <option value="">Выберите подразделение</option>
            {props.departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        <label>
          Ответственный *
          <select value={props.responsibleUserId} onChange={(event) => props.onResponsible(event.target.value)}>
            <option value="">Выберите пользователя</option>
            {props.users.map((user) => (
              <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
            ))}
          </select>
        </label>
        <label>
          Тематика / процесс
          <input value={props.topic} onChange={(event) => props.onTopic(event.target.value)} placeholder="Совещания" />
        </label>
        <label>
          Статус
          <input value="Черновик" readOnly />
        </label>
        <label className={styles.wideField}>
          Комментарий
          <textarea value={props.comment} onChange={(event) => props.onComment(event.target.value)} placeholder="Дополнительная информация" />
        </label>
      </div>
      <InfoCallout text="После создания базы знаний вы сможете добавить источники, настроить обработку данных, управлять доступом и подключить ИИ-агентов." />
    </div>
  );
}

function StepSources(props: {
  documents: Document[];
  allDocuments: Document[];
  selectedSourceIds: string[];
  sourceSearch: string;
  sourceTypeFilter: DocumentType | "all";
  sourceDepartmentFilter: string;
  sourceStatusFilter: string;
  extensionFilter: string;
  departments: Department[];
  uploadFile: File | null;
  uploadTitle: string;
  uploadPending: boolean;
  onSearch: (value: string) => void;
  onTypeFilter: (value: DocumentType | "all") => void;
  onDepartmentFilter: (value: string) => void;
  onStatusFilter: (value: string) => void;
  onExtensionFilter: (value: string) => void;
  onToggleSource: (id: string) => void;
  onUploadFile: (file: File | null) => void;
  onUploadTitle: (value: string) => void;
  onUpload: () => void;
}) {
  const extensions = [...new Set(props.allDocuments.map((document) => getExtension(document.original_filename)).filter(Boolean))];
  return (
    <div className={styles.stepBody}>
      <StepTitle icon={FileText} title="Выбор источников" text="Выберите один или несколько документов из раздела «Документы» или загрузите новый файл в реестр." />
      <div className={styles.sourceToolbar}>
        <label>
          <Search size={15} />
          <input value={props.sourceSearch} onChange={(event) => props.onSearch(event.target.value)} placeholder="Найти документ по названию" />
        </label>
        <select value={props.sourceTypeFilter} onChange={(event) => props.onTypeFilter(event.target.value as DocumentType | "all")}>
          <option value="all">Все типы</option>
          <option value="regulation">Регламент</option>
          <option value="contract">Договор</option>
          <option value="specification">Спецификация</option>
          <option value="other">Прочее</option>
        </select>
        <select value={props.sourceDepartmentFilter} onChange={(event) => props.onDepartmentFilter(event.target.value)}>
          <option value="all">Все подразделения</option>
          {props.departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>
        <select value={props.sourceStatusFilter} onChange={(event) => props.onStatusFilter(event.target.value)}>
          <option value="all">Все статусы</option>
          <option value="indexed">Обработан</option>
          <option value="text_extracted">Текст извлечён</option>
          <option value="uploaded">Загружен</option>
          <option value="failed">Ошибка</option>
        </select>
        <select value={props.extensionFilter} onChange={(event) => props.onExtensionFilter(event.target.value)}>
          <option value="all">Все расширения</option>
          {extensions.map((extension) => (
            <option key={extension} value={extension}>{extension}</option>
          ))}
        </select>
      </div>
      <table className={styles.sourcesTable}>
        <thead>
          <tr>
            <th />
            <th>Название документа</th>
            <th>Расширение</th>
            <th>Версия</th>
            <th>Статус</th>
            <th>Подразделение</th>
            <th>Дата актуальности</th>
            <th>Размер</th>
            <th>Доступ</th>
            <th>Агенты</th>
          </tr>
        </thead>
        <tbody>
          {props.documents.map((document) => (
            <tr key={document.id}>
              <td>
                <input type="checkbox" checked={props.selectedSourceIds.includes(document.id)} onChange={() => props.onToggleSource(document.id)} />
              </td>
              <td>
                <strong>{document.title}</strong>
                <small>{document.original_filename}</small>
              </td>
              <td>{getExtension(document.original_filename) || "-"}</td>
              <td>{document.version || "1.0"}</td>
              <td>{documentStatusLabel(document)}</td>
              <td>{departmentName(props.departments, document.department_id)}</td>
              <td>{document.metadata?.actual_until ? String(document.metadata.actual_until) : "31.12.2026"}</td>
              <td>{formatBytes(document.file_size)}</td>
              <td>{document.metadata?.access_scope ? String(document.metadata.access_scope) : "По подразделению"}</td>
              <td>Будет задано на шаге 6</td>
            </tr>
          ))}
          {!props.documents.length && (
            <tr>
              <td colSpan={10} className={styles.emptyCell}>Документы не найдены.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className={styles.uploadBox}>
        <Upload size={18} />
        <div>
          <strong>Загрузить новый документ</strong>
          <p>Файл сначала попадёт в раздел «Документы», получит статус обработки, а затем будет выбран источником базы знаний.</p>
        </div>
        <input value={props.uploadTitle} onChange={(event) => props.onUploadTitle(event.target.value)} placeholder="Название документа" />
        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={(event) => props.onUploadFile(event.target.files?.[0] ?? null)} />
        <button type="button" className={styles.secondaryButton} onClick={props.onUpload} disabled={!props.uploadFile || props.uploadPending}>
          {props.uploadPending ? "Загружаем..." : "Загрузить и выбрать"}
        </button>
      </div>
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
  const toggles: [keyof ProcessingSettings, string, string][] = [
    ["ocr", "OCR", "Распознавание сканов и изображений"],
    ["textExtraction", "Извлечение текста", "Получение текста из PDF, DOCX, PPTX"],
    ["tableExtraction", "Извлечение таблиц", "Получение таблиц из PDF, DOCX, XLSX"],
    ["preserveStructure", "Сохранение структуры", "Разделы, пункты, заголовки, страницы"],
    ["chunking", "Разбиение на chunks", "Создание фрагментов для RAG"],
    ["embeddings", "Создание embeddings", "Векторизация фрагментов"],
    ["qdrantIndexing", "Индексация в Qdrant", "Запись в векторное хранилище"],
    ["manualReview", "Ручная проверка перед публикацией", "Допуск агентов только после проверки"]
  ];
  return (
    <div className={styles.stepBody}>
      <StepTitle icon={Settings2} title="Настройка обработки и индексации" text="Определите, как документы будут извлекаться, дробиться на фрагменты и индексироваться." />
      <div className={styles.processingGrid}>
        {toggles.map(([key, title, text]) => (
          <label key={key} className={styles.toggleCard}>
            <input
              type="checkbox"
              checked={Boolean(settings[key])}
              onChange={(event) => onChange({ ...settings, [key]: event.target.checked })}
            />
            <span>
              <strong>{title}</strong>
              <small>{text}</small>
            </span>
          </label>
        ))}
        <label>
          Размер chunk
          <input type="number" min={100} max={4000} value={settings.chunkSize} onChange={(event) => onChange({ ...settings, chunkSize: Number(event.target.value) })} />
        </label>
        <label>
          Перекрытие chunk
          <input type="number" min={0} max={1000} value={settings.chunkOverlap} onChange={(event) => onChange({ ...settings, chunkOverlap: Number(event.target.value) })} />
        </label>
      </div>
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
        />
      )}
      {props.selectedDocuments.length > 0 && (
        <WarningCallout text="Если пользователь имеет доступ к базе, но не имеет доступа к части документов-источников, агент и поиск будут использовать только разрешённые для него фрагменты." />
      )}
    </div>
  );
}

function StepAgents({ agents, selectedAgents, onChange }: { agents: Agent[]; selectedAgents: Record<string, KnowledgeBaseAgentAccessMode>; onChange: (value: Record<string, KnowledgeBaseAgentAccessMode>) => void }) {
  return (
    <div className={styles.stepBody}>
      <StepTitle icon={Bot} title="Подключение ИИ-агентов" text="Выберите агентов и режим использования базы. Агент всё равно увидит только фрагменты, доступные пользователю." />
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
        <SummaryBlock title="Основные сведения" rows={[["Название", props.name], ["Описание", props.description], ["Тип", baseKindLabels[props.baseKind]], ["Подразделение", props.department?.name || "-"], ["Ответственный", props.responsible?.full_name || props.responsible?.email || "-"], ["Тематика", props.topic || "-"]]} />
        <SummaryBlock title="Источники" rows={[["Документов", String(props.selectedDocuments.length)], ...props.selectedDocuments.slice(0, 5).map((document) => [document.title, getExtension(document.original_filename) || "-"] as [string, string])]} />
        <SummaryBlock title="Обработка" rows={[["OCR", yesNo(props.processing.ocr)], ["Chunks", `${props.processing.chunkSize} / overlap ${props.processing.chunkOverlap}`], ["Embeddings", yesNo(props.processing.embeddings)], ["Qdrant", yesNo(props.processing.qdrantIndexing)], ["Ручная проверка", yesNo(props.processing.manualReview)]]} />
        <SummaryBlock title="Доступ" rows={[["Режим", accessModeLabel(props.accessMode)], ["Пользователей", String(props.selectedUserIds.length)], ["Подразделений", String(props.selectedDepartmentIds.length)]]} />
        <SummaryBlock title="Агенты" rows={[["Подключено", String(Object.keys(props.selectedAgents).length)], ...Object.values(props.selectedAgents).slice(0, 4).map((mode, index) => [`Агент ${index + 1}`, agentModeLabels[mode]] as [string, string])]} />
        <SummaryBlock title="Предупреждения" rows={props.warnings.length ? props.warnings.map((warning) => [warning.document.title, warning.message] as [string, string]) : [["Ошибки", "Нет критичных предупреждений"]]} />
      </div>
    </div>
  );
}

function Summary(props: {
  name: string;
  baseKind: BaseKind;
  department?: Department;
  responsible?: User;
  topic: string;
  selectedDocuments: Document[];
  processing: ProcessingSettings;
  accessMode: AccessMode;
  selectedAgents: Record<string, KnowledgeBaseAgentAccessMode>;
  warningsCount: number;
}) {
  return (
    <div>
      <h2>Сводка создаваемой базы</h2>
      <SummaryBlock title="Основные сведения" rows={[["Название", props.name || "Не заполнено"], ["Тип", baseKindLabels[props.baseKind]], ["Тематика", props.topic || "-"], ["Подразделение", props.department?.name || "Не выбрано"], ["Ответственный", props.responsible?.full_name || props.responsible?.email || "Не выбран"]]} />
      <SummaryBlock title="Источники" rows={[["Документы", String(props.selectedDocuments.length)], ["Фрагментов (прогноз)", String(props.selectedDocuments.length * 120)]]} />
      <SummaryBlock title="Обработка" rows={[["OCR", yesNo(props.processing.ocr)], ["Извлечение таблиц", yesNo(props.processing.tableExtraction)], ["Размер chunk", `${props.processing.chunkSize} токенов`], ["Векторное хранилище", "Qdrant"]]} />
      <SummaryBlock title="Доступ" rows={[["Тип доступа", accessModeLabel(props.accessMode)], ["Предупреждения", String(props.warningsCount)]]} />
      <SummaryBlock title="Агенты" rows={[["Подключено агентов", String(Object.keys(props.selectedAgents).length)]]} />
      {props.warningsCount > 0 && <WarningCallout text="База знаний будет доступна агентам только после завершения индексации и настройки прав доступа." />}
    </div>
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

function SelectableList({ title, items, selectedIds, onToggle }: { title: string; items: { id: string; title: string; subtitle: string }[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  return (
    <section className={styles.selectableList}>
      <h3>{title}</h3>
      <div>
        {items.map((item) => (
          <label key={item.id}>
            <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

function SummaryBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className={styles.summaryBlock}>
      <h3>{title}</h3>
      {rows.map(([label, value]) => (
        <div key={`${title}-${label}`}>
          <span>{label}</span>
          <strong>{value || "-"}</strong>
        </div>
      ))}
    </section>
  );
}

function ProgressDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className={styles.progressDots}>
      {steps.map((step, index) => (
        <span key={step.id} className={index <= activeIndex ? styles.doneDot : undefined}>{index + 1}</span>
      ))}
    </div>
  );
}

function InfoCallout({ text }: { text: string }) {
  return <div className={styles.infoCallout}>{text}</div>;
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

function formatBytes(value?: number | null) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 / 1024).toFixed(2)} МБ`;
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
