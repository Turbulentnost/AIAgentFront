import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Database,
  FileText,
  Filter,
  Layers3,
  LockKeyhole,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { agentsApi, knowledgeBasesApi } from "@/api/endpoints";
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
  partial: "Частично"
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
    }, 3000);
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
        selected.status === "updating")
  );

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab && tabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab as DetailTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isIndexingActive || !selected?.id) return;
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-base-jobs", selected.id] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources", selected.id] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-base-chunks", selected.id] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases", "stats"] });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isIndexingActive, queryClient, selected?.id]);
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
            <FormSearchInput
              className={styles.filterSearch}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Поиск базы знаний"
            />
            <FormSelect
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as KnowledgeBaseStatus | "all")}
              placeholder="Все статусы"
              options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
              ariaLabel="Фильтр по статусу"
            />
            <button type="button" className={styles.secondaryButton}>
              <Filter size={15} strokeWidth={2} aria-hidden="true" />
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
                    <strong>Идёт индексация базы знаний</strong>
                    <span>
                      {latestJob
                        ? `${jobTypeLabels[latestJob.job_type] ?? latestJob.job_type}: ${jobStatusLabels[latestJob.status] ?? latestJob.status}`
                        : "Подготовка документов, создание embeddings и запись в Qdrant"}
                    </span>
                  </div>
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
    { label: "Всего баз знаний", value: stats?.total_bases ?? 0, hint: `Активных: ${stats?.active_bases ?? 0}`, icon: Database, tone: "blue" },
    { label: "Документы в базах", value: stats?.documents_in_bases ?? 0, hint: "Источники после обработки", icon: FileText, tone: "green" },
    { label: "Фрагменты (chunks)", value: stats?.fragments_count ?? 0, hint: "Для RAG и правил", icon: Layers3, tone: "violet" },
    { label: "Успешная индексация", value: `${stats?.successful_indexing_percent ?? 0}%`, hint: `Ошибок: ${stats?.errors_count ?? 0}`, icon: CheckCircle2, tone: "green" },
    { label: "Требуют проверки", value: stats?.needs_review_count ?? 0, hint: "Нужен допуск к агентам", icon: TriangleAlert, tone: "orange" }
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

  const [testQuery, setTestQuery] = useState("");
  const [testHits, setTestHits] = useState<KnowledgeBaseSearchHit[]>([]);
  const [testPreview, setTestPreview] = useState<string | null>(null);
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
  const jobErrors = useQuery({
    queryKey: ["knowledge-base-job-errors", latestJob?.id],
    queryFn: () => knowledgeBasesApi.jobErrors(latestJob!.id),
    enabled: tab === "indexing" && Boolean(latestJob?.id)
  });

  const testSearch = useMutation({
    mutationFn: (query: string) => knowledgeBasesApi.testSearch(knowledgeBase.id, { query, top_k: 5 }),
    onSuccess: (result) => {
      setTestHits(result.hits);
      setTestPreview(result.answer_preview);
    }
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

  const canTestSearch = knowledgeBase.can_search && !isIndexingActive;
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
    const progressJob = latestJob?.status === "running" ? latestJob : null;

    return (
      <div className={styles.detailBody}>
        {progressJob ? (
          <article className={styles.indexingProgressCard}>
            <h3 className={styles.sectionTitle}>Текущая индексация</h3>
            <p>Источники: {progressJob.processed_sources_count} / {progressJob.total_sources_count || sources.length}</p>
            <p>Извлечение текста: {progressJob.extracted_sources_count ?? 0} / {progressJob.total_sources_count || sources.length}</p>
            <p>Фрагментация: {progressJob.chunked_sources_count ?? 0} / {progressJob.total_sources_count || sources.length}</p>
            <p>Embeddings: {progressJob.embedded_chunks_count ?? 0} / {progressJob.total_chunks_count || knowledgeBase.fragments_count}</p>
            <p>Qdrant: {progressJob.qdrant_points_count ?? 0} / {progressJob.total_chunks_count || knowledgeBase.fragments_count}</p>
            <p>Полнотекстовый индекс: {progressJob.fulltext_chunks_count ?? 0} / {progressJob.total_chunks_count || knowledgeBase.fragments_count}</p>
            <p>Ошибки: {progressJob.errors_count}</p>
          </article>
        ) : null}
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
        {(jobErrors.data ?? []).length > 0 ? (
          <>
            <h3 className={styles.sectionTitle}>Ошибки</h3>
            <CompactTable
              headers={["Источник", "Тип", "Ошибка", "Действие"]}
              rows={(jobErrors.data ?? []).map((error: KnowledgeBaseIndexingError) => [
                error.source_id || "—",
                error.error_type,
                error.user_message || error.technical_message || "-",
                <button key={error.id} type="button" onClick={() => retryError.mutate(error.id)} disabled={retryError.isPending}>
                  Повторить
                </button>
              ])}
              empty=""
            />
          </>
        ) : null}
        {jobHistory.length > 0 ? (
          <>
            <h3 className={styles.sectionTitle}>История заданий</h3>
            <CompactTable
              headers={["Тип", "Статус", "Источники", "Создано", "Ошибки", "Длительность"]}
              rows={jobHistory.map((job) => [
                jobTypeLabels[job.job_type] ?? job.job_type,
                jobStatusLabels[job.status] ?? job.status,
                `${job.processed_sources_count} / ${job.total_sources_count || job.processed_sources_count}`,
                formatNumber(job.created_fragments_count + job.updated_fragments_count),
                formatNumber(job.errors_count),
                job.duration_ms ? `${Math.round(job.duration_ms / 1000)} сек` : "-"
              ])}
              empty="Заданий индексации ещё не было."
            />
          </>
        ) : null}
      </div>
    );
  }

  if (tab === "test") {
    return (
      <div className={styles.testSearch}>
        {readiness.data ? (
          <div className={styles.readinessCard}>
            <strong>Оценка готовности: {readiness.data.recommendation}</strong>
            <span>Качество: {readiness.data.quality_percent}% · FTS: {readiness.data.fts_chunks} · Ошибки: {readiness.data.unresolved_errors}</span>
          </div>
        ) : null}
        <form
          className={styles.testSearchForm}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (testQuery.trim() && canTestSearch) testSearch.mutate(testQuery.trim());
          }}
        >
          <input
            value={testQuery}
            onChange={(event) => setTestQuery(event.target.value)}
            placeholder={canTestSearch ? "Введите тестовый вопрос" : "Поиск недоступен для текущего статуса базы"}
            disabled={!canTestSearch}
          />
          <button type="submit" disabled={!canTestSearch || testSearch.isPending}>
            <Play size={15} />
            Проверить
          </button>
        </form>
        {testPreview ? <p className={styles.answerPreview}>{testPreview}</p> : null}
        {testHits.map((hit) => (
          <article key={hit.knowledge_base_chunk_id || hit.chunk_id || hit.content.slice(0, 20)}>
            <strong>{hit.document_title || "Источник"}</strong>
            <span>
              Релевантность {hit.score.toFixed(3)} · {hit.accessible ? "доступен" : "нет доступа"} · {hit.access_reason}
            </span>
            <span>Стр. {hit.page_number ?? "-"} · {hit.section_title || "-"} · {hit.clause_number || "-"}</span>
            <p>{hit.content}</p>
          </article>
        ))}
        {testSearch.isSuccess && !testHits.length ? <div className={styles.emptyState}>Фрагменты не найдены.</div> : null}
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
  if (kb.status === "needs_review") return "Есть замечания: проверьте ошибки индексации.";
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
  return (
    <div className={styles.sourceActions}>
      <button type="button" onClick={onView}>Просмотр</button>
      <button type="button" onClick={onReindex}>Переобработать</button>
      <button type="button" onClick={onExclude}>Исключить</button>
      <button type="button" onClick={onDelete}>Удалить</button>
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
              <span>Релевантность {hit.score.toFixed(3)}</span>
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
  return (
    <table className={styles.compactTable}>
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
