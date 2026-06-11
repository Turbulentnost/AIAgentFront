import type { ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  Database,
  Droplets,
  Hexagon,
  Info,
  Lightbulb,
  Search,
  Target,
  TriangleAlert,
  Users
} from "lucide-react";
import { knowledgeBasesApi } from "@/api/endpoints";
import type {
  KnowledgeBaseAccessGrantInput,
  KnowledgeBaseAgentBinding,
  KnowledgeBaseListItem,
  KnowledgeBaseOverviewStats,
  KnowledgeBaseReadiness,
  ResponsibleUser
} from "@/types";
import styles from "@/pages/KnowledgeBase.module.css";

type BaseKind = "normative" | "technical" | "project" | "contract" | "process";

const baseKindLabels: Record<BaseKind, string> = {
  normative: "Нормативная",
  technical: "Техническая",
  project: "Проектная",
  contract: "Договорная",
  process: "Процессная"
};

type DetailTab = "overview" | "sources" | "chunks" | "rules" | "access" | "agents" | "indexing" | "test" | "audit";

export function KnowledgeBaseOverviewTab(props: {
  knowledgeBase: KnowledgeBaseListItem;
  stats?: KnowledgeBaseOverviewStats;
  statsLoading: boolean;
  readiness?: KnowledgeBaseReadiness;
  agents: KnowledgeBaseAgentBinding[];
  accessGrants: KnowledgeBaseAccessGrantInput[];
  isIndexingActive: boolean;
  canTestSearch: boolean;
  onTabChange: (tab: DetailTab) => void;
}) {
  const {
    knowledgeBase,
    stats,
    statsLoading,
    readiness,
    agents,
    accessGrants,
    isIndexingActive,
    canTestSearch,
    onTabChange
  } = props;

  const detail = useQuery({
    queryKey: ["knowledge-base-detail", knowledgeBase.id],
    queryFn: () => knowledgeBasesApi.get(knowledgeBase.id)
  });

  const responsibleUsers = useQuery({
    queryKey: ["knowledge-base-responsible-users"],
    queryFn: () => knowledgeBasesApi.listResponsibleUsers()
  });

  const metadata = detail.data?.metadata;
  const baseKind = getBaseKindLabel(metadata);
  const responsible = findResponsibleUser(responsibleUsers.data, knowledgeBase.responsible_user_id);
  const warningCount = stats?.unresolved_errors ?? 0;
  const fragmentsTotal = stats?.fragments_total ?? knowledgeBase.fragments_count ?? 0;
  const fragmentsReady = stats
    ? Math.min(stats.qdrant_points, stats.fulltext_chunks, fragmentsTotal)
    : 0;

  const searchAvailable = knowledgeBase.can_search && !isIndexingActive;
  const qdrantReady = Boolean(stats && fragmentsTotal > 0 && stats.qdrant_points >= fragmentsTotal);
  const fulltextReady = Boolean(stats && fragmentsTotal > 0 && stats.fulltext_chunks >= fragmentsTotal);
  const connectedAgents = agents.filter((agent) => agent.is_enabled).length;
  const accessConfigured = accessGrants.length > 0 || knowledgeBase.is_public;
  const normalSearchAvailable = searchAvailable && ["ready", "needs_review", "updating"].includes(knowledgeBase.status);

  const statusDescription = buildStatusDescription(knowledgeBase, stats, warningCount, isIndexingActive);
  const nextStepsDescription =
    readiness?.recommendation?.trim() ||
    "Протестируйте поиск и проверьте предупреждение, чтобы убедиться в качестве извлечения и корректности данных.";

  if (statsLoading && !stats) {
    return (
      <div className={styles.overviewTab}>
        <div className={styles.overviewLoading}>Загрузка обзора…</div>
      </div>
    );
  }

  return (
    <div className={styles.overviewTab}>
      <section className={styles.overviewSection}>
        <header className={styles.overviewSectionHead}>
          <span className={`${styles.overviewSectionIcon} ${styles.overviewIconSuccess}`} aria-hidden="true">
            <CheckCircle2 size={16} strokeWidth={2.2} />
          </span>
          <h3 className={styles.overviewSectionTitle}>Состояние базы знаний</h3>
        </header>
        <p className={styles.overviewSectionDesc}>{statusDescription}</p>
        <div className={styles.overviewBadges}>
          <OverviewBadge tone="success" icon={Search} label={`Поиск: ${searchAvailable ? "доступен" : "недоступен"}`} />
          <OverviewBadge tone="success" icon={Target} label={`Qdrant: ${qdrantReady ? "готов" : "не готов"}`} />
          <OverviewBadge
            tone="success"
            icon={Hexagon}
            label={`Полнотекстовый индекс: ${fulltextReady ? "готов" : "не готов"}`}
          />
          <OverviewBadge tone="info" icon={Droplets} label={`Фрагменты: ${fragmentsReady} / ${fragmentsTotal}`} />
          {warningCount > 0 ? (
            <OverviewBadge tone="warning" icon={TriangleAlert} label={`Предупреждений: ${warningCount}`} />
          ) : null}
        </div>
      </section>

      <section className={styles.overviewSection}>
        <header className={styles.overviewSectionHead}>
          <span className={`${styles.overviewSectionIcon} ${styles.overviewIconWarning}`} aria-hidden="true">
            <Lightbulb size={16} strokeWidth={2.2} />
          </span>
          <h3 className={styles.overviewSectionTitle}>Что сделать дальше</h3>
        </header>
        <p className={styles.overviewSectionDesc}>{nextStepsDescription}</p>
        <div className={styles.overviewActions}>
          <button
            type="button"
            className={styles.overviewPrimaryButton}
            onClick={() => onTabChange("test")}
            disabled={!canTestSearch}
          >
            <Search size={15} strokeWidth={2.2} aria-hidden="true" />
            Тестировать поиск
          </button>
          {warningCount > 0 ? (
            <button type="button" className={styles.overviewLinkButton} onClick={() => onTabChange("indexing")}>
              Открыть предупреждение
              <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </section>

      <section className={styles.overviewSection}>
        <header className={styles.overviewSectionHead}>
          <span className={`${styles.overviewSectionIcon} ${styles.overviewIconInfo}`} aria-hidden="true">
            <Info size={16} strokeWidth={2.2} />
          </span>
          <h3 className={styles.overviewSectionTitle}>Основная информация</h3>
        </header>
        <div className={styles.overviewGrid}>
          <div className={styles.overviewGridCol}>
            <OverviewRow label="Название" value={knowledgeBase.name} />
            <OverviewRow label="Описание" value={knowledgeBase.description?.trim() || "—"} />
            <OverviewRow label="Тип базы" value={baseKind} />
          </div>
          <div className={styles.overviewGridCol}>
            <OverviewRow
              label="Тематика / процесс"
              value={knowledgeBase.topic?.trim() || knowledgeBase.process_slug?.trim() || "—"}
            />
            <OverviewRow label="Ответственный" value={responsible ?? "—"} />
            <OverviewRow label="Embedding-модель" value={knowledgeBase.embedding_model?.trim() || "—"} />
          </div>
        </div>
      </section>

      <section className={styles.overviewSection}>
        <header className={styles.overviewSectionHead}>
          <span className={`${styles.overviewSectionIcon} ${styles.overviewIconInfo}`} aria-hidden="true">
            <Database size={16} strokeWidth={2.2} />
          </span>
          <h3 className={styles.overviewSectionTitle}>Индексация</h3>
        </header>
        <div className={styles.overviewGrid}>
          <div className={styles.overviewGridCol}>
            <OverviewRow label="Последняя индексация" value={formatOverviewDate(knowledgeBase.last_indexed_at)} />
            <OverviewRow
              label="Источники"
              value={stats ? `${stats.sources_processed} / ${stats.sources_total}` : `${knowledgeBase.sources_count} / ${knowledgeBase.sources_count}`}
            />
            <OverviewRow label="Фрагменты" value={`${fragmentsReady} / ${fragmentsTotal}`} />
          </div>
          <div className={styles.overviewGridCol}>
            <OverviewRow label="В Qdrant" value={stats ? `${stats.qdrant_points} / ${fragmentsTotal}` : "—"} />
            <OverviewRow
              label="В полнотекстовом индексе"
              value={stats ? `${stats.fulltext_chunks} / ${fragmentsTotal}` : "—"}
            />
            <OverviewRow
              label="Качество извлечения"
              value={stats ? `${stats.quality_percent}%` : "—"}
            />
          </div>
        </div>
        {warningCount > 0 ? (
          <p className={styles.overviewWarningNote}>
            <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
            {formatWarningNote(warningCount)}
          </p>
        ) : null}
      </section>

      <section className={styles.overviewSection}>
        <header className={styles.overviewSectionHead}>
          <span className={`${styles.overviewSectionIcon} ${styles.overviewIconMuted}`} aria-hidden="true">
            <Users size={16} strokeWidth={2.2} />
          </span>
          <h3 className={styles.overviewSectionTitle}>Использование</h3>
        </header>
        <div className={styles.overviewGrid}>
          <div className={styles.overviewGridCol}>
            <OverviewRow
              label="Обычный поиск"
              value={normalSearchAvailable ? "доступен" : "недоступен"}
              valueTone={normalSearchAvailable ? "success" : undefined}
            />
            <OverviewRow
              label="Тест поиска"
              value={canTestSearch ? "доступен" : "недоступен"}
              valueTone={canTestSearch ? "success" : undefined}
            />
          </div>
          <div className={styles.overviewGridCol}>
            <OverviewRow label="Подключенные агенты" value={String(connectedAgents)} />
            <OverviewRow
              label="Доступ пользователей"
              value={accessConfigured ? "настроен" : "не настроен"}
              valueTone={accessConfigured ? "success" : undefined}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function OverviewBadge(props: {
  tone: "success" | "info" | "warning";
  icon: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  label: string;
}) {
  const Icon = props.icon;
  return (
    <span className={`${styles.overviewBadge} ${styles[`overviewBadge_${props.tone}`]}`}>
      <Icon size={13} strokeWidth={2.2} aria-hidden={true} />
      {props.label}
    </span>
  );
}

function OverviewRow(props: { label: string; value: string; valueTone?: "success" }) {
  return (
    <div className={styles.overviewRow}>
      <span className={styles.overviewLabel}>{props.label}</span>
      <span
        className={`${styles.overviewValue} ${props.valueTone === "success" ? styles.overviewValueSuccess : ""}`}
      >
        {props.value}
      </span>
    </div>
  );
}

function getBaseKindLabel(metadata?: Record<string, unknown> | null): string {
  const kind = metadata?.base_kind;
  if (typeof kind === "string" && kind in baseKindLabels) {
    return baseKindLabels[kind as BaseKind];
  }
  return "—";
}

function findResponsibleUser(users: ResponsibleUser[] | undefined, userId?: string | null): string | null {
  if (!userId || !users) return null;
  const user = users.find((item) => item.id === userId);
  if (!user) return null;
  return formatResponsibleUserLabel(user);
}

function formatResponsibleUserLabel(user: ResponsibleUser): string {
  const name = user.full_name?.trim() || "Пользователь";
  const position = user.position?.trim();
  const department = user.department_name?.trim();
  if (position && department) return `${name} — ${position} (${department})`;
  if (position) return `${name} — ${position}`;
  if (department) return `${name} (${department})`;
  return name;
}

function formatOverviewDate(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatWarningNote(count: number): string {
  const word = count === 1 ? "предупреждение" : count >= 2 && count <= 4 ? "предупреждения" : "предупреждений";
  return `Есть ${count} ${word} после индексации`;
}

function buildStatusDescription(
  kb: KnowledgeBaseListItem,
  stats: KnowledgeBaseOverviewStats | undefined,
  warningCount: number,
  isIndexingActive: boolean
): string {
  if (isIndexingActive || kb.status === "processing") {
    return "Идёт индексация: поиск будет доступен после завершения обработки источников и записи фрагментов в индексы.";
  }

  const parts: string[] = [];

  if (kb.status === "ready") {
    parts.push("База готова к поиску и подключению агентов.");
  } else if (kb.status === "draft") {
    parts.push("База ещё не готова: добавьте источники и запустите индексацию.");
  } else if (kb.status === "needs_review") {
    parts.push("Индексация завершена частично: проверьте предупреждения и проблемные источники.");
  } else if (kb.status === "error") {
    parts.push("Индексация завершилась с ошибкой: проверьте журнал индексации и источники.");
  } else {
    parts.push("Проверьте состояние индексации и готовность базы к поиску.");
  }

  if (stats && stats.fragments_total > 0) {
    const allIndexed = stats.qdrant_points >= stats.fragments_total && stats.fulltext_chunks >= stats.fragments_total;
    if (allIndexed) {
      parts.push(
        `Все ${stats.fragments_total} фрагментов проиндексированы в Qdrant и полнотекстовом индексе.`
      );
    } else {
      parts.push(
        `Проиндексировано ${Math.min(stats.qdrant_points, stats.fulltext_chunks)} из ${stats.fragments_total} фрагментов в Qdrant и полнотекстовом индексе.`
      );
    }
  }

  if (warningCount > 0) {
    const suffix =
      warningCount === 1
        ? "предупреждение, которое рекомендуется проверить."
        : warningCount >= 2 && warningCount <= 4
          ? "предупреждения, которые рекомендуется проверить."
          : "предупреждений, которые рекомендуется проверить.";
    parts.push(`Есть ${warningCount} ${suffix}`);
  }

  return parts.join(" ");
}
