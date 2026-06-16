import {
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudUpload,
  FileText,
  Files,
  ShoppingCart,
  TriangleAlert,
  UserRound
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { agentsApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import {
  AGENT_LAUNCH_MORPH_MS,
  isNdControlAgent,
  navigateToAgentLaunch
} from "@/utils/agentLaunch";
import {
  dashboardActivities,
  dashboardStats,
  dashboardSummary,
  recentTasks,
  recommendedActions
} from "@/mock-data/dashboard";
import type {
  DashboardActivity,
  DashboardStatCard,
  QuickLaunchAgent,
  RecentTask,
  RecommendedAction
} from "@/mock-data/dashboard";
import type { AgentAccess, AgentStatus } from "@/types";
import styles from "./Dashboard.module.css";

const statIcons: Record<DashboardStatCard["icon"], typeof Bot> = {
  bot: Bot,
  clipboard: ClipboardCheck,
  warning: TriangleAlert,
  check: CheckCircle2
};

const launchIcons: Record<QuickLaunchAgent["icon"], typeof ClipboardCheck> = {
  clipboard: ClipboardCheck,
  documents: Files,
  chart: BarChart3
};

const taskIcons: Record<RecentTask["icon"], typeof ClipboardCheck> = {
  clipboard: ClipboardCheck,
  document: FileText,
  cart: ShoppingCart
};

const activityIcons: Record<DashboardActivity["icon"], typeof CheckCircle2> = {
  check: CheckCircle2,
  user: UserRound,
  document: FileText,
  book: BookOpen
};

const recommendedIcons: Record<RecommendedAction["icon"], typeof ClipboardCheck> = {
  clipboard: ClipboardCheck,
  upload: CloudUpload,
  book: BookOpen
};

function getGreetingName(user: ReturnType<typeof useAuth>["user"]) {
  if (!user) return "пользователь";
  const firstName = user.first_name?.trim();
  const middleName = user.middle_name?.trim();
  if (firstName && middleName) return `${firstName} ${middleName}`;
  if (firstName) return firstName;
  if (user.full_name) {
    const [, first, middle] = user.full_name.trim().split(/\s+/);
    return [first, middle].filter(Boolean).join(" ") || user.full_name;
  }
  return user.username || user.email;
}

const RECOMMENDED_SWEEP_MS = 580;

const agentStatusLabels: Record<AgentStatus, string> = {
  active: "Активен",
  draft: "Черновик",
  testing: "Тестирование",
  ope: "ОПЭ",
  refinement: "Доработка",
  suspended: "Приостановлен",
  archived: "Архив"
};

function getAgentLaunchIcon(agent: AgentAccess): QuickLaunchAgent["icon"] {
  const key = `${agent.slug} ${agent.name} ${agent.purpose ?? ""}`.toLowerCase();
  if (key.includes("tender") || key.includes("тендер") || key.includes("закуп")) return "chart";
  if (
    key.includes("kd") ||
    key.includes("td") ||
    key.includes("кд") ||
    key.includes("нд") ||
    key.includes("document") ||
    key.includes("документ")
  ) {
    return "documents";
  }
  return "clipboard";
}

function pickLaunchAgents(agents: AgentAccess[]) {
  const runnable = agents.filter((agent) => agent.can_run);
  const source = runnable.length ? runnable : agents;
  return source.slice(0, 3);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const greetingName = getGreetingName(user);
  const [sweepingActionId, setSweepingActionId] = useState<string | null>(null);
  const [launchMorphAgentId, setLaunchMorphAgentId] = useState<string | null>(null);

  const agentsQuery = useQuery({
    queryKey: ["agents", "available"],
    queryFn: agentsApi.available
  });

  const launchAgents = useMemo(
    () => pickLaunchAgents(agentsQuery.data ?? []),
    [agentsQuery.data]
  );

  const stats = useMemo(
    () =>
      dashboardStats.map((stat) =>
        stat.id === "agents" ? { ...stat, value: agentsQuery.data?.length ?? 0 } : stat
      ),
    [agentsQuery.data]
  );

  function handleRecommendedClick(action: RecommendedAction, event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (sweepingActionId) return;

    setSweepingActionId(action.id);
    window.setTimeout(() => {
      navigate(action.href);
      setSweepingActionId(null);
    }, RECOMMENDED_SWEEP_MS);
  }

  function handleAgentLaunch(agent: AgentAccess, event: MouseEvent<HTMLButtonElement>) {
    if (!agent.can_run || launchMorphAgentId) return;

    if (isNdControlAgent(agent)) {
      if (agent.icon_url) {
        navigateToAgentLaunch(navigate, agent);
        return;
      }

      setLaunchMorphAgentId(agent.id);
      window.setTimeout(() => {
        navigateToAgentLaunch(navigate, agent);
        setLaunchMorphAgentId(null);
      }, AGENT_LAUNCH_MORPH_MS);
      return;
    }

    navigate("/tasks", { state: { agentId: agent.id, agentName: agent.name } });
  }

  return (
    <section
      className={`${styles.dashboard} ${launchMorphAgentId ? styles.dashboardMorphing : ""}`}
      aria-labelledby="dashboard-title"
    >
      <div className={styles.hero}>
        <h1 id="dashboard-title">Добро пожаловать, {greetingName}</h1>
        <p>
          Сегодня: {dashboardSummary.activeTasks} активные задачи, {dashboardSummary.reviewRequired} требуют
          проверки, {dashboardSummary.completed} завершена
        </p>
      </div>

      <div className={styles.statsGrid} aria-label="Сводка по задачам и агентам">
        {stats.map((stat) => {
          const Icon = statIcons[stat.icon];

          return (
            <article className={styles.statCard} key={stat.id}>
              <span
                className={`${styles.statIcon} ${styles[stat.tone]} ${stat.imageSrc ? styles.statIconImage : ""}`}
              >
                {stat.imageSrc ? (
                  <img src={stat.imageSrc} alt="" />
                ) : (
                  <Icon size={25} strokeWidth={2.1} aria-hidden="true" />
                )}
              </span>
              <div>
                <span className={styles.statTitle}>{stat.title}</span>
                <strong className={`${styles.statValue} ${styles[stat.tone]}`}>{stat.value}</strong>
              </div>
            </article>
          );
        })}
      </div>

      <section className={styles.quickLaunch} aria-labelledby="quick-launch-title">
        <h2 id="quick-launch-title">Быстрый запуск</h2>
        {agentsQuery.isPending ? (
          <div className={styles.launchState}>Загружаем доступных агентов...</div>
        ) : agentsQuery.isError ? (
          <div className={styles.launchState}>Не удалось загрузить список агентов.</div>
        ) : !launchAgents.length ? (
          <div className={styles.launchState}>У вас пока нет доступных агентов.</div>
        ) : (
          <div className={styles.launchGrid}>
            {launchAgents.map((agent) => {
              const icon = getAgentLaunchIcon(agent);
              const Icon = launchIcons[icon];
              const isMorphing = launchMorphAgentId === agent.id;
              const isHiddenByMorph = Boolean(launchMorphAgentId && !isMorphing);

              if (isHiddenByMorph) return null;

              return (
                <article
                  className={`${styles.launchCard} ${isMorphing ? styles.launchCardMorphing : ""}`}
                  key={agent.id}
                >
                  <div
                    className={`${styles.launchArt} ${agent.icon_url ? styles.launchArtHasIcon : styles[icon]}`}
                  >
                    {agent.icon_url ? (
                      <img src={agent.icon_url} alt="" loading="lazy" />
                    ) : (
                      <Icon size={52} strokeWidth={1.7} aria-hidden="true" />
                    )}
                  </div>
                  <div className={styles.launchBody}>
                    <div className={styles.launchHead}>
                      <h3>{agent.name}</h3>
                      <span className={styles.status}>
                        <span aria-hidden="true" />
                        {agentStatusLabels[agent.status]}
                      </span>
                    </div>
                    <p>{agent.purpose || agent.slug}</p>
                    <button
                      type="button"
                      disabled={!agent.can_run || Boolean(launchMorphAgentId)}
                      onClick={(event) => handleAgentLaunch(agent, event)}
                    >
                      {isMorphing ? "Открываем…" : agent.can_run ? "Запустить" : "Нет доступа"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className={styles.bottomGrid}>
        <section className={styles.tasksPanel} aria-labelledby="recent-tasks-title">
          <h2 id="recent-tasks-title">Последние задачи</h2>
          <div className={styles.tasksTable} role="table" aria-label="Последние задачи">
            <div className={styles.tasksHead} role="row">
              <span role="columnheader">Название</span>
              <span role="columnheader">Агент</span>
              <span role="columnheader">Статус</span>
              <span role="columnheader">Время</span>
              <span aria-hidden="true" />
            </div>
            {recentTasks.map((task) => {
              const Icon = taskIcons[task.icon];

              return (
                <div className={styles.taskRow} role="row" key={task.id}>
                  <div className={styles.taskName} role="cell">
                    <span className={`${styles.taskIcon} ${styles[task.status]}`}>
                      <Icon size={19} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <strong>{task.title}</strong>
                  </div>
                  <span className={styles.taskAgent} role="cell">
                    {task.agent}
                  </span>
                  <span role="cell">
                    <span className={`${styles.taskStatus} ${styles[task.status]}`}>{task.statusLabel}</span>
                  </span>
                  <span className={styles.taskTime} role="cell">
                    {task.time}
                  </span>
                  <button className={styles.rowAction} type="button" aria-label={`Открыть ${task.title}`}>
                    <ChevronRight size={19} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
          <a className={styles.panelLink} href="/tasks">
            Все задачи
            <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
          </a>
        </section>

        <section className={styles.activityPanel} aria-labelledby="activity-title">
          <h2 id="activity-title">Активность и уведомления</h2>
          <div className={styles.timeline}>
            {dashboardActivities.map((activity) => {
              const Icon = activityIcons[activity.icon];

              return (
                <article className={styles.activityItem} key={activity.id}>
                  <span className={`${styles.activityIcon} ${styles[activity.tone]}`}>
                    <Icon size={21} strokeWidth={2.1} aria-hidden="true" />
                  </span>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <div>
                    <h3>{activity.title}</h3>
                    <p>{activity.time}</p>
                  </div>
                </article>
              );
            })}
          </div>
          <a className={styles.panelLink} href="/tasks">
            Все уведомления
            <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
          </a>
        </section>
      </div>

      <section className={styles.recommendedPanel} aria-labelledby="recommended-actions-title">
        <h2 id="recommended-actions-title">Рекомендуемые действия</h2>
        <div className={styles.recommendedList}>
          {recommendedActions.map((action) => {
            const Icon = recommendedIcons[action.icon];

            return (
              <Link
                className={`${styles.recommendedAction} ${
                  sweepingActionId === action.id ? styles.recommendedActionSweeping : ""
                }`}
                key={action.id}
                to={action.href}
                onClick={(event) => handleRecommendedClick(action, event)}
              >
                <span className={styles.recommendedIconSlot} aria-hidden="true">
                  <span
                    className={`${styles.recommendedIcon} ${styles[action.tone]} ${
                      sweepingActionId === action.id ? styles.recommendedIconTraveling : ""
                    }`}
                  >
                    <Icon size={20} strokeWidth={2.1} aria-hidden="true" />
                  </span>
                </span>
                <span className={styles.recommendedLabel}>{action.label}</span>
                <ChevronRight className={styles.recommendedChevron} size={18} strokeWidth={2.3} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>
    </section>
  );
}
