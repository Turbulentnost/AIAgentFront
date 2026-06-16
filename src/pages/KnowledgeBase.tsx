import React, { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Archive,
  BadgeCheck,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleAlert,
  Database,
  FileText,
  Layers3,
  LibraryBig,
  LockKeyhole,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  SquareArrowOutUpRight,
  Trash2,
  Upload
} from "lucide-react";
import { documentsApi, knowledgeBasesApi } from "@/api/endpoints";
import { useKnowledgeBaseIndexingWs } from "@/hooks/useKnowledgeBaseIndexingWs";
import type {
  KnowledgeBase,
  KnowledgeBaseAccessGrantInput,
  KnowledgeBaseAgentBinding,
  KnowledgeBaseChunk,
  DocumentChunk,
  KnowledgeBaseIndexingError,
  KnowledgeBaseIndexingJob,
  KnowledgeBaseListItem,
  KnowledgeBaseRule,
  KnowledgeBaseSearchHit,
  KnowledgeBaseSource,
  KnowledgeBaseStats,
  KnowledgeBaseStatus
} from "@/types";
import { KnowledgeBaseOverviewTab } from "@/components/KnowledgeBaseOverviewTab";
import SourceFileTree, { type SourceFileTreeFileMeta } from "@/components/SourceFileTree";
import {
  buildBlocksFromExtractedPayload,
  buildExtractedContentBlocks,
  documentChunkToViewerChunk,
  groupExtractedBlocksByPage,
  type ExtractedContentBlock,
  type ExtractedViewerChunk
} from "@/utils/extractedVisionText";
import { FormSearchInput, FormSelect } from "@/components/form-controls";
import formStyles from "@/components/form-controls/form-controls.module.css";
import { isKnowledgeBaseIndexingActive, isActiveJobStatus, shouldShowKnowledgeBaseIndexingBadge } from "@/utils/knowledgeBaseIndexing";
import { buildSourceFileTree, collapseLinearFolderChainsInTree } from "@/utils/sourceFileTree";
import { isCancelledJobStatus } from "@/utils/knowledgeBaseIndexing";
import styles from "./KnowledgeBase.module.css";

type DetailTab = "overview" | "sources" | "chunks" | "rules" | "indexing" | "test" | "audit";

const tabs: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "sources", label: "Файлы" },
  { id: "chunks", label: "Фрагменты" },
  { id: "rules", label: "Правила и связи" },
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
  ocr_extraction: "Извлечение данных OCR",
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

const auditActionLabels: Record<string, string> = {
  "kb.created": "Создание базы",
  "kb.source_added": "Добавление источника",
  "kb.source_removed": "Удаление источника",
  "kb.source_excluded": "Исключение источника",
  "kb.index_started": "Запуск индексации",
  "kb.test_search": "Тестовый поиск",
  "kb.access_updated": "Изменение доступа",
  "kb.agents_replaced": "Подключение агентов",
  "kb.archived": "Архивация базы",
  "kb.review_confirmed": "Подтверждение проверки"
};

export default function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const kbFromUrl = searchParams.get("kb");

  useEffect(() => {
    const items = knowledgeBases.data ?? [];
    if (!items.length) return;

    setSelectedId((current) => {
      if (current && items.some((item) => item.id === current && item.can_access)) {
        return current;
      }
      if (kbFromUrl) {
        const fromUrl = items.find((item) => item.id === kbFromUrl && item.can_access);
        if (fromUrl) return kbFromUrl;
      }
      return items.find((item) => item.can_access)?.id ?? null;
    });
  }, [knowledgeBases.data, kbFromUrl]);

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
    selected && isKnowledgeBaseIndexingActive(selected, latestJob)
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
      })
  });

  const applyCancelSuccess = (job: KnowledgeBaseIndexingJob | undefined, knowledgeBaseId: string) => {
    queryClient.setQueriesData<KnowledgeBaseListItem[]>({ queryKey: ["knowledge-bases"] }, (items) =>
      items?.map((item) =>
        item.id === knowledgeBaseId
          ? {
              ...item,
              indexing_active: false,
              status: item.fragments_count > 0 ? "ready" : item.status
            }
          : item
      )
    );
    if (job?.id) {
      queryClient.setQueryData<KnowledgeBaseIndexingJob[]>(
        ["knowledge-base-jobs", knowledgeBaseId],
        (existing) => {
          const jobsList = existing ?? [];
          const hasJob = jobsList.some((entry) => entry.id === job.id);
          const nextJob = { ...job, cancel_requested: true };
          return hasJob
            ? jobsList.map((entry) => (entry.id === job.id ? { ...entry, ...nextJob } : entry))
            : [nextJob, ...jobsList];
        }
      );
    }
  };

  const refreshAfterCancel = async (knowledgeBaseId: string) => {
    await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    await queryClient.invalidateQueries({ queryKey: ["knowledge-base-jobs", knowledgeBaseId] });
    await queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources", knowledgeBaseId] });
  };

  const handleCancelIndexing = async (knowledgeBaseId: string) => {
    try {
      const job = await cancelIndexing.mutateAsync(knowledgeBaseId);
      applyCancelSuccess(job, knowledgeBaseId);
      await refreshAfterCancel(knowledgeBaseId);
    } catch (error) {
      if (error instanceof AxiosError) {
        const httpStatus = error.response?.status;
        if (httpStatus === 409 || httpStatus === 404) {
          await refreshAfterCancel(knowledgeBaseId);
          return;
        }
      }
      window.alert("Не удалось остановить индексацию. Попробуйте ещё раз.");
    }
  };

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

  const confirmReview = useMutation({
    mutationFn: (knowledgeBaseId: string) => knowledgeBasesApi.confirmReview(knowledgeBaseId),
    onSuccess: async (_kb, knowledgeBaseId) => {
      queryClient.setQueriesData<KnowledgeBaseListItem[]>({ queryKey: ["knowledge-bases"] }, (items) =>
        items?.map((item) =>
          item.id === knowledgeBaseId
            ? { ...item, status: "ready", can_confirm_review: false }
            : item
        )
      );
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases", "stats"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-base-readiness", knowledgeBaseId] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-base-audit", knowledgeBaseId] });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        const detail = error.response?.data?.detail;
        if (typeof detail === "string" && detail.trim()) {
          window.alert(detail);
          return;
        }
      }
      window.alert("Не удалось подтвердить базу знаний. Попробуйте снова.");
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
      </section>

      <StatsGrid stats={stats.data} />

      <section className={styles.workspace}>
        <div className={styles.listPanel}>
          <div className={styles.filters}>
            <FormSearchInput
              compact
              className={styles.filterSearch}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Поиск базы знаний"
            />
            <FormSelect
              compact
              className={styles.filterSelect}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as KnowledgeBaseStatus | "all")}
              options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
              placeholder="Все статусы"
              ariaLabel="Статус базы знаний"
            />
          </div>

          <div className={styles.kbTableWrap}>
            <div className={styles.kbTableScroll}>
              <table className={styles.kbTable}>
                <thead className={styles.kbTableHead}>
                  <tr>
                    <th>Название базы знаний</th>
                    <th>Источники</th>
                    <th>Фрагменты</th>
                    <th>Статус</th>
                    <th className={styles.compactTableColDate}>Обновлено</th>
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
                        setSearchParams(
                          (prev) => {
                            const next = new URLSearchParams(prev);
                            next.set("kb", item.id);
                            return next;
                          },
                          { replace: true }
                        );
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
                      <StatusBadge status={item.status} indexing={shouldShowKnowledgeBaseIndexingBadge(item)} />
                    </td>
                    <td className={styles.compactTableColDate}>{formatDate(item.updated_at)}</td>
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
          </div>

          <div className={styles.kbCreateFooter}>
            <button
              type="button"
              className={styles.kbCreateButton}
              onClick={() => navigate("/knowledge-base/create")}
              title="Создать базу знаний"
              aria-label="Создать базу знаний"
            >
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        <aside className={styles.detailPanel}>
          {selected ? (
            <div className={styles.detailPanelInner}>
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
                    onClick={() => selected && void handleCancelIndexing(selected.id)}
                    disabled={cancelIndexing.isPending}
                  >
                    <Square size={14} />
                    {cancelIndexing.isPending ? "Останавливаем..." : "Остановить"}
                  </button>
                </div>
              ) : null}
              <div className={styles.detailHeader}>
                <div>
                  <h2>{selected.name}</h2>
                  <StatusBadge status={selected.status} indexing={shouldShowKnowledgeBaseIndexingBadge(selected, latestJob)} />
                </div>
                <div className={styles.detailHeaderActions}>
                  {(selected.can_confirm_review ||
                    (selected.can_delete && selected.status === "needs_review" && !selected.indexing_active)) ? (
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.successButton}`}
                      onClick={() => confirmReview.mutate(selected.id)}
                      disabled={confirmReview.isPending || selected.indexing_active}
                      title="Подтвердить проверку и перевести в статус «Готова»"
                    >
                      <Check size={17} />
                    </button>
                  ) : null}
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
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => startIndexing.mutate(selected.id)}
                    disabled={startIndexing.isPending || selected.indexing_active}
                    title="Запустить переиндексацию"
                  >
                    <RefreshCw size={17} />
                  </button>
                </div>
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
              <div
                className={`${styles.detailTabScroll} ${activeTab === "sources" ? styles.detailTabScrollSources : ""} ${activeTab === "chunks" ? styles.detailTabScrollChunks : ""} ${activeTab === "test" ? styles.detailTabScrollTest : ""}`.trim()}
              >
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
                  audit={audit.data ?? []}
                  onTabChange={setActiveTab}
                />
              </div>
            </div>
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
  const statIconColors = {
    blue: "var(--color-primary)",
    orange: "var(--color-warning)",
    violet: "var(--color-violet)",
    green: "var(--color-success)"
  } as const;

  const cards = [
    {
      label: "Всего баз знаний",
      value: stats?.total_bases ?? 0,
      hint: "Доступных для просмотра и использования",
      icon: LibraryBig,
      tone: "blue" as const
    },
    {
      label: "Ошибки индексации",
      value: stats?.indexing_errors_count ?? 0,
      hint: "Нерешённых по доступным базам",
      icon: CircleAlert,
      tone: "orange" as const
    },
    {
      label: "Общий размер",
      value: formatBytes(stats?.storage_bytes ?? 0),
      hint: "Суммарный объём данных",
      icon: Archive,
      tone: "violet" as const
    },
    {
      label: "Успешная индексация",
      value: stats?.successfully_indexed_bases ?? 0,
      hint: "Баз со статусом «Готова»",
      icon: BadgeCheck,
      tone: "green" as const
    }
  ];
  return (
    <section className={styles.statsGrid}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.label} className={styles.statCard}>
            <span className={`${styles.statIcon} ${styles[`statIcon_${card.tone}`]}`} aria-hidden="true">
              <Icon size={20} strokeWidth={2.2} color={statIconColors[card.tone]} />
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
    audit,
    onTabChange
  } = props;

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [chunkFilter, setChunkFilter] = useState<"all" | "excluded" | "errors" | "ocr">("all");
  const [newRuleText, setNewRuleText] = useState("");

  useEffect(() => {
    setSelectedSourceId(null);
  }, [knowledgeBase.id]);

  useEffect(() => {
    if (tab !== "sources" || !sources.length) return;
    setSelectedSourceId((current) => {
      if (current && sources.some((source) => source.id === current)) return current;
      return sources[0]?.id ?? null;
    });
  }, [tab, knowledgeBase.id, sources]);

  const overview = useQuery({
    queryKey: ["knowledge-base-overview", knowledgeBase.id],
    queryFn: () => knowledgeBasesApi.overview(knowledgeBase.id),
    enabled: tab === "overview" || tab === "test"
  });
  const readiness = useQuery({
    queryKey: ["knowledge-base-readiness", knowledgeBase.id],
    queryFn: () => knowledgeBasesApi.readiness(knowledgeBase.id),
    enabled: tab === "overview" || tab === "test"
  });
  const activeJob = jobs.find((job) => isActiveJobStatus(job.status)) ?? latestJob;
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
  const selectedSourceChunks = selectedSource ? chunks.filter((chunk) => chunk.source_id === selectedSource.id) : [];
  const selectedDocumentChunks = useQuery({
    queryKey: ["document-version-chunks", selectedSource?.document_version_id],
    queryFn: () => documentsApi.chunks(selectedSource!.document_version_id),
    enabled: Boolean(selectedSource?.document_version_id)
  });
  const selectedExtractedText = useQuery({
    queryKey: ["document-extracted-text", selectedSource?.document_version_id],
    queryFn: () => documentsApi.extractedText(selectedSource!.document_version_id),
    enabled: Boolean(selectedSource?.document_version_id),
    retry: false
  });
  const filteredChunks = chunks.filter((chunk) => {
    if (chunkFilter === "excluded") return chunk.is_excluded_from_search;
    if (chunkFilter === "errors") return chunk.embedding_status === "failed" || chunk.quality_status === "low" || chunk.quality_status === "failed";
    if (chunkFilter === "ocr") return chunk.fragment_type === "ocr" || chunk.embedding_status === "pending";
    return true;
  });

  if (tab === "overview") {
    return (
      <KnowledgeBaseOverviewTab
        knowledgeBase={knowledgeBase}
        stats={overview.data}
        statsLoading={overview.isLoading}
        readiness={readiness.data}
        agents={agents}
        accessGrants={accessGrants}
        isIndexingActive={isIndexingActive}
        canTestSearch={canTestSearch}
        onTabChange={onTabChange}
      />
    );
  }

  if (tab === "sources") {
    return (
      <div className={`${styles.detailBody} ${styles.detailBodySources}`}>
        <SourcesFilesTree
          sources={sources}
          selectedSourceId={selectedSourceId}
          onView={(sourceId) => setSelectedSourceId(sourceId)}
          onExclude={(sourceId) => excludeSource.mutate(sourceId)}
          onReindex={(sourceId) => reindexSource.mutate(sourceId)}
          onDelete={(sourceId) => deleteSource.mutate(sourceId)}
        />
        {selectedSource ? (
          <ExtractedSourceViewer
            key={selectedSource.id}
            source={selectedSource}
            kbChunks={selectedSourceChunks}
            documentChunks={selectedDocumentChunks.data ?? []}
            extractedText={selectedExtractedText.data ?? null}
            loading={selectedDocumentChunks.isLoading || selectedExtractedText.isLoading}
          />
        ) : null}
      </div>
    );
  }

  if (tab === "chunks") {
    return (
      <div className={styles.detailBody}>
        <div className={styles.chunkFilters}>
          {(["all", "excluded", "errors", "ocr"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.chunkFilterButton} ${chunkFilter === value ? styles.chunkFilterButtonActive : ""}`.trim()}
              onClick={() => setChunkFilter(value)}
            >
              {value === "all" ? "Все" : value === "excluded" ? "Исключённые" : value === "errors" ? "Ошибки" : "OCR"}
            </button>
          ))}
        </div>
        <div className={styles.chunkList}>
          {filteredChunks.map((chunk) => (
            <article key={chunk.id} className={styles.chunkCard}>
              <header>
                <strong>{chunk.document_title || "Источник не найден"}</strong>
                <span>{chunk.embedding_status}</span>
              </header>
              <p>{chunk.text || "Текст фрагмента недоступен"}</p>
              <small>
                Пункт {chunk.clause_number || "-"} · Тип {chunk.fragment_type || "-"} · Страница {chunk.page_number ?? "-"} · Раздел {chunk.section_title || "-"}
              </small>
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
          className={styles.kbQuickSearchForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (newRuleText.trim()) createRule.mutate(newRuleText.trim());
          }}
        >
          <div className={`${formStyles.selectField} ${formStyles.compact} ${styles.kbQuickSearchField}`}>
            <input
              className={formStyles.control}
              value={newRuleText}
              onChange={(e) => setNewRuleText(e.target.value)}
              placeholder="Текст нового правила"
              disabled={createRule.isPending}
            />
          </div>
          <button
            type="submit"
            className={styles.kbQuickSearchSubmit}
            disabled={createRule.isPending || !newRuleText.trim()}
          >
            Добавить правило
          </button>
        </form>
        <CompactTable
          headers={["Правило", "Область", "Условие", "Действие", "Приоритет", "Статус"]}
          rows={rules.map((rule) => [rule.text, rule.scope || "-", rule.condition || "-", rule.agent_action || "-", rule.priority, rule.status])}
          empty="Структурированные правила для агентов ещё не заведены."
        />
      </div>
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
    const progressJob = activeJob && isActiveJobStatus(activeJob.status) ? activeJob : null;
    const totalSources = progressJob?.total_sources_count || sources.length || 1;
    const totalChunks = progressJob?.total_chunks_count || knowledgeBase.fragments_count || 1;
    const stages = buildIndexingStages(progressJob, totalSources, totalChunks);
    const params = progressJob?.processing_params ?? latestJob?.processing_params ?? {};

    const indexingParams = [
      { label: "Режим", value: progressJob ? jobTypeLabels[progressJob.job_type] : "—" },
      { label: "Chunk size", value: String(params.chunk_size ?? "—") },
      { label: "Overlap", value: String(params.chunk_overlap ?? "—") },
      {
        label: "Embedding",
        value: progressJob?.embedding_model || String(params.embedding_model ?? "—"),
        wrap: true
      },
      { label: "Qdrant", value: progressJob?.qdrant_collection || "—", wrap: true }
    ];

    return (
      <div className={styles.indexingTab}>
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
          <div className={styles.indexingIdleState}>Активная индексация не выполняется. Запустите обработку источников.</div>
        )}
        <section className={styles.indexingSideCard}>
          <h3 className={styles.sectionTitle}>По файлам</h3>
          <CompactTable
            wrapClassName={styles.indexingTableWrap}
            tableClassName={styles.indexingFilesTable}
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
        {jobHistory.length > 0 ? (
          <section className={styles.indexingSideCard}>
            <h3 className={styles.sectionTitle}>История индексации</h3>
            <CompactTable
              wrapClassName={styles.indexingTableWrap}
              tableClassName={styles.indexingHistoryTable}
              headers={["Режим", "Статус", "Источники", "Фрагменты", "Ошибки", "Запуск"]}
              rows={jobHistory.slice(0, 8).map((job) => [
                jobTypeLabels[job.job_type] ?? job.job_type,
                jobStatusLabels[job.status] ?? job.status,
                `${job.processed_sources_count} / ${job.total_sources_count || job.processed_sources_count}`,
                formatNumber(job.created_fragments_count + job.updated_fragments_count),
                formatNumber(job.errors_count),
                formatDate(job.started_at || job.created_at)
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
            wrapClassName={styles.indexingTableWrap}
            tableClassName={styles.indexingErrorsTable}
            headers={["Источник", "Этап", "Ошибка", "Рекомендация", "Действие"]}
            rows={(jobErrors.data ?? []).map((error: KnowledgeBaseIndexingError) => {
              const source = sources.find((item) => item.id === error.source_id);
              return [
                source?.document_title || source?.original_filename || "—",
                error.error_type,
                error.user_message || error.technical_message || "-",
                error.recommended_action || "Повторите обработку",
                <button
                  key={error.id}
                  type="button"
                  className={styles.indexingRetryButton}
                  onClick={() => retryError.mutate(error.id)}
                  disabled={retryError.isPending}
                >
                  Повторить
                </button>
              ];
            })}
            empty="Ошибок индексации нет."
          />
        </section>
        <section className={styles.indexingParamsCard}>
          <h3 className={styles.sectionTitle}>Параметры индексации</h3>
          <div className={styles.indexingParamsRow}>
            {indexingParams.map((item) => (
              <div key={item.label} className={styles.indexingParamItem}>
                <span className={styles.indexingParamLabel}>{item.label}</span>
                <strong className={`${styles.indexingParamValue} ${item.wrap ? styles.indexingParamValueWrap : ""}`.trim()}>
                  {item.value}
                </strong>
              </div>
            ))}
          </div>
        </section>
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
    <div className={styles.detailBody}>
      <CompactTable
        wrapClassName={styles.auditTableWrap}
        tableClassName={styles.auditTable}
        headers={["Действие", "Пользователь", "Дата"]}
        rows={audit.map((item) => [
          auditActionLabels[String(item.action ?? "")] ?? String(item.action ?? "-"),
          String(item.actor_id ?? "-"),
          formatDate(String(item.created_at ?? item.occurred_at ?? item.timestamp ?? ""))
        ])}
        empty="Журнал действий пока пуст."
      />
    </div>
  );
}

function sourceRelativePath(source: KnowledgeBaseSource) {
  return source.relative_path || source.original_filename || source.document_title || source.document_id;
}

function ExtractedSourceViewer({
  source,
  kbChunks,
  documentChunks,
  extractedText,
  loading
}: {
  source: KnowledgeBaseSource;
  kbChunks: KnowledgeBaseChunk[];
  documentChunks: DocumentChunk[];
  extractedText: Record<string, unknown> | null;
  loading: boolean;
}) {
  const viewerChunks = useMemo<ExtractedViewerChunk[]>(
    () => (documentChunks.length ? documentChunks.map((chunk) => documentChunkToViewerChunk(source, chunk)) : kbChunks),
    [documentChunks, kbChunks, source]
  );
  const blocks = useMemo(() => {
    if (extractedText) {
      return buildBlocksFromExtractedPayload(extractedText);
    }
    return buildExtractedContentBlocks(viewerChunks);
  }, [extractedText, viewerChunks]);
  const pageGroups = useMemo(() => groupExtractedBlocksByPage(blocks), [blocks]);
  const pagesCount = useMemo(() => {
    if (typeof extractedText?.pages === "object" && Array.isArray(extractedText.pages)) {
      return extractedText.pages.length;
    }
    return source.pages_count;
  }, [extractedText, source.pages_count]);
  const sourceName = source.document_title || source.original_filename || source.document_id;

  return (
    <article className={styles.sourceDetailCard}>
      <header className={styles.extractedViewerHeader}>
        <div>
          <h4>{sourceName}</h4>
          <p>
            Страниц: {pagesCount ?? "-"} · Фрагментов: {source.fragments_count} · Статус:{" "}
            {sourceStatusLabels[source.processing_status] ?? source.processing_status}
          </p>
        </div>
        <span>{source.last_indexed_at ? `Индексировано: ${formatDate(source.last_indexed_at)}` : "Не индексировано"}</span>
      </header>

      {source.precheck_notes ? <p className={styles.extractedWarning}>Ошибки: {source.precheck_notes}</p> : null}

      <div className={styles.extractedContent}>
        {pageGroups.map(({ pageNumber, blocks: pageBlocks }) => (
          <section key={String(pageNumber)} className={styles.extractedPage}>
            {pageNumber !== "unknown" ? <div className={styles.extractedPageLabel}>Страница {pageNumber}</div> : null}
            <div className={styles.extractedPageBody}>
              {pageBlocks.map((block) =>
                block.kind === "table" ? (
                  <ExtractedTable key={block.id} block={block} />
                ) : (
                  <section key={block.id} className={styles.extractedTextBlock}>
                    {block.chunk.section_title ? <h5>{block.chunk.section_title}</h5> : null}
                    {block.text.split(/\n{2,}/).map((paragraph, index) => (
                      <p key={`${block.id}-${index}`} style={block.alignment}>
                        {paragraph}
                      </p>
                    ))}
                  </section>
                )
              )}
            </div>
          </section>
        ))}
        {loading && !blocks.length ? (
          <div className={styles.emptyState}>Загружаем извлечённый текст...</div>
        ) : !blocks.length ? (
          <div className={styles.emptyState}>Извлечённый текст пока недоступен. Запустите индексацию или дождитесь обработки документа.</div>
        ) : null}
      </div>
    </article>
  );
}

function ExtractedTable({ block }: { block: Extract<ExtractedContentBlock, { kind: "table" }> }) {
  return (
    <section className={styles.extractedTableBlock}>
      {block.caption ? <h5>{block.caption}</h5> : null}
      <div className={styles.extractedTableScroll}>
        <table className={styles.extractedTable}>
          <thead>
            <tr>
              {block.headers.map((header, index) => (
                <th key={`${header}-${index}`}>{header || `Колонка ${index + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {block.headers.map((_, cellIndex) => (
                  <td key={cellIndex}>{row[cellIndex] || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SourcesFilesTree(props: {
  sources: KnowledgeBaseSource[];
  selectedSourceId: string | null;
  onView: (sourceId: string) => void;
  onExclude: (sourceId: string) => void;
  onReindex: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const tree = useMemo(
    () =>
      collapseLinearFolderChainsInTree(
        buildSourceFileTree(
          props.sources.map((source) => ({
            id: source.id,
            relativePath: sourceRelativePath(source),
            fileSize: source.file_size ?? undefined
          }))
        )
      ),
    [props.sources]
  );

  const fileMetaById = useMemo(() => {
    const map: Record<string, SourceFileTreeFileMeta> = {};
    for (const source of props.sources) {
      map[source.id] = {
        statusLabel: sourceStatusLabels[source.processing_status] ?? source.processing_status,
        metaText: `${formatNumber(source.fragments_count)} фр.`,
        trailing: (
          <SourceRowMenu
            source={source}
            open={openMenuId === source.id}
            onOpenChange={(open) => setOpenMenuId(open ? source.id : null)}
            onView={() => {
              setOpenMenuId(null);
              props.onView(source.id);
            }}
            onReindex={() => {
              setOpenMenuId(null);
              props.onReindex(source.id);
            }}
            onExclude={() => {
              setOpenMenuId(null);
              props.onExclude(source.id);
            }}
            onDelete={() => {
              setOpenMenuId(null);
              props.onDelete(source.id);
            }}
          />
        )
      };
    }
    return map;
  }, [openMenuId, props]);

  return (
    <div className={styles.sourcesTreeWrap}>
      <div className={styles.sourcesTreeHead}>
        <span>Структура</span>
        <span>Статус</span>
        <span>Фрагменты</span>
        <span aria-hidden="true" />
      </div>
      <SourceFileTree
        className={styles.sourcesTreeBody}
        tree={tree}
        fileMetaById={fileMetaById}
        richLayout
        selectedFileId={props.selectedSourceId}
        onFileSelect={props.onView}
      />
    </div>
  );
}

function SourceRowMenu(props: {
  source: KnowledgeBaseSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onView: () => void;
  onReindex: () => void;
  onExclude: () => void;
  onDelete: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const indexing = props.source.processing_status === "processing";

  const updateMenuPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, left: rect.left });
  };

  useLayoutEffect(() => {
    if (!props.open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      props.onOpenChange(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") props.onOpenChange(false);
    }

    function handleReposition() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [props.open, props.onOpenChange]);

  const menu =
    props.open && menuPosition
      ? createPortal(
          <ul
            ref={menuRef}
            className={`${formStyles.selectMenu} ${formStyles.compact} ${styles.sourceRowMenuList}`}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            role="menu"
          >
            <li role="none">
              <button type="button" className={formStyles.selectOption} role="menuitem" onClick={props.onView}>
                Просмотр
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                className={formStyles.selectOption}
                role="menuitem"
                disabled={indexing}
                onClick={props.onReindex}
              >
                Переобработать
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                className={formStyles.selectOption}
                role="menuitem"
                disabled={indexing}
                onClick={props.onExclude}
              >
                Исключить
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                className={`${formStyles.selectOption} ${styles.sourceRowMenuDanger}`}
                role="menuitem"
                disabled={indexing}
                onClick={props.onDelete}
              >
                Удалить
              </button>
            </li>
          </ul>,
          document.body
        )
      : null;

  return (
    <>
      <div className={`${formStyles.compact} ${styles.sourceRowMenu}`}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.sourceRowMenuTrigger}
          aria-label="Действия с файлом"
          aria-expanded={props.open}
          aria-haspopup="menu"
          onClick={() => props.onOpenChange(!props.open)}
        >
          <MoreVertical size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {menu}
    </>
  );
}

function StatusBadge({ status, indexing = false }: { status: KnowledgeBaseStatus; indexing?: boolean }) {
  const showIndexing = indexing && (status === "processing" || status === "updating" || status === "draft");
  const label = showIndexing ? "Индексация..." : statusLabels[status];
  return (
    <span
      className={`${styles.statusBadge} ${styles[`status_${showIndexing ? "processing" : status}`]} ${showIndexing ? styles.statusBadgeIndexing : ""}`}
    >
      {showIndexing ? <RefreshCw size={12} className={styles.statusSpinner} aria-hidden="true" /> : null}
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
        className={styles.kbQuickSearchForm}
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const trimmed = query.trim();
          if (trimmed && canSearch) search.mutate(trimmed);
        }}
      >
        <div className={`${formStyles.selectField} ${formStyles.compact} ${styles.kbQuickSearchField}`}>
          <Search className={formStyles.selectSearch} size={14} strokeWidth={2} aria-hidden="true" />
          <input
            className={formStyles.control}
            type="search"
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
        </div>
        <button
          type="submit"
          className={styles.kbQuickSearchSubmit}
          disabled={!canSearch || search.isPending || !query.trim()}
        >
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

function isDateTableColumn(header: string) {
  return header === "Дата" || header === "Запуск" || header === "Обновлено" || header === "Последняя индексация";
}

function CompactTable({
  headers,
  rows,
  empty,
  wrapClassName,
  tableClassName
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
  wrapClassName?: string;
  tableClassName?: string;
}) {
  const actionsColumnIndex = headers.length - 1;
  return (
    <div className={[styles.tableWrap, wrapClassName].filter(Boolean).join(" ")}>
      <div className={styles.tableWrapScroll}>
        <table className={[styles.compactTable, tableClassName].filter(Boolean).join(" ")}>
          <thead className={styles.compactTableHead}>
            <tr>
              {headers.map((header) => (
                <th key={header} className={isDateTableColumn(header) ? styles.compactTableColDate : undefined}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${index}-${cellIndex}`}
                    className={[
                      cellIndex === actionsColumnIndex && headers[actionsColumnIndex] === "Действия" ? styles.actionsCell : "",
                      isDateTableColumn(headers[cellIndex] ?? "") ? styles.compactTableColDate : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
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
    </div>
  );
}

function Pipeline() {
  const steps = [
    { label: "Загрузка документа", icon: Upload, tone: "blue" as const },
    { label: "Извлечение текста", icon: FileText, tone: "blue" as const },
    { label: "Проверка качества", icon: ShieldCheck, tone: "green" as const },
    { label: "Разрешение на использование", icon: LockKeyhole, tone: "violet" as const },
    { label: "Разбиение на фрагменты", icon: Layers3, tone: "blue" as const },
    { label: "Создание embeddings", icon: Sparkles, tone: "violet" as const },
    { label: "Индексация в Qdrant", icon: Database, tone: "green" as const },
    { label: "Доступ для ИИ-агентов", icon: Bot, tone: "blue" as const }
  ];

  return (
    <section className={styles.pipeline} aria-labelledby="kb-pipeline-title">
      <h2 id="kb-pipeline-title" className={styles.pipelineTitle}>
        Как документ становится частью базы знаний
      </h2>
        <div className={styles.pipelineBoard}>
        <svg className={styles.pipelineLineSvg} viewBox="0 0 960 8" aria-hidden="true">
          <path className={styles.pipelineLineBase} d="M16 4 H944" strokeDasharray="4 6" />
        </svg>
        <div className={styles.pipelineSteps}>
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.label}
                className={`${styles.pipelineStep} ${styles[`pipelineStep_${step.tone}`]}`}
              >
                <div className={styles.pipelineStepBody}>
                  <span className={`${styles.pipelineStepIcon} ${styles[`pipelineStepIcon_${step.tone}`]}`}>
                    <Icon size={18} strokeWidth={2.1} color="#ffffff" aria-hidden="true" />
                  </span>
                  <p className={styles.pipelineStepLabel}>{step.label}</p>
                </div>
              </article>
            );
          })}
        </div>
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
      { id: "ocr_extraction", label: "Извлечение данных OCR", status: "pending" },
      { id: "chunking", label: "Разбиение на фрагменты", status: "pending" },
      { id: "embeddings", label: "Создание embeddings", status: "pending" },
      { id: "qdrant", label: "Индексация в Qdrant", status: "pending" },
      { id: "fulltext", label: "Полнотекстовый индекс", status: "pending" },
      { id: "quality_control", label: "Контроль качества", status: "pending" }
    ];
  }
  const current = String(job.processing_params?.current_stage ?? "");
  const stageOrder = ["precheck", "text_extraction", "ocr_extraction", "chunking", "embeddings", "qdrant", "fulltext", "quality_control", "stopping", "stopped"];
  const currentIndex = stageOrder.indexOf(current);
  const ocrSourcesCount = Number(job.processing_params?.ocr_sources_count ?? 0);

  const defs = [
    { id: "precheck", label: "Проверка источников", done: (job.total_sources_count ?? 0) > 0 },
    { id: "text_extraction", label: "Извлечение текста и структуры", done: (job.extracted_sources_count ?? 0) > 0, detail: `${job.extracted_sources_count ?? 0}/${totalSources}` },
    {
      id: "ocr_extraction",
      label: "Извлечение данных OCR",
      done: currentIndex > stageOrder.indexOf("ocr_extraction") || (job.chunked_sources_count ?? 0) > 0,
      detail: ocrSourcesCount > 0 ? `${ocrSourcesCount}/${totalSources}` : undefined,
      hidden: ocrSourcesCount === 0 && current !== "ocr_extraction"
    },
    { id: "chunking", label: "Разбиение на фрагменты", done: (job.chunked_sources_count ?? 0) > 0, detail: `${job.chunked_sources_count ?? 0}/${totalSources}` },
    { id: "embeddings", label: "Создание embeddings", done: (job.embedded_chunks_count ?? 0) > 0, detail: `${job.embedded_chunks_count ?? 0}/${totalChunks}` },
    { id: "qdrant", label: "Индексация в Qdrant", done: (job.qdrant_points_count ?? 0) > 0, detail: `${job.qdrant_points_count ?? 0}/${totalChunks}` },
    { id: "fulltext", label: "Полнотекстовый индекс", done: (job.fulltext_chunks_count ?? 0) > 0, detail: `${job.fulltext_chunks_count ?? 0}/${totalChunks}` },
    { id: "quality_control", label: "Контроль качества", done: job.status === "completed" || job.status === "partial" }
  ];

  return defs.map((stage) => {
    const stageIndex = stageOrder.indexOf(stage.id);
    let status: IndexingStageStatus = "pending";
    if (current === stage.id) {
      status = "running";
    } else if (stage.done || (currentIndex >= 0 && stageIndex < currentIndex)) {
      status = "done";
    }
    return { ...stage, status };
  }).filter((stage) => !stage.hidden);
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
  const [open, setOpen] = useState(false);
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
  query
}: {
  hit: KnowledgeBaseSearchHit;
  index: number;
  query: string;
}) {
  const [expanded, setExpanded] = useState(false);
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
