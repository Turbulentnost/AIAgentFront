import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Filter,
  HardDrive,
  Layers3,
  LockKeyhole,
  Circle,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Square,
  SquareArrowOutUpRight,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { agentsApi, knowledgeBasesApi } from "@/api/endpoints";
import { useKnowledgeBaseIndexingWs } from "@/hooks/useKnowledgeBaseIndexingWs";
import type {
  KnowledgeBase,
  KnowledgeBaseAccessGrantInput,
  KnowledgeBaseAccessType,
  KnowledgeBaseAgentBinding,
  KnowledgeBaseChunk,
  KnowledgeBaseIndexingError,
  KnowledgeBaseIndexingJob,
  KnowledgeBaseListItem,
  KnowledgeBaseRule,
  KnowledgeBaseSearchHit,
  KnowledgeBaseSource,
  KnowledgeBaseStats,
  KnowledgeBaseStatus
} from "@/types";
import styles from "./KnowledgeBase.module.css";

type DetailTab = "overview" | "sources" | "chunks" | "rules" | "access" | "agents" | "indexing" | "test" | "audit";

const tabs: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "sources", label: "Источники" },
  { id: "chunks", label: "Фрагменты" },
  { id: "rules", label: "Правила и связи" },
  { id: "access", label: "Доступ" },
  { id: "agents", label: "Агенты" },
  { id: "indexing", label: "Индексация" },
  { id: "test", label: "Тест поиска" },
  { id: "audit", label: "Журнал" }
];

const statusLabels: Record<KnowledgeBaseStatus, string> = {
  draft: "Черновик",
  processing: "На обработке",
  needs_review: "Требует проверки",
  ready: "Готова",
  updating: "Обновляется",
  error: "Ошибка",
  archived: "Архив"
};

const jobStatusLabels: Record<KnowledgeBaseIndexingJob["status"], string> = {
  queued: "В очереди",
  running: "Выполняется",
  completed: "Завершено",
  failed: "Ошибка",
  partial: "Частично",
  cancelled: "Остановлена",
  CANCELLED: "Остановлена"
};

const indexingStageLabels: Record<string, string> = {
  precheck: "Проверка источников",
  text_extraction: "Извлечение текста и структуры",
  chunking: "Разбиение на фрагменты",
  embeddings: "Создание embeddings",
  qdrant: "Индексация в Qdrant",
  fulltext: "Полнотекстовый индекс",
  quality_control: "Контроль качества",
  stopping: "Остановка запрошена",
  stopped: "Остановлена"
};

const jobTypeLabels: Record<KnowledgeBaseIndexingJob["job_type"], string> = {
  full: "Полная индексация",
  source: "Источник",
  chunk: "Фрагмент",
  embeddings: "Embeddings",
  access_reindex: "Переиндексация доступа"
};

const sourceStatusLabels: Record<string, string> = {
  draft: "Черновик",
  processing: "Индексация",
  needs_review: "Требует проверки",
  ready: "Готово",
  updating: "Обновляется",
  error: "Ошибка",
  archived: "Архив",
  excluded: "Исключён",
  needs_ocr: "Требует OCR",
  ready_to_index: "Готов к обработке"
};

const qualityLabels: Record<string, string> = {
  unknown: "Неизвестно",
  good: "Хорошее",
  medium: "Среднее",
  low: "Низкое",
  failed: "Ошибка"
};

const granteeTypeLabels: Record<string, string> = {
  user: "Пользователь",
  department: "Подразделение",
  organization: "Организация",
  role: "Роль",
  agent: "Агент",
  admin_only: "Только администраторы"
};

const auditActionLabels: Record<string, string> = {
  "kb.created": "Создание базы",
  "kb.source_added": "Добавление источника",
  "kb.source_removed": "Удаление источника",
  "kb.source_excluded": "Исключение источника",
  "kb.index_started": "Запуск индексации",
  "kb.test_search": "Тестовый поиск",
  "kb.access_updated": "Изменение доступа",
  "kb.agents_replaced": "Подключение агентов",
  "kb.archived": "Архивация базы"
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

export default function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<KnowledgeBaseStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const stats = useQuery({ queryKey: ["knowledge-bases", "stats"], queryFn: knowledgeBasesApi.stats });
  const knowledgeBases = useQuery({
    queryKey: ["knowledge-bases", statusFilter, searchQuery],
    queryFn: () =>
      knowledgeBasesApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        query: searchQuery || undefined
      })
  });
  const hasActiveIndexingInList = useMemo(
    () => (knowledgeBases.data ?? []).some((item) => item.indexing_active),
    [knowledgeBases.data]
  );

  const selected = useMemo(() => {
    const items = knowledgeBases.data ?? [];
    const requested = items.find((item) => item.id === selectedId);
    if (requested?.can_access) return requested;
    return items.find((item) => item.can_access) ?? null;
  }, [knowledgeBases.data, selectedId]);

  useEffect(() => {
    const requestedId = searchParams.get("kb");
    const items = knowledgeBases.data ?? [];
    if (requestedId) {
      const requested = items.find((item) => item.id === requestedId);
      if (requested?.can_access) {
        setSelectedId(requestedId);
        return;
      }
    }
    if (!selectedId || !items.find((item) => item.id === selectedId && item.can_access)) {
      const firstAccessible = items.find((item) => item.can_access);
      if (firstAccessible) setSelectedId(firstAccessible.id);
    }
  }, [knowledgeBases.data, searchParams, selectedId]);

  useEffect(() => {
    if (!hasActiveIndexingInList) return;
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [hasActiveIndexingInList, queryClient]);

  const canViewSelected = Boolean(selected?.can_access);

  const sources = useQuery({
    queryKey: ["knowledge-base-sources", selected?.id],
    queryFn: () => knowledgeBasesApi.sources(selected!.id),
    enabled: canViewSelected
  });
  const chunks = useQuery({
    queryKey: ["knowledge-base-chunks", selected?.id],
    queryFn: () => knowledgeBasesApi.chunks(selected!.id),
    enabled: canViewSelected
  });
  const rules = useQuery({
    queryKey: ["knowledge-base-rules", selected?.id],
    queryFn: () => knowledgeBasesApi.rules(selected!.id),
    enabled: canViewSelected
  });
  const agents = useQuery({
    queryKey: ["knowledge-base-agents", selected?.id],
    queryFn: () => knowledgeBasesApi.agents(selected!.id),
    enabled: canViewSelected
  });
  const jobs = useQuery({
    queryKey: ["knowledge-base-jobs", selected?.id],
    queryFn: () => knowledgeBasesApi.jobs(selected!.id),
    enabled: canViewSelected
  });

  const latestJob = jobs.data?.[0] ?? null;
  const isIndexingActive = Boolean(
    selected &&
      (selected.indexing_active ||
        selected.status === "processing" ||
        selected.status === "updating" ||
        latestJob?.status === "queued" ||
        latestJob?.status === "running")
  );

  useKnowledgeBaseIndexingWs(selected?.id, Boolean(canViewSelected && isIndexingActive));

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab && tabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab as DetailTab);
    }
  }, [searchParams]);

  const access = useQuery({
    queryKey: ["knowledge-base-access", selected?.id],
    queryFn: () => knowledgeBasesApi.access(selected!.id),
    enabled: canViewSelected
  });
  const audit = useQuery({
    queryKey: ["knowledge-base-audit", selected?.id],
    queryFn: () => knowledgeBasesApi.audit(selected!.id),
    enabled: canViewSelected
  });

  const cancelIndexing = useMutation({
    mutationFn: (knowledgeBaseId: string) =>
      knowledgeBasesApi.cancelIndexing(knowledgeBaseId, {
        reason: "Остановка по запросу пользователя",
        force: true
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      if (selected?.id) {
        await queryClient.invalidateQueries({ queryKey: ["knowledge-base-jobs", selected.id] });
      }
    }
  });

  const startIndexing = useMutation({
    mutationFn: (knowledgeBaseId: string) => knowledgeBasesApi.index(knowledgeBaseId, { job_type: "full" }),
    onSuccess: async () => {
      setActiveTab("indexing");
      await queryClient.invalidateQueries({ queryKey: ["knowledge-base-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });

  const deleteKnowledgeBase = useMutation({
    mutationFn: (knowledgeBaseId: string) => knowledgeBasesApi.delete(knowledgeBaseId),
    onSuccess: async () => {
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases", "stats"] });
    }
  });

  function handleDeleteKnowledgeBase(knowledgeBase: KnowledgeBaseListItem) {
    const confirmed = window.confirm(
      `Удалить базу знаний "${knowledgeBase.name}"? Она будет перенесена в архив.`
    );
    if (!confirmed) return;
    deleteKnowledgeBase.mutate(knowledgeBase.id);
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <h1>База знаний</h1>
          <p>
            Управление обработанными знаниями для ИИ-агентов: источники, chunks, embeddings, доступ,
            индексация и проверяемый RAG-поиск.
          </p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={() => navigate("/knowledge-base/create")}>
          <Plus size={16} />
          Создать базу знаний
        </button>
      </section>

      <StatsGrid stats={stats.data} />

      <section className={styles.workspace}>
        <div className={styles.listPanel}>
          <div className={styles.filters}>
            <label>
              <Search size={15} />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Поиск базы знаний" />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as KnowledgeBaseStatus | "all")}>
              <option value="all">Все статусы</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" className={styles.secondaryButton}>
              <Filter size={15} />
              Фильтры
            </button>
          </div>

          <table className={styles.kbTable}>
            <thead>
              <tr>
                <th>Название базы знаний</th>
                <th>Источники</th>
                <th>Фрагменты</th>
                <th>Статус</th>
                <th>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {(knowledgeBases.data ?? []).map((item) => {
                const isDisabled = !item.can_access;
                const isSelected = selected?.id === item.id;
                return (
                  <tr
                    key={item.id}
                    className={[
                      isSelected ? styles.selectedRow : "",
                      isDisabled ? styles.disabledRow : "",
                      item.indexing_active ? styles.indexingRow : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      if (isDisabled) return;
                      setSelectedId(item.id);
                      setActiveTab("overview");
                    }}
                    aria-disabled={isDisabled}
                    title={isDisabled ? "Нет доступа к этой базе знаний" : undefined}
                  >
                    <td>
                      <strong>{item.name}</strong>
                      <small>
                        {isDisabled
                          ? "Нет доступа"
                          : item.description || item.topic || "Описание не задано"}
                      </small>
                    </td>
                    <td>{isDisabled ? "—" : item.sources_count}</td>
                    <td>{isDisabled ? "—" : formatNumber(item.fragments_count)}</td>
                    <td>
                      <StatusBadge status={item.status} indexing={item.indexing_active} />
                    </td>
                    <td>{formatDate(item.updated_at)}</td>
                  </tr>
                );
              })}
              {!knowledgeBases.data?.length && (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>
                    Базы знаний пока не созданы.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className={styles.detailPanel}>
          {selected ? (
            <>
              {isIndexingActive ? (
                <div className={styles.indexingBanner}>
                  <RefreshCw size={16} className={styles.indexingSpinner} />
                  <div>
                    <strong>
                      {latestJob?.cancel_requested ? "Остановка индексации запрошена" : "Идёт индексация базы знаний"}
                    </strong>
                    <span>
                      {latestJob
                        ? `${indexingStageLabels[String(latestJob.processing_params?.current_stage ?? "")] || "Подготовка"} · ${jobStatusLabels[latestJob.status] ?? latestJob.status}`
                        : "Подготовка документов, создание embeddings и запись в Qdrant"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => selected && cancelIndexing.mutate(selected.id)}
                    disabled={cancelIndexing.isPending}
                  >
                    <Square size={14} />
                    Остановить
                  </button>
                </div>
              ) : null}
              <div className={styles.detailHeader}>
                <div>
                  <h2>{selected.name}</h2>
                  <StatusBadge status={selected.status} indexing={selected.indexing_active} />
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => startIndexing.mutate(selected.id)}
                  disabled={startIndexing.isPending || selected.indexing_active}
                  title="Запустить переиндексацию"
                >
                  <RefreshCw size={17} />
                </button>
                {selected.can_delete ? (
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.dangerButton}`}
                    onClick={() => handleDeleteKnowledgeBase(selected)}
                    disabled={deleteKnowledgeBase.isPending || selected.indexing_active}
                    title="Удалить базу знаний"
                  >
                    <Trash2 size={17} />
                  </button>
                ) : null}
              </div>
              <KnowledgeBaseQuickSearch
                knowledgeBase={selected}
                onOpenFullSearch={() => setActiveTab("test")}
              />
              <nav className={styles.tabs}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeTab === tab.id ? styles.activeTab : undefined}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              <DetailTabContent
                tab={activeTab}
                knowledgeBase={selected}
                sources={sources.data ?? []}
                chunks={chunks.data ?? []}
                rules={rules.data ?? []}
                agents={agents.data ?? []}
                jobs={jobs.data ?? []}
                latestJob={latestJob}
                isIndexingActive={isIndexingActive}
                accessGrants={access.data?.grants ?? []}
                accessExceptions={access.data?.exceptions ?? []}
                audit={audit.data ?? []}
                onTabChange={setActiveTab}
              />
            </>
          ) : (
            <div className={styles.emptyState}>Выберите базу знаний или создайте новую.</div>
          )}
        </aside>
      </section>

      <Pipeline />
    </div>
  );
}

function StatsGrid({ stats }: { stats?: KnowledgeBaseStats }) {
  const cards = [
    {
      label: "Всего баз знаний",
      value: stats?.total_bases ?? 0,
      hint: "Доступных для просмотра и использования",
      icon: Database,
      tone: "blue"
    },
    {
      label: "Ошибки индексации",
      value: stats?.indexing_errors_count ?? 0,
      hint: "Нерешённых по доступным базам",
      icon: TriangleAlert,
      tone: "orange"
    },
    {
      label: "Общий размер",
      value: formatBytes(stats?.storage_bytes ?? 0),
      hint: "Суммарный объём данных",
      icon: HardDrive,
      tone: "violet"
    },
    {
      label: "Успешная индексация",
      value: stats?.successfully_indexed_bases ?? 0,
      hint: "Баз со статусом «Готова»",
      icon: CheckCircle2,
      tone: "green"
    }
  ];
  return (
    <section className={styles.statsGrid}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.label} className={styles.statCard}>
            <span className={`${styles.statIcon} ${styles[card.tone]}`}>
              <Icon size={22} />
            </span>
            <div>
              <small>{card.label}</small>
              <strong>{typeof card.value === "number" ? formatNumber(card.value) : card.value}</strong>
              <span>{card.hint}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function DetailTabContent(props: {
  tab: DetailTab;
  knowledgeBase: KnowledgeBaseListItem;
  sources: KnowledgeBaseSource[];
  chunks: KnowledgeBaseChunk[];
  rules: KnowledgeBaseRule[];
  agents: KnowledgeBaseAgentBinding[];
  jobs: KnowledgeBaseIndexingJob[];
  latestJob: KnowledgeBaseIndexingJob | null;
  isIndexingActive: boolean;
  accessGrants: KnowledgeBaseAccessGrantInput[];
  accessExceptions: KnowledgeBaseAccessGrantInput[];
  audit: Record<string, unknown>[];
  onTabChange: (tab: DetailTab) => void;
}) {
  const queryClient = useQueryClient();
  const {
    tab,
    knowledgeBase,
    sources,
    chunks,
    rules,
    agents,
    jobs,
    latestJob,
    isIndexingActive,
    accessGrants,
    accessExceptions,
    audit,
    onTabChange
  } = props;

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [chunkFilter, setChunkFilter] = useState<"all" | "excluded" | "errors" | "ocr">("all");
  const [newRuleText, setNewRuleText] = useState("");

  const overview = useQuery({
    queryKey: ["knowledge-base-overview", knowledgeBase.id],
    queryFn: () => knowledgeBasesApi.overview(knowledgeBase.id),
    enabled: tab === "overview" || tab === "test"
  });
  const readiness = useQuery({
    queryKey: ["knowledge-base-readiness", knowledgeBase.id],
    queryFn: () => knowledgeBasesApi.readiness(knowledgeBase.id),
    enabled: tab === "test"
  });
  const platformAgents = useQuery({
    queryKey: ["agents"],
    queryFn: agentsApi.list,
    enabled: tab === "agents"
  });
  const activeJob = jobs.find((job) => job.status === "running" || job.status === "queued") ?? latestJob;
  const jobErrors = useQuery({
    queryKey: ["knowledge-base-job-errors", activeJob?.id],
    queryFn: () => knowledgeBasesApi.jobErrors(activeJob!.id),
    enabled: tab === "indexing" && Boolean(activeJob?.id)
  });

  const retryError = useMutation({
    mutationFn: (errorId: string) => knowledgeBasesApi.retryIndexingError(errorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-base-jobs"] });
      onTabChange("indexing");
    }
  });
  const excludeSource = useMutation({
    mutationFn: (sourceId: string) => knowledgeBasesApi.excludeSource(knowledgeBase.id, sourceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources"] })
  });
  const reindexSource = useMutation({
    mutationFn: (sourceId: string) => knowledgeBasesApi.reindexSource(knowledgeBase.id, sourceId),
    onSuccess: () => {
      onTabChange("indexing");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-base-jobs"] });
    }
  });
  const deleteSource = useMutation({
    mutationFn: (sourceId: string) => knowledgeBasesApi.deleteSource(knowledgeBase.id, sourceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources"] })
  });
  const excludeChunk = useMutation({
    mutationFn: ({ chunkId, excluded }: { chunkId: string; excluded: boolean }) =>
      knowledgeBasesApi.excludeChunk(knowledgeBase.id, chunkId, {
        is_excluded_from_search: excluded,
        exclusion_reason: excluded ? "Исключён вручную" : null
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["knowledge-base-chunks"] })
  });
  const createRule = useMutation({
    mutationFn: (text: string) => knowledgeBasesApi.createRule(knowledgeBase.id, { text, priority: 100, status: "draft" }),
    onSuccess: () => {
      setNewRuleText("");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-base-rules"] });
    }
  });

  const canTestSearch =
    ["needs_review", "ready", "error", "updating", "processing"].includes(knowledgeBase.status) &&
    !(isIndexingActive && (knowledgeBase.fragments_count ?? 0) === 0);
  const testSearchPlaceholder = testSearchPlaceholderText(knowledgeBase, isIndexingActive);
  const selectedSource = sources.find((s) => s.id === selectedSourceId) ?? null;
  const filteredChunks = chunks.filter((chunk) => {
    if (chunkFilter === "excluded") return chunk.is_excluded_from_search;
    if (chunkFilter === "errors") return chunk.embedding_status === "failed" || chunk.quality_status === "low" || chunk.quality_status === "failed";
    if (chunkFilter === "ocr") return chunk.fragment_type === "ocr" || chunk.embedding_status === "pending";
    return true;
  });

  if (tab === "overview") {
    const stats = overview.data;
    return (
      <div className={styles.detailBody}>
        <div className={styles.statusCallout}>{statusCalloutText(knowledgeBase)}</div>
        <InfoGrid
          items={[
            ["Название", knowledgeBase.name],
            ["Описание", knowledgeBase.description || "-"],
            ["Тематика / процесс", knowledgeBase.topic || knowledgeBase.process_slug || "-"],
            ["Embedding-модель", knowledgeBase.embedding_model || "-"],
            ["Последняя индексация", formatDate(knowledgeBase.last_indexed_at)]
          ]}
        />
        {stats ? (
          <InfoGrid
            items={[
              ["Источников", `${stats.sources_processed} / ${stats.sources_total}`],
              ["С ошибками", stats.sources_with_errors],
              ["Фрагментов", formatNumber(stats.fragments_total)],
              ["В Qdrant", formatNumber(stats.qdrant_points)],
              ["В полнотекстовом индексе", formatNumber(stats.fulltext_chunks)],
              ["Качество извлечения", `${stats.quality_percent}%`],
              ["Нерешённых ошибок", stats.unresolved_errors]
            ]}
          />
        ) : null}
        <div className={styles.securityCallout}>
          <ShieldCheck size={18} />
          <span>
            Поиск доступен агенту только если база готова, агент явно подключён, пользователь имеет право на фрагменты,
            документ не архивирован и срок доступа не истёк.
          </span>
        </div>
      </div>
    );
  }

  if (tab === "sources") {
    return (
      <div className={styles.detailBody}>
        <CompactTable
          headers={["Документ", "Тип", "Статус", "Фрагменты", "Качество", "Действия"]}
          rows={sources.map((source) => [
            source.document_title || source.original_filename || source.document_id,
            source.extension || "-",
            sourceStatusLabels[source.processing_status] ?? source.processing_status,
            formatNumber(source.fragments_count),
            qualityLabels[source.quality_status ?? "unknown"] ?? "-",
            <SourceActions
              key={source.id}
              source={source}
              onView={() => setSelectedSourceId(source.id)}
              onExclude={() => excludeSource.mutate(source.id)}
              onReindex={() => reindexSource.mutate(source.id)}
              onDelete={() => deleteSource.mutate(source.id)}
            />
          ])}
          empty="Источники ещё не добавлены."
        />
        {selectedSource ? (
          <article className={styles.sourceDetailCard}>
            <h4>{selectedSource.document_title || selectedSource.original_filename}</h4>
            <p>Версия: {selectedSource.document_version_id}</p>
            <p>Страниц: {selectedSource.pages_count ?? "-"} · Фрагментов: {selectedSource.fragments_count}</p>
            <p>Статус: {sourceStatusLabels[selectedSource.processing_status] ?? selectedSource.processing_status}</p>
            <p>OCR: {selectedSource.processing_status === "needs_ocr" ? "требуется" : "не требовался"}</p>
            <p>Ошибки: {selectedSource.precheck_notes || "нет"}</p>
          </article>
        ) : null}
      </div>
    );
  }

  if (tab === "chunks") {
    return (
      <div className={styles.detailBody}>
        <div className={styles.chunkFilters}>
          {(["all", "excluded", "errors", "ocr"] as const).map((value) => (
            <button key={value} type="button" className={chunkFilter === value ? styles.activeTab : undefined} onClick={() => setChunkFilter(value)}>
              {value === "all" ? "Все" : value === "excluded" ? "Исключённые" : value === "errors" ? "Ошибки" : "OCR"}
            </button>
          ))}
        </div>
        <div className={styles.chunkList}>
          {filteredChunks.map((chunk) => (
            <article key={chunk.id} className={styles.chunkCard}>
              <header>
                <strong>{chunk.document_title || "Источник не найден"}</strong>
                <span>{chunk.embedding_status} · {qualityLabels[chunk.quality_status ?? "unknown"]}</span>
              </header>
              <p>{chunk.text || "Текст фрагмента недоступен"}</p>
              <small>
                Пункт {chunk.clause_number || "-"} · Тип {chunk.fragment_type || "-"} · Страница {chunk.page_number ?? "-"} · Раздел {chunk.section_title || "-"}
              </small>
              <div className={styles.chunkActions}>
                <button type="button" onClick={() => excludeChunk.mutate({ chunkId: chunk.id, excluded: !chunk.is_excluded_from_search })}>
                  {chunk.is_excluded_from_search ? "Вернуть в поиск" : "Исключить из поиска"}
                </button>
              </div>
            </article>
          ))}
          {!filteredChunks.length && <div className={styles.emptyState}>Фрагменты появятся после индексации источников.</div>}
        </div>
      </div>
    );
  }

  if (tab === "rules") {
    return (
      <div className={styles.detailBody}>
        <form
          className={styles.ruleForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (newRuleText.trim()) createRule.mutate(newRuleText.trim());
          }}
        >
          <input value={newRuleText} onChange={(e) => setNewRuleText(e.target.value)} placeholder="Текст нового правила" />
          <button type="submit" disabled={createRule.isPending}>Добавить правило</button>
        </form>
        <CompactTable
          headers={["Правило", "Область", "Условие", "Действие", "Приоритет", "Статус"]}
          rows={rules.map((rule) => [rule.text, rule.scope || "-", rule.condition || "-", rule.agent_action || "-", rule.priority, rule.status])}
          empty="Структурированные правила для агентов ещё не заведены."
        />
      </div>
    );
  }

  if (tab === "access") {
    return (
      <div className={styles.detailBody}>
        <CompactTable
          headers={["Тип", "Субъект", "Уровень", "Основание", "Срок"]}
          rows={accessGrants.map((grant, index) => [
            granteeTypeLabels[grant.grantee_type] ?? grant.grantee_type,
            grant.grantee_id || "—",
            accessLabels[grant.access_type],
            grant.reason || "-",
            formatDate(grant.expires_at)
          ])}
          empty="Доступ не настроен."
        />
        {accessExceptions.length > 0 ? (
          <>
            <h3 className={styles.sectionTitle}>Исключения</h3>
            <CompactTable
              headers={["Тип", "Субъект", "Уровень", "Основание"]}
              rows={accessExceptions.map((item, index) => [
                granteeTypeLabels[item.grantee_type] ?? item.grantee_type,
                item.grantee_id || "—",
                accessLabels[item.access_type],
                item.reason || "Запрет доступа"
              ])}
              empty=""
            />
          </>
        ) : null}
      </div>
    );
  }

  if (tab === "agents") {
    const agentNameById = new Map((platformAgents.data ?? []).map((agent) => [agent.id, agent.name]));
    return (
      <CompactTable
        headers={["Агент", "Режим", "Статус", "Срок"]}
        rows={agents.map((agent) => [
          agentNameById.get(agent.agent_id) || agent.agent_id,
          agent.access_mode,
          agent.is_enabled ? "Включён" : "Отключён",
          formatDate(agent.expires_at)
        ])}
        empty="Ни один агент не подключён к базе знаний."
      />
    );
  }

  if (tab === "indexing") {
    const jobHistory = jobs.filter(
      (job) =>
        !(
          job.status === "queued" &&
          job.processed_sources_count === 0 &&
          job.created_fragments_count === 0 &&
          job.updated_fragments_count === 0 &&
          job.errors_count === 0
        )
    );
    const progressJob = activeJob && (activeJob.status === "running" || activeJob.status === "queued") ? activeJob : null;
    const totalSources = progressJob?.total_sources_count || sources.length || 1;
    const totalChunks = progressJob?.total_chunks_count || knowledgeBase.fragments_count || 1;
    const stages = buildIndexingStages(progressJob, totalSources, totalChunks);
    const params = progressJob?.processing_params ?? latestJob?.processing_params ?? {};

    return (
      <div className={styles.indexingLayout}>
        <section className={styles.indexingMainColumn}>
          {progressJob ? (
            <article className={styles.indexingProgressCard}>
              <header className={styles.indexingProgressHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Текущая индексация</h3>
                  <p className={styles.indexingProgressMeta}>
                    {progressJob.cancel_requested
                      ? "Остановка запрошена — завершение текущего этапа"
                      : `${jobTypeLabels[progressJob.job_type] ?? progressJob.job_type} · ${jobStatusLabels[progressJob.status]}`}
                  </p>
                </div>
                <span className={styles.indexingDuration}>
                  {formatJobDuration(progressJob)}
                </span>
              </header>
              <div className={styles.progressBars}>
                <div>
                  <span>Источники: {progressJob.processed_sources_count} / {totalSources}</span>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${percent(progressJob.processed_sources_count, totalSources)}%` }} />
                  </div>
                </div>
                <div>
                  <span>Фрагменты: {progressJob.embedded_chunks_count ?? 0} / {totalChunks}</span>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${percent(progressJob.embedded_chunks_count ?? 0, totalChunks)}%` }} />
                  </div>
                </div>
              </div>
              <ul className={styles.indexingPipeline}>
                {stages.map((stage) => (
                  <li key={stage.id} className={styles[`pipeline_${stage.status}`]}>
                    {stage.status === "done" ? <CheckCircle2 size={16} /> : stage.status === "running" ? <RefreshCw size={16} className={styles.indexingSpinner} /> : <Circle size={16} />}
                    <div>
                      <strong>{stage.label}</strong>
                      {stage.detail ? <span>{stage.detail}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ) : (
            <div className={styles.emptyState}>Активная индексация не выполняется. Запустите обработку источников.</div>
          )}
          <h3 className={styles.sectionTitle}>По файлам</h3>
          <CompactTable
            headers={["Файл", "Статус", "Чанков", "Embeddings", "Последняя индексация"]}
            rows={sources.map((source) => {
              const sourceChunks = chunks.filter((chunk) => chunk.source_id === source.id);
              const chunkTotal = sourceChunks.length || source.fragments_count;
              const indexedCount = sourceChunks.filter((chunk) => chunk.embedding_status === "indexed").length;
              let embeddingLabel = "—";
              if (chunkTotal > 0 && indexedCount === chunkTotal) embeddingLabel = `Готово (${indexedCount})`;
              else if (indexedCount > 0) embeddingLabel = `${indexedCount} из ${chunkTotal}`;
              else if (source.processing_status === "processing") embeddingLabel = "В процессе";
              else if (source.processing_status === "error") embeddingLabel = "Ошибка";
              return [
                source.document_title || source.original_filename || source.document_id,
                sourceStatusLabels[source.processing_status] ?? source.processing_status,
                formatNumber(chunkTotal),
                embeddingLabel,
                formatDate(source.last_indexed_at)
              ];
            })}
            empty="Источники ещё не добавлены."
          />
        </section>
        <aside className={styles.indexingSideColumn}>
          {jobHistory.length > 0 ? (
            <section className={styles.indexingSideCard}>
              <h3 className={styles.sectionTitle}>История индексации</h3>
              <CompactTable
                headers={["Запуск", "Режим", "Статус", "Источники", "Фрагменты", "Ошибки"]}
                rows={jobHistory.slice(0, 8).map((job) => [
                  formatDate(job.started_at || job.created_at),
                  jobTypeLabels[job.job_type] ?? job.job_type,
                  jobStatusLabels[job.status] ?? job.status,
                  `${job.processed_sources_count} / ${job.total_sources_count || job.processed_sources_count}`,
                  formatNumber(job.created_fragments_count + job.updated_fragments_count),
                  formatNumber(job.errors_count)
                ])}
                empty="Заданий индексации ещё не было."
              />
            </section>
          ) : null}
          <section className={styles.indexingSideCard}>
            <h3 className={styles.sectionTitle}>
              Ошибки индексации
              {(jobErrors.data ?? []).length ? <span className={styles.errorBadge}>{(jobErrors.data ?? []).length}</span> : null}
            </h3>
            <CompactTable
              headers={["Источник", "Этап", "Ошибка", "Рекомендация", "Действие"]}
              rows={(jobErrors.data ?? []).map((error: KnowledgeBaseIndexingError) => {
                const source = sources.find((item) => item.id === error.source_id);
                return [
                  source?.document_title || source?.original_filename || "—",
                  error.error_type,
                  error.user_message || error.technical_message || "-",
                  error.recommended_action || "Повторите обработку",
                  <button key={error.id} type="button" onClick={() => retryError.mutate(error.id)} disabled={retryError.isPending}>
                    Повторить
                  </button>
                ];
              })}
              empty="Ошибок индексации нет."
            />
          </section>
          <section className={styles.indexingSideCard}>
            <h3 className={styles.sectionTitle}>Параметры индексации</h3>
            <div className={styles.paramsGrid}>
              <div><span>Режим</span><strong>{progressJob ? jobTypeLabels[progressJob.job_type] : "—"}</strong></div>
              <div><span>Chunk size</span><strong>{String(params.chunk_size ?? "—")}</strong></div>
              <div><span>Overlap</span><strong>{String(params.chunk_overlap ?? "—")}</strong></div>
              <div><span>Embedding</span><strong>{progressJob?.embedding_model || String(params.embedding_model ?? "—")}</strong></div>
              <div><span>Qdrant</span><strong>{progressJob?.qdrant_collection || "—"}</strong></div>
            </div>
          </section>
        </aside>
      </div>
    );
  }

  if (tab === "test") {
    return (
      <div className={styles.testSearch}>
        {readiness.data ? (
          <div className={styles.readinessCard}>
            <strong>Оценка готовности: {readiness.data.recommendation}</strong>
            <span>
              Качество: {readiness.data.quality_percent}% · FTS: {readiness.data.fts_chunks} · Ошибки: {readiness.data.unresolved_errors}
              {readiness.data.can_promote_to_ready ? " · Можно опубликовать" : ""}
            </span>
          </div>
        ) : null}
        {!canTestSearch ? <div className={styles.statusCallout}>{testSearchPlaceholder}</div> : null}
        <SearchChat key={knowledgeBase.id} knowledgeBaseId={knowledgeBase.id} canSearch={canTestSearch} />
      </div>
    );
  }

  return (
    <CompactTable
      headers={["Действие", "Пользователь", "Дата"]}
      rows={audit.map((item) => [
        auditActionLabels[String(item.action ?? "")] ?? String(item.action ?? "-"),
        String(item.actor_id ?? "-"),
        formatDate(String(item.created_at ?? ""))
      ])}
      empty="Журнал действий пока пуст."
    />
  );
}

function statusCalloutText(kb: KnowledgeBaseListItem): string {
  if (kb.indexing_active || kb.status === "processing") return "Идёт индексация: поиск будет доступен после завершения.";
  if (kb.status === "draft") return "База не готова: добавьте источники и запустите индексацию.";
  if (kb.status === "needs_review") return "Индексация завершена частично: проверьте ошибки и проблемные источники.";
  if (kb.status === "ready") return "База готова к поиску и подключению агентов.";
  if (kb.status === "error") return "Индексация завершилась с ошибкой.";
  return statusLabels[kb.status];
}

function SourceActions({
  source,
  onView,
  onExclude,
  onReindex,
  onDelete
}: {
  source: KnowledgeBaseSource;
  onView: () => void;
  onExclude: () => void;
  onReindex: () => void;
  onDelete: () => void;
}) {
  const indexing = source.processing_status === "processing";
  return (
    <div className={styles.sourceActions}>
      <button type="button" onClick={onView}>Просмотр</button>
      <button type="button" onClick={onReindex} disabled={indexing}>Переобработать</button>
      <button type="button" onClick={onExclude} disabled={indexing}>Исключить</button>
      <button type="button" onClick={onDelete} disabled={indexing}>Удалить</button>
    </div>
  );
}

function StatusBadge({ status, indexing = false }: { status: KnowledgeBaseStatus; indexing?: boolean }) {
  const label = indexing && (status === "processing" || status === "updating" || status === "draft")
    ? "Индексация..."
    : statusLabels[status];
  return (
    <span
      className={`${styles.statusBadge} ${styles[`status_${indexing ? "processing" : status}`]} ${indexing ? styles.statusBadgeIndexing : ""}`}
    >
      {indexing ? <RefreshCw size={12} className={styles.statusSpinner} aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

function KnowledgeBaseQuickSearch({
  knowledgeBase,
  onOpenFullSearch
}: {
  knowledgeBase: KnowledgeBaseListItem;
  onOpenFullSearch: () => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<KnowledgeBaseSearchHit[]>([]);
  const search = useMutation({
    mutationFn: (value: string) => knowledgeBasesApi.testSearch(knowledgeBase.id, { query: value, top_k: 5 }),
    onSuccess: (result) => setHits(result.hits)
  });

  const canSearch = knowledgeBase.can_search && !knowledgeBase.indexing_active;

  return (
    <section className={styles.kbQuickSearch}>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const trimmed = query.trim();
          if (trimmed && canSearch) search.mutate(trimmed);
        }}
      >
        <Search size={15} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            knowledgeBase.indexing_active
              ? "Поиск будет доступен после завершения индексации"
              : canSearch
                ? "Поиск по содержимому базы знаний"
                : "Поиск доступен только для готовых баз знаний"
          }
          disabled={!canSearch || search.isPending}
        />
        <button type="submit" disabled={!canSearch || search.isPending || !query.trim()}>
          Найти
        </button>
      </form>
      {hits.length > 0 ? (
        <div className={styles.kbQuickSearchResults}>
          {hits.slice(0, 3).map((hit) => (
            <article key={hit.knowledge_base_chunk_id || hit.chunk_id || hit.content.slice(0, 24)}>
              <strong>{hit.document_title || "Источник"}</strong>
              <span>Релевантность {formatRelevance(hit.score)}</span>
              <p>{hit.content}</p>
            </article>
          ))}
          <button type="button" className={styles.linkButton} onClick={onOpenFullSearch}>
            Все результаты поиска
          </button>
        </div>
      ) : null}
    </section>
  );
}

function InfoGrid({ items }: { items: [string, string | number | null | undefined][] }) {
  return (
    <dl className={styles.infoGrid}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

function CompactTable({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  const actionsColumnIndex = headers.length - 1;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.compactTable}>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${index}-${cellIndex}`}
                  className={cellIndex === actionsColumnIndex && headers[actionsColumnIndex] === "Действия" ? styles.actionsCell : undefined}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={headers.length} className={styles.emptyCell}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Pipeline() {
  const steps = ["Загрузка документа", "Извлечение текста", "Проверка качества", "Разрешение на использование", "Разбиение на фрагменты", "Создание embeddings", "Индексация в Qdrant", "Доступ для ИИ-агентов"];
  return (
    <section className={styles.pipeline}>
      <h2>Как документ становится частью базы знаний</h2>
      <div>
        {steps.map((step, index) => (
          <article key={step}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

type IndexingStageStatus = "pending" | "running" | "done";

function buildIndexingStages(
  job: KnowledgeBaseIndexingJob | null,
  totalSources: number,
  totalChunks: number
): { id: string; label: string; status: IndexingStageStatus; detail?: string }[] {
  if (!job) return [];
  if (job.status === "queued") {
    return [
      { id: "queue", label: "Ожидание worker", status: "running", detail: "Задание в очереди" },
      { id: "precheck", label: "Проверка источников", status: "pending" },
      { id: "text_extraction", label: "Извлечение текста и структуры", status: "pending" },
      { id: "chunking", label: "Разбиение на фрагменты", status: "pending" },
      { id: "embeddings", label: "Создание embeddings", status: "pending" },
      { id: "qdrant", label: "Индексация в Qdrant", status: "pending" },
      { id: "fulltext", label: "Полнотекстовый индекс", status: "pending" },
      { id: "quality_control", label: "Контроль качества", status: "pending" }
    ];
  }
  const current = String(job.processing_params?.current_stage ?? "");
  const stageOrder = ["precheck", "text_extraction", "chunking", "embeddings", "qdrant", "fulltext", "quality_control", "stopping", "stopped"];
  const currentIndex = stageOrder.indexOf(current);

  const defs = [
    { id: "precheck", label: "Проверка источников", done: (job.total_sources_count ?? 0) > 0 },
    { id: "text_extraction", label: "Извлечение текста и структуры", done: (job.extracted_sources_count ?? 0) > 0, detail: `${job.extracted_sources_count ?? 0}/${totalSources}` },
    { id: "chunking", label: "Разбиение на фрагменты", done: (job.chunked_sources_count ?? 0) > 0, detail: `${job.chunked_sources_count ?? 0}/${totalSources}` },
    { id: "embeddings", label: "Создание embeddings", done: (job.embedded_chunks_count ?? 0) > 0, detail: `${job.embedded_chunks_count ?? 0}/${totalChunks}` },
    { id: "qdrant", label: "Индексация в Qdrant", done: (job.qdrant_points_count ?? 0) > 0, detail: `${job.qdrant_points_count ?? 0}/${totalChunks}` },
    { id: "fulltext", label: "Полнотекстовый индекс", done: (job.fulltext_chunks_count ?? 0) > 0, detail: `${job.fulltext_chunks_count ?? 0}/${totalChunks}` },
    { id: "quality_control", label: "Контроль качества", done: job.status === "completed" || job.status === "partial" }
  ];

  return defs.map((stage) => {
    const stageIndex = stageOrder.indexOf(stage.id);
    let status: IndexingStageStatus = "pending";
    if (current === stage.id || (currentIndex === -1 && !stage.done && defs.findIndex((item) => item.id === stage.id) === defs.findIndex((item) => !item.done))) {
      status = "running";
    } else if (stage.done || (currentIndex >= 0 && stageIndex < currentIndex)) {
      status = "done";
    }
    if (current === stage.id) status = "running";
    return { ...stage, status };
  });
}

function formatJobDuration(job: KnowledgeBaseIndexingJob) {
  if (job.duration_ms) return `${Math.round(job.duration_ms / 1000)} сек`;
  if (!job.started_at) return "—";
  const started = new Date(job.started_at).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - started) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes} мин ${rest} сек` : `${rest} сек`;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function testSearchPlaceholderText(kb: KnowledgeBaseListItem, indexingActive: boolean) {
  if (kb.status === "draft") return "Тест поиска недоступен: база ещё не проиндексирована. Добавьте источники и запустите индексацию.";
  if (indexingActive && (kb.fragments_count ?? 0) === 0) return "Тест поиска временно недоступен: выполняется первая индексация.";
  if (kb.status === "archived") return "Тест поиска недоступен для архивной базы знаний.";
  return "Тест поиска недоступен для текущего статуса.";
}

function SearchChat({ knowledgeBaseId, canSearch }: { knowledgeBaseId: string; canSearch: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [topK, setTopK] = useState(5);
  const threadRef = useRef<HTMLDivElement | null>(null);

  // История поиска текущего пользователя; поллинг, пока есть активные запросы,
  // выполняющиеся воркером в фоне.
  const history = useQuery({
    queryKey: ["knowledge-base-search-queries", knowledgeBaseId],
    queryFn: () => knowledgeBasesApi.searchQueries(knowledgeBaseId),
    refetchInterval: (query) => {
      const items = query.state.data ?? [];
      return items.some((item) => item.status === "pending" || item.status === "running") ? 2000 : false;
    }
  });
  const turns = history.data ?? [];
  const pending = turns.some((turn) => turn.status === "pending" || turn.status === "running");

  const createQuery = useMutation({
    mutationFn: (question: string) =>
      knowledgeBasesApi.createSearchQuery(knowledgeBaseId, { query: question, top_k: topK }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["knowledge-base-search-queries", knowledgeBaseId] })
  });
  const cancelQuery = useMutation({
    mutationFn: (searchQueryId: string) => knowledgeBasesApi.cancelSearchQuery(knowledgeBaseId, searchQueryId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["knowledge-base-search-queries", knowledgeBaseId] })
  });

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [turns.length, pending]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || !canSearch || createQuery.isPending) return;
    setDraft("");
    createQuery.mutate(question);
  };

  return (
    <section className={styles.chatPanel}>
      <div className={styles.chatThread} ref={threadRef}>
        {turns.length === 0 && !history.isLoading ? (
          <div className={styles.chatEmpty}>
            <Bot size={28} />
            <p>Задайте вопрос по содержимому базы знаний — найду подходящие фрагменты и сформирую краткий ответ с источниками.</p>
          </div>
        ) : null}
        {turns.map((turn) => (
          <div key={turn.id} className={styles.chatTurn}>
            <div className={styles.chatUserMsg}>{turn.query}</div>
            <div className={styles.chatBotRow}>
              <span className={styles.chatBotAvatar}>
                <Bot size={15} />
              </span>
              <div className={styles.chatBotMsg}>
                {turn.status === "pending" || turn.status === "running" ? (
                  <div className={styles.chatPendingRow}>
                    <span className={styles.chatTyping}>
                      Ищу фрагменты и формирую ответ
                      <span className={styles.chatTypingDots}>
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    <button
                      type="button"
                      className={styles.chatCancelBtn}
                      onClick={() => cancelQuery.mutate(turn.id)}
                      disabled={cancelQuery.isPending}
                    >
                      Остановить
                    </button>
                  </div>
                ) : null}
                {turn.status === "failed" ? (
                  <span>Не удалось выполнить поиск{turn.error ? `: ${turn.error}` : ""}. Попробуйте ещё раз.</span>
                ) : null}
                {turn.status === "cancelled" ? <span className={styles.chatCancelled}>Поиск остановлен.</span> : null}
                {turn.status === "completed" ? (
                  <>
                    <p className={styles.chatAnswer}>
                      {turn.answer || (turn.hits?.length ? "Готового ответа нет — посмотрите найденные фрагменты." : "По этому вопросу ничего не нашлось в базе знаний.")}
                    </p>
                    {turn.hits && turn.hits.length > 0 ? (
                      <>
                        <div className={styles.chatHitsSummary}>
                          <Layers3 size={13} />
                          <span>Найдено {turn.hits.length} {fragmentsLabel(turn.hits.length)}</span>
                          <i className={styles.chatHitsDot} />
                          <span>
                            лучший источник <b>{formatRelevance(Math.max(...turn.hits.map((hit) => hit.score)))}</b>
                          </span>
                        </div>
                        <AnswerSources hits={turn.hits} query={turn.query} />
                      </>
                    ) : null}
                    <small className={styles.chatDisclaimer}>Ответ сформирован только на основании найденных фрагментов.</small>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form className={styles.chatComposer} onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={canSearch ? "Спросите что-нибудь по базе знаний…" : "Поиск недоступен"}
          disabled={!canSearch}
        />
        <select
          value={topK}
          onChange={(event) => setTopK(Number(event.target.value))}
          disabled={!canSearch}
          title="Сколько фрагментов искать"
        >
          {[3, 5, 10, 15].map((value) => (
            <option key={value} value={value}>{value} фр.</option>
          ))}
        </select>
        <button type="submit" className={styles.chatSendBtn} disabled={!canSearch || !draft.trim() || createQuery.isPending} title="Отправить">
          <Send size={15} />
        </button>
      </form>
    </section>
  );
}

function AnswerSources({ hits, query }: { hits: KnowledgeBaseSearchHit[]; query: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.sourcesBlock}>
      <button type="button" className={styles.sourcesHeader} onClick={() => setOpen((value) => !value)}>
        <Layers3 size={15} />
        <span>Источники ответа</span>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {open ? (
        <div className={styles.sourcesList}>
          {hits.map((hit, index) => (
            <SourceCard
              key={hit.knowledge_base_chunk_id || hit.chunk_id || `${index}-${hit.content.slice(0, 16)}`}
              hit={hit}
              index={index + 1}
              query={query}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SourceCard({
  hit,
  index,
  query,
  defaultOpen
}: {
  hit: KnowledgeBaseSearchHit;
  index: number;
  query: string;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(Boolean(defaultOpen));
  const blockTypeLabel = sourceBlockTypeLabel(hit);
  return (
    <article className={styles.sourceCard}>
      <button type="button" className={styles.sourceHead} onClick={() => setExpanded((value) => !value)}>
        <span className={styles.sourceIndex}>{index}</span>
        <strong className={styles.sourceTitle}>{hit.document_title || "Источник"}</strong>
        <span className={styles.sourceScore}>{formatRelevance(hit.score)}</span>
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {!expanded ? (
        <p className={styles.sourcePreview}>{highlightSearchTerms(previewText(hit.content), query)}</p>
      ) : (
        <div className={styles.sourceBody}>
          <div className={styles.sourceMetaTable}>
            <span className={styles.sourceMetaLabel}>Документ</span>
            <span className={styles.sourceMetaValue}>{hit.document_title || "—"}</span>
            <span className={styles.sourceMetaLabel}>Раздел</span>
            <span className={styles.sourceMetaValue}>{hit.section_title || "Не указан"}</span>
            <span className={styles.sourceMetaLabel}>Страница</span>
            <span className={styles.sourceMetaValue}>{hit.page_number ?? "—"}</span>
            <span className={styles.sourceMetaLabel}>Тип блока</span>
            <span className={styles.sourceMetaValue}>{blockTypeLabel}</span>
          </div>
          <div className={styles.sourceFragment}>
            <span className={styles.sourceMetaLabel}>Фрагмент</span>
            <p className={styles.sourceFragmentText}>{highlightSearchTerms(hit.content, query)}</p>
          </div>
          {!hit.accessible ? (
            <small className={styles.sourceRestricted}>
              В рабочем поиске недоступен ({hit.access_reason}); текст показан для проверки.
            </small>
          ) : null}
          {hit.document_id ? (
            <div className={styles.sourceActionsRow}>
              <a className={styles.sourceOpenLink} href={`/documents?document=${hit.document_id}`} target="_blank" rel="noreferrer">
                <SquareArrowOutUpRight size={13} />
                Открыть документ
              </a>
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}

function previewText(content: string): string {
  const flat = content.split(/\s+/).join(" ").trim();
  return flat.length > 180 ? `${flat.slice(0, 180)}…` : flat;
}

function sourceBlockTypeLabel(hit: KnowledgeBaseSearchHit): string {
  const meta = (hit.metadata ?? {}) as Record<string, unknown>;
  const kind = (meta.chunk_kind as string) || (meta.fragment_type as string) || "";
  if (kind === "table_row") return "Строка таблицы";
  const blockTypes = meta.block_types as string[] | undefined;
  if (blockTypes?.includes("table")) return "Таблица";
  if (blockTypes?.includes("heading")) return "Заголовок";
  return "Текст";
}

function fragmentsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "фрагмент";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "фрагмента";
  return "фрагментов";
}

function highlightSearchTerms(content: string, query: string): React.ReactNode {
  const terms = query.trim().split(/\s+/).filter((term) => term.length > 1);
  if (!terms.length) return content;
  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return content.split(pattern).map((part, index) => {
    const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
    return isMatch ? <mark key={index}>{part}</mark> : part;
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatBytes(value?: number | null) {
  const bytes = value ?? 0;
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

function formatRelevance(score: number) {
  const percent = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return `${percent}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
