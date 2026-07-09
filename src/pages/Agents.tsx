import { useMemo, useState } from "react";
import { FolderOpen, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, departmentsApi, tasksApi } from "@/api/endpoints";
import { FormSelect } from "@/components/form-controls";
import type { AgentAccess, AgentStatus, Task } from "@/types";
import styles from "./Agents.module.css";

const AGENT_ILLUSTRATION = "/agent-catalog-illustration.png";
const ND_CONTROL_AGENT_ROUTE = "/agents/nd-control";
const INCOMING_MAIL_ROUTE = "/agents/incoming-mail";
const INCOMING_MAIL_DISPLAY_NAME = "Агент по входящей корреспонденции";

const INCOMING_MAIL_CATALOG_AGENT: AgentAccess = {
  id: "catalog-agent_pochta",
  name: INCOMING_MAIL_DISPLAY_NAME,
  slug: "agent_pochta",
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
  testing: { label: "Деактивирован", tone: "inactive" },
  refinement: { label: "Деактивирован", tone: "inactive" },
  draft: { label: "Деактивирован", tone: "inactive" },
  suspended: { label: "Заблокирован", tone: "blocked" },
  archived: { label: "Заблокирован", tone: "blocked" }
};

function agentSearchKey(agent: AgentAccess) {
  return `${agent.slug} ${agent.name} ${agent.purpose ?? ""}`.toLowerCase();
}

function getAgentKind(agent: AgentAccess): "chat" | "abstract" {
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

function pickRecommended(agents: AgentAccess[]) {
  const score = (agent: AgentAccess) => {
    const status = statusPresentation[agent.status];
    if (status.tone === "active") return 0;
    if (status.tone === "inactive") return 1;
    return 2;
  };

  return [...agents].sort((left, right) => score(left) - score(right)).slice(0, 6);
}

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const presentation = statusPresentation[status];
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

function AgentCard({
  agent,
  usageCount,
  compact = false
}: {
  agent: AgentAccess;
  usageCount: number;
  compact?: boolean;
}) {
  const capability = getCapabilityLabel(agent);
  const description =
    agent.purpose?.trim() ||
    "Корпоративный ИИ-агент платформы для автоматизации типовых задач подразделения.";

  if (compact) {
    const card = (
      <article className={styles.compactCard}>
        <AgentStatusBadge status={agent.status} />
        <div className={styles.compactArt}>
          <img src={AGENT_ILLUSTRATION} alt="" loading="lazy" />
        </div>
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

    const route = getAgentRoute(agent);
    if (route) {
      return (
        <Link to={route} className={styles.agentCardLink}>
          {card}
        </Link>
      );
    }

    return card;
  }

  const card = (
    <article className={styles.agentCard}>
      <div className={styles.agentArt}>
        <img src={AGENT_ILLUSTRATION} alt="" loading="lazy" />
      </div>
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

  const route = getAgentRoute(agent);
  if (route) {
    return (
      <Link to={route} className={styles.agentCardLink}>
        {card}
      </Link>
    );
  }

  return card;
}

export default function Agents() {
  const [kindTab, setKindTab] = useState<KindTab>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const agentsQuery = useQuery({
    queryKey: ["agents", "available"],
    queryFn: agentsApi.available
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
                ? "По выбранным фильтрам агенты не найдены."
                : "Нет агентов, доступных текущему пользователю."}
            </div>
          ) : (
            <div className={styles.agentList}>
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  usageCount={usageByAgent.get(agent.id) ?? 0}
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
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  usageCount={usageByAgent.get(agent.id) ?? 0}
                  compact
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
