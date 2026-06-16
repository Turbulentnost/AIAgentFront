import type { ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
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
import { knowledgeBasesApi, usersApi } from "@/api/endpoints";
import type {
  KnowledgeBaseAccessGrantInput,
  KnowledgeBaseAgentBinding,
  KnowledgeBaseListItem,
  KnowledgeBaseOverviewStats,
  KnowledgeBaseReadiness,
  ResponsibleUser,
  User
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

type DetailTab = "overview" | "sources" | "chunks" | "rules" | "indexing" | "test" | "audit";

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

  const platformUsers = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list()
  });

  const metadata = detail.data?.metadata;
  const baseKind = getBaseKindLabel(metadata);
  const responsible = findResponsibleUser(responsibleUsers.data, knowledgeBase.responsible_user_id);
  const filesCount = stats?.sources_total ?? knowledgeBase.sources_count ?? 0;
  const storageVolume = formatStorageBytes(knowledgeBase.storage_bytes);
  const warningCount = stats?.unresolved_errors ?? 0;
  const fragmentsTotal = stats?.fragments_total ?? knowledgeBase.fragments_count ?? 0;
  const fragmentsReady = stats
    ? Math.min(stats.qdrant_points, stats.fulltext_chunks, fragmentsTotal)
    : 0;

  const searchAvailable = knowledgeBase.can_search && !isIndexingActive;
  const qdrantReady = Boolean(stats && fragmentsTotal > 0 && stats.qdrant_points >= fragmentsTotal);
  const fulltextReady = Boolean(stats && fragmentsTotal > 0 && stats.fulltext_chunks >= fragmentsTotal);
  const connectedAgents = agents.filter((agent) => agent.is_enabled).length;
  const accessUsersList = formatAccessUsersList(
    accessGrants,
    platformUsers.data,
    responsibleUsers.data,
    knowledgeBase.is_public
  );
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

      <div className={styles.overviewTileRow}>
        <section className={`${styles.overviewSection} ${styles.overviewSectionTile}`}>
          <header className={styles.overviewSectionHead}>
            <span className={`${styles.overviewSectionIcon} ${styles.overviewIconWarning}`} aria-hidden="true">
              <Lightbulb size={16} strokeWidth={2.2} />
            </span>
            <h3 className={styles.overviewSectionTitle}>Что сделать дальше</h3>
          </header>
          <div className={styles.overviewSectionBody}>
            <p className={`${styles.overviewSectionDesc} ${styles.overviewSectionDescTile}`}>{nextStepsDescription}</p>
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
            </div>
          </div>
        </section>

        <section className={`${styles.overviewSection} ${styles.overviewSectionTile}`}>
          <header className={styles.overviewSectionHead}>
            <span className={`${styles.overviewSectionIcon} ${styles.overviewIconInfo}`} aria-hidden="true">
              <Database size={16} strokeWidth={2.2} />
            </span>
            <h3 className={styles.overviewSectionTitle}>Индексация</h3>
          </header>
          <div className={styles.overviewSectionBody}>
            <div className={styles.overviewGridSingle}>
              <OverviewRow label="Последняя индексация" value={formatOverviewDate(knowledgeBase.last_indexed_at)} />
              <OverviewRow label="Фрагменты" value={`${fragmentsReady} / ${fragmentsTotal}`} />
            </div>
            {warningCount > 0 ? (
              <p className={styles.overviewWarningNote}>
                <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
                {formatWarningNote(warningCount)}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className={styles.overviewTileRow}>
        <section className={`${styles.overviewSection} ${styles.overviewSectionTile}`}>
          <header className={styles.overviewSectionHead}>
            <span className={`${styles.overviewSectionIcon} ${styles.overviewIconInfo}`} aria-hidden="true">
              <Info size={16} strokeWidth={2.2} />
            </span>
            <h3 className={styles.overviewSectionTitle}>Основная информация</h3>
          </header>
          <div className={styles.overviewSectionBody}>
            <div className={styles.overviewGridSingle}>
              <OverviewRow label="Название" value={knowledgeBase.name} />
              <OverviewRow label="Описание" value={knowledgeBase.description?.trim() || "—"} valueWrap />
              <OverviewRow label="Тип базы" value={baseKind} />
              <OverviewRow label="Объем хранилища" value={storageVolume} />
              <OverviewRow label="Ответственный" value={responsible ?? "—"} />
              <OverviewRow label="Кол-во файлов" value={String(filesCount)} />
            </div>
          </div>
        </section>

        <section className={`${styles.overviewSection} ${styles.overviewSectionTile}`}>
          <header className={styles.overviewSectionHead}>
            <span className={`${styles.overviewSectionIcon} ${styles.overviewIconMuted}`} aria-hidden="true">
              <Users size={16} strokeWidth={2.2} />
            </span>
            <h3 className={styles.overviewSectionTitle}>Использование</h3>
          </header>
          <div className={styles.overviewSectionBody}>
            <div className={styles.overviewGridSingle}>
              <OverviewRow
                label="Обычный поиск"
                value={normalSearchAvailable ? "доступен" : "недоступен"}
                valueTone={normalSearchAvailable ? "success" : undefined}
              />
              <OverviewRow label="Подключенные агенты" value={String(connectedAgents)} />
              <OverviewRow label="Список пользователей" value={accessUsersList} valueWrap />
            </div>
          </div>
        </section>
      </div>
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

function OverviewRow(props: { label: string; value: string; valueTone?: "success"; valueWrap?: boolean }) {
  return (
    <div className={styles.overviewRow}>
      <span className={styles.overviewLabel}>{props.label}</span>
      <span
        className={`${styles.overviewValue} ${props.valueWrap ? styles.overviewValueWrap : ""} ${props.valueTone === "success" ? styles.overviewValueSuccess : ""}`}
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
  return formatShortPersonName(user.full_name);
}

function formatShortPersonName(fullName?: string | null): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const [lastName, ...rest] = parts;
  const initials = rest.map((part) => `${part.charAt(0).toUpperCase()}.`).join(" ");
  return `${lastName} ${initials}`.trim();
}

function formatAccessUsersList(
  grants: KnowledgeBaseAccessGrantInput[],
  users: User[] | undefined,
  responsibleUsers: ResponsibleUser[] | undefined,
  isPublic: boolean
): string {
  if (isPublic) return "Все пользователи";

  const userGrants = grants.filter((grant) => grant.grantee_type === "user" && grant.grantee_id);
  if (userGrants.length === 0) return "—";

  const namesById = new Map<string, string>();
  for (const user of users ?? []) {
    namesById.set(user.id, formatShortPersonName(user.full_name));
  }
  for (const user of responsibleUsers ?? []) {
    if (!namesById.has(user.id)) {
      namesById.set(user.id, formatShortPersonName(user.full_name));
    }
  }

  const uniqueNames = [...new Set(
    userGrants.map((grant) => namesById.get(grant.grantee_id!) ?? grant.grantee_id!)
  )];

  return uniqueNames.join(", ");
}

function formatStorageBytes(value?: number | null): string {
  if (!value) return "—";
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} МБ`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
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
  const actuallyReady = isKnowledgeBaseActuallyReady(kb, stats, isIndexingActive);

  if (actuallyReady) {
    parts.push("База готова к поиску и подключению агентов.");
  } else if (kb.status === "draft") {
    parts.push("База ещё не готова: добавьте источники и запустите индексацию.");
  } else if (kb.status === "needs_review") {
    parts.push("Индексация завершена частично: проверьте предупреждения и проблемные источники.");
  } else if (kb.status === "error") {
    parts.push("Индексация завершилась с ошибкой: проверьте журнал индексации и источники.");
  } else if (kb.status === "ready") {
    parts.push("База почти готова: дождитесь завершения индексации всех источников и фрагментов.");
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

function isKnowledgeBaseActuallyReady(
  kb: KnowledgeBaseListItem,
  stats: KnowledgeBaseOverviewStats | undefined,
  isIndexingActive: boolean
): boolean {
  if (isIndexingActive || kb.indexing_active || kb.status === "processing" || kb.status === "draft" || kb.status === "error" || kb.status === "archived") {
    return false;
  }

  if (!kb.can_search) return false;

  if (!["ready", "needs_review"].includes(kb.status)) return false;

  if (!stats) {
    return kb.status === "ready" && (kb.fragments_count ?? 0) > 0;
  }

  if (stats.fragments_total === 0) return false;

  const sourcesReady = stats.sources_total === 0 || stats.sources_processed >= stats.sources_total;
  const fragmentsIndexed =
    stats.qdrant_points >= stats.fragments_total && stats.fulltext_chunks >= stats.fragments_total;

  return sourcesReady && fragmentsIndexed;
}
