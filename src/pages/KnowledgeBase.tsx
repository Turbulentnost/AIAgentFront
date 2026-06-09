import { FormEvent, useEffect, useMemo, useState } from "react";
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
  TriangleAlert
} from "lucide-react";
import { knowledgeBasesApi } from "@/api/endpoints";
import { FormSearchInput, FormSelect } from "@/components/form-controls";
import type {
  KnowledgeBase,
  KnowledgeBaseAccessType,
  KnowledgeBaseAgentBinding,
  KnowledgeBaseChunk,
  KnowledgeBaseIndexingJob,
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
  const selected = useMemo(
    () => knowledgeBases.data?.find((item) => item.id === selectedId) ?? knowledgeBases.data?.[0] ?? null,
    [knowledgeBases.data, selectedId]
  );

  useEffect(() => {
    const requestedId = searchParams.get("kb");
    if (requestedId && knowledgeBases.data?.some((item) => item.id === requestedId)) {
      setSelectedId(requestedId);
      return;
    }
    if (!selectedId && knowledgeBases.data?.[0]) setSelectedId(knowledgeBases.data[0].id);
  }, [knowledgeBases.data, searchParams, selectedId]);

  const sources = useQuery({
    queryKey: ["knowledge-base-sources", selected?.id],
    queryFn: () => knowledgeBasesApi.sources(selected!.id),
    enabled: Boolean(selected)
  });
  const chunks = useQuery({
    queryKey: ["knowledge-base-chunks", selected?.id],
    queryFn: () => knowledgeBasesApi.chunks(selected!.id),
    enabled: Boolean(selected)
  });
  const rules = useQuery({
    queryKey: ["knowledge-base-rules", selected?.id],
    queryFn: () => knowledgeBasesApi.rules(selected!.id),
    enabled: Boolean(selected)
  });
  const agents = useQuery({
    queryKey: ["knowledge-base-agents", selected?.id],
    queryFn: () => knowledgeBasesApi.agents(selected!.id),
    enabled: Boolean(selected)
  });
  const jobs = useQuery({
    queryKey: ["knowledge-base-jobs", selected?.id],
    queryFn: () => knowledgeBasesApi.jobs(selected!.id),
    enabled: Boolean(selected)
  });
  const access = useQuery({
    queryKey: ["knowledge-base-access", selected?.id],
    queryFn: () => knowledgeBasesApi.access(selected!.id),
    enabled: Boolean(selected)
  });
  const audit = useQuery({
    queryKey: ["knowledge-base-audit", selected?.id],
    queryFn: () => knowledgeBasesApi.audit(selected!.id),
    enabled: Boolean(selected)
  });

  const startIndexing = useMutation({
    mutationFn: (knowledgeBaseId: string) => knowledgeBasesApi.index(knowledgeBaseId, { job_type: "full" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-base-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });

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
              {(knowledgeBases.data ?? []).map((item) => (
                <tr
                  key={item.id}
                  className={selected?.id === item.id ? styles.selectedRow : undefined}
                  onClick={() => {
                    setSelectedId(item.id);
                    setActiveTab("overview");
                  }}
                >
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.description || item.topic || "Описание не задано"}</small>
                  </td>
                  <td>{item.sources_count}</td>
                  <td>{formatNumber(item.fragments_count)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{formatDate(item.updated_at)}</td>
                </tr>
              ))}
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
              <div className={styles.detailHeader}>
                <div>
                  <h2>{selected.name}</h2>
                  <StatusBadge status={selected.status} />
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => startIndexing.mutate(selected.id)}
                  disabled={startIndexing.isPending}
                  title="Запустить переиндексацию"
                >
                  <RefreshCw size={17} />
                </button>
              </div>
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
                accessGrants={access.data?.grants ?? []}
                audit={audit.data ?? []}
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
  knowledgeBase: KnowledgeBase;
  sources: KnowledgeBaseSource[];
  chunks: KnowledgeBaseChunk[];
  rules: KnowledgeBaseRule[];
  agents: KnowledgeBaseAgentBinding[];
  jobs: KnowledgeBaseIndexingJob[];
  accessGrants: { grantee_type: string; grantee_id?: string | null; access_type: KnowledgeBaseAccessType; expires_at?: string | null; reason?: string | null; comment?: string | null }[];
  audit: Record<string, unknown>[];
}) {
  const { tab, knowledgeBase, sources, chunks, rules, agents, jobs, accessGrants, audit } = props;
  const [testQuery, setTestQuery] = useState("");
  const [testHits, setTestHits] = useState<KnowledgeBaseSearchHit[]>([]);
  const testSearch = useMutation({
    mutationFn: (query: string) => knowledgeBasesApi.testSearch(knowledgeBase.id, { query, top_k: 5 }),
    onSuccess: (result) => setTestHits(result.hits)
  });

  if (tab === "overview") {
    return (
      <div className={styles.detailBody}>
        <InfoGrid
          items={[
            ["Подразделение-владелец", knowledgeBase.department_id || "-"],
            ["Ответственный", knowledgeBase.responsible_user_id || "-"],
            ["Тематика / процесс", knowledgeBase.topic || knowledgeBase.process_slug || "-"],
            ["Embedding-модель", knowledgeBase.embedding_model || "-"],
            ["Векторное хранилище", knowledgeBase.vector_store],
            ["Qdrant collection", knowledgeBase.qdrant_collection],
            ["Последняя индексация", formatDate(knowledgeBase.last_indexed_at)]
          ]}
        />
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
      <CompactTable
        headers={["Документ", "Расширение", "Статус", "Фрагменты", "Индексация"]}
        rows={sources.map((source) => [
          source.document_title || source.original_filename || source.document_id,
          source.extension || "-",
          source.processing_status,
          formatNumber(source.fragments_count),
          formatDate(source.last_indexed_at)
        ])}
        empty="Источники ещё не добавлены."
      />
    );
  }

  if (tab === "chunks") {
    return (
      <div className={styles.chunkList}>
        {chunks.map((chunk) => (
          <article key={chunk.id} className={styles.chunkCard}>
            <header>
              <strong>{chunk.document_title || "Источник не найден"}</strong>
              <span>{chunk.embedding_status}</span>
            </header>
            <p>{chunk.text || "Текст фрагмента недоступен"}</p>
            <small>
              Страница {chunk.page_number ?? "-"} · Раздел {chunk.section_title || "-"} · Доступ{" "}
              {chunk.is_excluded_from_search ? "исключён из поиска" : "активен"}
            </small>
          </article>
        ))}
        {!chunks.length && <div className={styles.emptyState}>Фрагменты появятся после индексации источников.</div>}
      </div>
    );
  }

  if (tab === "rules") {
    return (
      <CompactTable
        headers={["Правило", "Область", "Условие", "Действие", "Статус"]}
        rows={rules.map((rule) => [rule.text, rule.scope || "-", rule.condition || "-", rule.agent_action || "-", rule.status])}
        empty="Структурированные правила для агентов ещё не заведены."
      />
    );
  }

  if (tab === "access") {
    return (
      <div className={styles.accessList}>
        {accessGrants.map((grant, index) => (
          <article key={`${grant.grantee_type}-${grant.grantee_id ?? index}`}>
            <LockKeyhole size={17} />
            <div>
              <strong>{grant.grantee_type === "department" ? "Подразделение" : grant.grantee_type === "user" ? "Пользователь" : "Агент / администратор"}</strong>
              <span>{accessLabels[grant.access_type]}</span>
              <small>
                ID: {grant.grantee_id || "только администраторы"} · Основание: {grant.reason || "-"} · Срок: {formatDate(grant.expires_at)}
              </small>
            </div>
          </article>
        ))}
        {!accessGrants.length && <div className={styles.emptyState}>Доступ не настроен. По умолчанию база не общедоступна.</div>}
      </div>
    );
  }

  if (tab === "agents") {
    return (
      <CompactTable
        headers={["Агент", "Режим", "Статус", "Срок"]}
        rows={agents.map((agent) => [agent.agent_id, agent.access_mode, agent.is_enabled ? "Включён" : "Отключён", formatDate(agent.expires_at)])}
        empty="Ни один агент не подключён к базе знаний."
      />
    );
  }

  if (tab === "indexing") {
    return (
      <CompactTable
        headers={["Тип", "Статус", "Источники", "Создано", "Ошибки", "Длительность"]}
        rows={jobs.map((job) => [
          job.job_type,
          job.status,
          formatNumber(job.processed_sources_count),
          formatNumber(job.created_fragments_count + job.updated_fragments_count),
          formatNumber(job.errors_count),
          job.duration_ms ? `${job.duration_ms} мс` : "-"
        ])}
        empty="Заданий индексации ещё не было."
      />
    );
  }

  if (tab === "test") {
    return (
      <div className={styles.testSearch}>
        <form
          className={styles.testSearchForm}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (testQuery.trim()) testSearch.mutate(testQuery.trim());
          }}
        >
          <FormSearchInput
            value={testQuery}
            onChange={setTestQuery}
            placeholder="Введите тестовый вопрос"
          />
          <button type="submit" className={styles.primaryButton} disabled={testSearch.isPending}>
            <Play size={15} strokeWidth={2} aria-hidden="true" />
            Проверить
          </button>
        </form>
        {testHits.map((hit) => (
          <article key={hit.knowledge_base_chunk_id || hit.chunk_id || hit.content.slice(0, 20)}>
            <strong>{hit.document_title || "Источник"}</strong>
            <span>Релевантность {hit.score.toFixed(3)} · {hit.accessible ? "доступен" : "нет доступа"}</span>
            <p>{hit.content}</p>
          </article>
        ))}
      </div>
    );
  }

  return (
    <CompactTable
      headers={["Действие", "Пользователь", "Дата"]}
      rows={audit.map((item) => [String(item.action ?? "-"), String(item.actor_id ?? "-"), formatDate(String(item.created_at ?? ""))])}
      empty="Журнал действий пока пуст."
    />
  );
}

function StatusBadge({ status }: { status: KnowledgeBaseStatus }) {
  return <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>{statusLabels[status]}</span>;
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

function CompactTable({ headers, rows, empty }: { headers: string[]; rows: (string | number)[][]; empty: string }) {
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
