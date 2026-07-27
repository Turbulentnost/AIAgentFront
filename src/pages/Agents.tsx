import { useMemo, useRef, useState, useEffect } from "react";
import { Camera, Edit3, FolderOpen, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { hasDedicatedLaunchPage, navigateToAgentLaunch } from "@/utils/agentLaunch";
import { agentsApi, departmentsApi, tasksApi } from "@/api/endpoints";
import { AgentAccessEditor } from "@/components/AgentAccessEditor";
import { FormSelect } from "@/components/form-controls";
import type { AgentAccess, AgentStatus, Task } from "@/types";
import styles from "./Agents.module.css";

const AGENT_ILLUSTRATION = "/agent-catalog-illustration.png";
const ND_CONTROL_AGENT_ROUTE = "/agents/nd-control";
const INCOMING_MAIL_ROUTE = "/agents/incoming-mail";
const INCOMING_MAIL_DISPLAY_NAME = "Агент по входящей корреспонденции";

const INCOMING_MAIL_CATALOG_AGENT: AgentAccess = {
  id: "catalog-incoming_correspondence_agent",
  name: INCOMING_MAIL_DISPLAY_NAME,
  slug: "incoming_correspondence_agent",
  purpose:
    "ИИ-агент обрабатывает входящую корреспонденцию: фильтрует спам, определяет отправителя и отдел, формирует обзор и создаёт задачу в 1С:ERP.",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  access_level: "run",
  can_run: true,
  can_view_results: true,
  can_approve: false,
  can_configure: false
};

function withIncomingMailDisplayName(agents: AgentAccess[]) {
  return agents.map((agent) =>
    isIncomingMailAgent(agent) ? { ...agent, name: INCOMING_MAIL_DISPLAY_NAME } : agent
  );
}

function mergePinnedCatalogAgents(agents: AgentAccess[]) {
  const normalized = withIncomingMailDisplayName(agents);
  if (normalized.some(isIncomingMailAgent)) return normalized;
  return [INCOMING_MAIL_CATALOG_AGENT, ...normalized];
}

function isNdControlAgent(agent: AgentAccess) {
  const key = agentSearchKey(agent);
  return (
    agent.slug === "nd_control_agent" ||
    agent.slug === "nd-control" ||
    /nd[_-]?control/.test(key) ||
    /контрол.*нд|нд.*изменен/.test(key)
  );
}

function isIncomingMailAgent(agent: AgentAccess) {
  const key = agentSearchKey(agent);
  return (
    agent.slug === "agent_pochta" ||
    agent.slug === "incoming_correspondence_agent" ||
    agent.slug === "incoming-mail" ||
    /pochta|incoming.?mail|входящ.*корресп/.test(key)
  );
}

function getAgentRoute(agent: AgentAccess) {
  if (isNdControlAgent(agent)) return ND_CONTROL_AGENT_ROUTE;
  if (isIncomingMailAgent(agent)) return INCOMING_MAIL_ROUTE;
  return null;
}

type KindTab = "all" | "chat" | "abstract";
type CategoryFilter = "all" | "generative" | "analytic";

const kindTabs: { id: KindTab; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "chat", label: "Чат-агенты" },
  { id: "abstract", label: "Абстрактные агенты" }
];

const categoryOptions = [
  { value: "all", label: "Все типы" },
  { value: "generative", label: "Генеративные" },
  { value: "analytic", label: "Аналитические" }
];

const statusPresentation: Record<
  AgentStatus,
  { label: string; tone: "active" | "blocked" | "inactive" }
> = {
  active: { label: "Активен", tone: "active" },
  ope: { label: "Активен", tone: "active" },
  testing: { label: "Тестирование", tone: "inactive" },
  refinement: { label: "Доработка", tone: "inactive" },
  draft: { label: "Черновик", tone: "inactive" },
  suspended: { label: "Заблокирован", tone: "blocked" },
  archived: { label: "Заблокирован", tone: "blocked" }
};

/** Conversation-first agents for the «Чат-агенты» catalog tab. */
const CHAT_AGENT_SLUGS = new Set([
  "meeting_agent",
  "tasks_agent",
  "agent_builder",
  "incoming_correspondence_agent",
  "task_compliting_agent"
]);

function agentSearchKey(agent: AgentAccess) {
  return `${agent.slug} ${agent.name} ${agent.purpose ?? ""}`.toLowerCase();
}

function getAgentKind(agent: AgentAccess): "chat" | "abstract" {
  if (CHAT_AGENT_SLUGS.has(agent.slug)) return "chat";
  const key = agentSearchKey(agent);
  if (/chat|чат|assistant|ассистент|dialog|диалог/.test(key)) return "chat";
  return "abstract";
}

function getAgentCategory(agent: AgentAccess): "generative" | "analytic" {
  const key = agentSearchKey(agent);
  if (/generat|генерат|llm|gpt|chat|чат|text|текст|summary|сводк/.test(key)) return "generative";
  return "analytic";
}

function getCapabilityLabel(agent: AgentAccess) {
  const key = agentSearchKey(agent);
  if (/file|файл|вложен|attachment|1с|1c/.test(key)) return "Анализирует файлы";
  if (/document|документ|\bkd\b|\btd\b|кд|тд/.test(key)) return "Анализирует документы";
  if (/tender|тендер|закуп|procurement/.test(key)) return "Анализирует закупки";
  if (/comment|коммент|исполн/.test(key)) return "Анализирует комментарии";
  if (/mail|почт|корресп|email|письм|imap/.test(key)) return "Обрабатывает корреспонденцию";
  return "Автоматизирует задачи";
}

function formatUsageCount(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function buildUsageMap(tasks: Task[]) {
  const map = new Map<string, number>();
  for (const task of tasks) {
    if (!task.agent_id) continue;
    map.set(task.agent_id, (map.get(task.agent_id) ?? 0) + 1);
  }
  return map;
}

const PRIORITY_RECOMMENDED_SLUGS = new Set([
  "quality_engineer_agent",
  "nd_control_agent",
  "incoming_correspondence_agent"
]);

function pickRecommended(agents: AgentAccess[]) {
  const score = (agent: AgentAccess) => {
    const status = statusPresentation[agent.status] ?? { tone: "blocked" as const };
    const priorityBoost = PRIORITY_RECOMMENDED_SLUGS.has(agent.slug) ? -10 : 0;
    if (status.tone === "active") return 0 + priorityBoost;
    if (status.tone === "inactive") return 1 + priorityBoost;
    return 2 + priorityBoost;
  };

  return [...agents].sort((left, right) => score(left) - score(right)).slice(0, 6);
}

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const presentation = statusPresentation[status] ?? {
    label: status,
    tone: "inactive" as const
  };
  return (
    <span
      className={`${styles.statusBadge} ${
        presentation.tone === "active"
          ? styles.statusActive
          : presentation.tone === "blocked"
            ? styles.statusBlocked
            : styles.statusInactive
      }`}
    >
      {presentation.label}
    </span>
  );
}

function AgentIconArt({
  agent,
  variant
}: {
  agent: AgentAccess;
  variant: "full" | "compact";
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = Boolean(user?.is_superuser);
  const [useFallbackIcon, setUseFallbackIcon] = useState(false);
  const iconReloadAttempted = useRef(false);
  const iconSrc = useFallbackIcon || !agent.icon_url ? AGENT_ILLUSTRATION : agent.icon_url;
  const artClass = variant === "compact" ? styles.compactArt : styles.agentArt;

  useEffect(() => {
    setUseFallbackIcon(false);
    iconReloadAttempted.current = false;
  }, [agent.icon_url]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => agentsApi.uploadIcon(agent.id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agents", "available"] });
    }
  });

  const stopCardOpen = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  const handleCameraClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    stopCardOpen(event);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    event.target.value = "";
  };

  return (
    <div
      className={`${artClass} ${isAdmin ? styles.agentArtEditable : ""}`}
    >
      <img
        src={iconSrc}
        alt=""
        loading="lazy"
        onError={() => {
          if (agent.icon_url && !iconReloadAttempted.current) {
            iconReloadAttempted.current = true;
            void queryClient.invalidateQueries({ queryKey: ["agents", "available"] });
            return;
          }
          setUseFallbackIcon(true);
        }}
      />
      {isAdmin ? (
        <>
          <span className={styles.agentArtOverlay} aria-hidden="true" />
          <button
            type="button"
            className={styles.agentArtCamera}
            aria-label={agent.icon_url ? "Изменить иконку агента" : "Задать иконку агента"}
            onClick={handleCameraClick}
            disabled={uploadMutation.isPending}
          >
            <Camera size={variant === "compact" ? 18 : 20} strokeWidth={2.1} aria-hidden="true" />
          </button>
          <input
            ref={fileInputRef}
            className={styles.agentArtFileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            onClick={stopCardOpen}
          />
        </>
      ) : null}
    </div>
  );
}

function RecommendedAgentCard({
  agent,
  usageCount,
  isAccessExpanded,
  onToggleAccess,
  onOpen
}: {
  agent: AgentAccess;
  usageCount: number;
  isAccessExpanded: boolean;
  onToggleAccess: () => void;
  onOpen?: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_superuser);
  const capability = getCapabilityLabel(agent);

  const stopPropagation = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <article
      className={`${styles.compactFlipCard} ${isAccessExpanded ? styles.compactFlipCardFlipped : ""}`}
    >
      <div className={`${styles.compactFlipInner} ${isAccessExpanded ? styles.compactFlipInnerFlipped : ""}`}>
        <div
          className={`${styles.compactFlipFace} ${styles.compactFlipFront} ${styles.compactCardFace}`}
          onClick={onOpen}
          onKeyDown={
            onOpen
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen();
                  }
                }
              : undefined
          }
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
        >
          <AgentStatusBadge status={agent.status} />
          <AgentIconArt agent={agent} variant="compact" />
          <h3 className={styles.compactTitle}>{agent.name}</h3>
          <div className={styles.compactMeta}>
            <span className={styles.compactMetaRow}>
              <FolderOpen size={12} strokeWidth={2} aria-hidden="true" />
              <span className={styles.compactMetaText}>{capability}</span>
            </span>
            <span className={styles.compactMetaRow}>
              <Users size={12} strokeWidth={2} aria-hidden="true" />
              <span className={styles.compactMetaText}>{formatUsageCount(usageCount)}</span>
            </span>
          </div>
          {isAdmin ? (
            <button
              type="button"
              className={styles.compactAccessButton}
              onClick={(event) => {
                stopPropagation(event);
                onToggleAccess();
              }}
              title="Редактировать доступ к агенту"
              aria-label="Редактировать доступ к агенту"
            >
              <Edit3 size={14} strokeWidth={2.1} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className={`${styles.compactFlipFace} ${styles.compactFlipBack} ${styles.compactCardFace}`}>
          <AgentAccessEditor agent={agent} compact onClose={onToggleAccess} />
        </div>
      </div>
    </article>
  );
}

function AgentCard({
  agent,
  usageCount,
  compact = false,
  onOpen
}: {
  agent: AgentAccess;
  usageCount: number;
  compact?: boolean;
  onOpen?: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const capability = getCapabilityLabel(agent);
  const description =
    agent.purpose?.trim() ||
    "Корпоративный ИИ-агент платформы для автоматизации типовых задач подразделения.";

  if (compact) {
    return (
      <article
        className={styles.compactCard}
        onClick={onOpen}
        onKeyDown={
          onOpen
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(event as unknown as React.MouseEvent<HTMLElement>);
                }
              }
            : undefined
        }
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
      >
        <AgentStatusBadge status={agent.status} />
        <AgentIconArt agent={agent} variant="compact" />
        <h3 className={styles.compactTitle}>{agent.name}</h3>
        <div className={styles.compactMeta}>
          <span className={styles.compactMetaRow}>
            <FolderOpen size={12} strokeWidth={2} aria-hidden="true" />
            <span className={styles.compactMetaText}>{capability}</span>
          </span>
          <span className={styles.compactMetaRow}>
            <Users size={12} strokeWidth={2} aria-hidden="true" />
            <span className={styles.compactMetaText}>{formatUsageCount(usageCount)}</span>
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={styles.agentCard}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(event as unknown as React.MouseEvent<HTMLElement>);
              }
            }
          : undefined
      }
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      style={onOpen ? { cursor: "pointer" } : undefined}
    >
      <AgentIconArt agent={agent} variant="full" />
      <div className={styles.agentBody}>
        <div className={styles.agentBodyHead}>
          <h2 className={styles.agentTitle}>{agent.name}</h2>
          <AgentStatusBadge status={agent.status} />
        </div>
        <p className={styles.agentDescription}>{description}</p>
        <div className={styles.agentMeta}>
          <span className={styles.agentUsage}>
            <Users size={15} strokeWidth={2} aria-hidden="true" />
            {formatUsageCount(usageCount)}
          </span>
          <span className={styles.agentCapability}>
            <FolderOpen size={15} strokeWidth={2} aria-hidden="true" />
            {capability}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function Agents() {
  const navigate = useNavigate();
  const [kindTab, setKindTab] = useState<KindTab>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [expandedAccessAgentId, setExpandedAccessAgentId] = useState<string | null>(null);

  const agentsQuery = useQuery({
    queryKey: ["agents", "available"],
    queryFn: agentsApi.available,
    staleTime: 0
  });
  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", "agents-catalog"],
    queryFn: () => tasksApi.list({ limit: 500 })
  });

  const usageByAgent = useMemo(
    () => buildUsageMap(tasksQuery.data ?? []),
    [tasksQuery.data]
  );

  const departmentOptions = useMemo(
    () =>
      (departmentsQuery.data ?? []).map((department) => ({
        value: department.id,
        label: department.name
      })),
    [departmentsQuery.data]
  );

  const catalogAgents = useMemo(
    () => mergePinnedCatalogAgents(agentsQuery.data ?? []),
    [agentsQuery.data]
  );

  const filteredAgents = useMemo(() => {
    let items = catalogAgents;

    if (kindTab === "chat") items = items.filter((agent) => getAgentKind(agent) === "chat");
    if (kindTab === "abstract") items = items.filter((agent) => getAgentKind(agent) === "abstract");

    if (categoryFilter === "generative") {
      items = items.filter((agent) => getAgentCategory(agent) === "generative");
    }
    if (categoryFilter === "analytic") {
      items = items.filter((agent) => getAgentCategory(agent) === "analytic");
    }

    if (departmentFilter !== "all") {
      items = items.filter((agent) => agent.department_id === departmentFilter);
    }

    return items;
  }, [catalogAgents, categoryFilter, departmentFilter, kindTab]);

  const recommendedAgents = useMemo(
    () => pickRecommended(catalogAgents),
    [catalogAgents]
  );

  const openAgent = (agent: AgentAccess) => {
    if (!hasDedicatedLaunchPage(agent)) return;
    navigateToAgentLaunch(navigate, agent);
  };

  const isLoading = agentsQuery.isLoading || departmentsQuery.isLoading;
  const isError = agentsQuery.isError && !catalogAgents.length;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1>Каталог корпоративных агентов</h1>
        <p>
          Доступные корпоративные агенты, оптимизирующие бизнес-процессы отделов НПО
          &laquo;Турбулентность-Дон&raquo;
        </p>
      </header>

      <div className={styles.workspace}>
        <section className={styles.mainColumn} aria-label="Каталог агентов">
          <div className={styles.toolbar}>
            <div className={styles.tabs} role="tablist" aria-label="Тип агентов">
              {kindTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={kindTab === tab.id}
                  className={`${styles.tab} ${kindTab === tab.id ? styles.tabActive : ""}`}
                  onClick={() => setKindTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={styles.filters}>
              <FormSelect
                className={styles.filterSelect}
                compact
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value as CategoryFilter)}
                options={categoryOptions.slice(1)}
                placeholder="Все типы"
                ariaLabel="Категория агента"
              />
              <FormSelect
                className={styles.filterSelect}
                compact
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={[{ value: "all", label: "Все подразделения" }, ...departmentOptions]}
                placeholder="Все подразделения"
                ariaLabel="Подразделение"
              />
            </div>
          </div>

          {isLoading ? (
            <div className={styles.loadingState}>Загрузка агентов…</div>
          ) : isError ? (
            <div className={styles.errorState}>Не удалось загрузить агентов</div>
          ) : !filteredAgents.length ? (
            <div className={styles.emptyState}>
              {catalogAgents.length
                ? "По выбранным фильтрам агенты не найдены. Выберите вкладку «Все»."
                : "Нет агентов, доступных текущему пользователю."}
            </div>
          ) : (
            <div className={styles.agentList}>
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  usageCount={usageByAgent.get(agent.id) ?? 0}
                  onOpen={hasDedicatedLaunchPage(agent) ? () => openAgent(agent) : undefined}
                />
              ))}
            </div>
          )}
        </section>

        <aside className={styles.sidebar} aria-labelledby="recommended-agents-title">
          <h2 id="recommended-agents-title" className={styles.sidebarTitle}>
            Рекомендованные агенты
          </h2>
          {!recommendedAgents.length ? (
            <div className={styles.emptyState}>Рекомендации появятся после загрузки агентов.</div>
          ) : (
            <div className={styles.compactGrid}>
              {recommendedAgents.map((agent) => (
                <RecommendedAgentCard
                  key={agent.id}
                  agent={agent}
                  usageCount={usageByAgent.get(agent.id) ?? 0}
                  isAccessExpanded={expandedAccessAgentId === agent.id}
                  onToggleAccess={() =>
                    setExpandedAccessAgentId((current) => (current === agent.id ? null : agent.id))
                  }
                  onOpen={hasDedicatedLaunchPage(agent) ? () => openAgent(agent) : undefined}
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
