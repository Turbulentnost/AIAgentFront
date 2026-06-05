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
import { useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, taskCompletingAgentApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
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
  RecentTask,
  RecommendedAction
} from "@/mock-data/dashboard";
import type { AgentAccess } from "@/types";
import styles from "./Dashboard.module.css";

const statIcons: Record<DashboardStatCard["icon"], typeof Bot> = {
  bot: Bot,
  clipboard: ClipboardCheck,
  warning: TriangleAlert,
  check: CheckCircle2
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

const RECOMMENDED_SWEEP_MS = 580;

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

function iconForAgent(agent: AgentAccess) {
  if (agent.slug === "task_compliting_agent") return ClipboardCheck;
  if (agent.slug.includes("document") || agent.slug.includes("nd")) return Files;
  if (agent.slug.includes("report") || agent.slug.includes("analytics")) return BarChart3;
  return Bot;
}

function routeForAgent(agent: AgentAccess) {
  if (agent.slug === "task_compliting_agent") return "/agents/task-compliting";
  return "/agents";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandingAgentId, setExpandingAgentId] = useState<string | null>(null);
  const [sweepingActionId, setSweepingActionId] = useState<string | null>(null);
  const greetingName = getGreetingName(user);

  const { data: availableAgents = [], isPending: isAgentsPending } = useQuery({
    queryKey: ["agents", "available"],
    queryFn: agentsApi.available
  });
  const { data: taskCompletingSummary } = useQuery({
    queryKey: ["task-compliting", "tasks", "summary"],
    queryFn: taskCompletingAgentApi.tasks,
    enabled: availableAgents.some((agent) => agent.slug === "task_compliting_agent")
  });

  const activeReviewTasks = taskCompletingSummary?.active.length ?? dashboardSummary.reviewRequired;
  const completedByAgent = taskCompletingSummary?.archived_count ?? dashboardSummary.completed;
  const stats: DashboardStatCard[] = dashboardStats.map((stat) => {
    if (stat.id === "agents") return { ...stat, value: availableAgents.length };
    if (stat.id === "decisions") return { ...stat, value: activeReviewTasks };
    if (stat.id === "completed") return { ...stat, value: completedByAgent };
    if (stat.id === "tasks") return { ...stat, value: taskCompletingSummary?.total ?? dashboardSummary.activeTasks };
    return stat;
  });

  function handleLaunch(agent: AgentAccess) {
    setExpandingAgentId(agent.id);
    window.setTimeout(() => navigate(routeForAgent(agent)), 520);
  }

  function handleRecommendedClick(action: RecommendedAction, event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (sweepingActionId) return;

    setSweepingActionId(action.id);
    window.setTimeout(() => {
      navigate(action.href);
      setSweepingActionId(null);
    }, RECOMMENDED_SWEEP_MS);
  }

  return (
    <section className={styles.dashboard} aria-labelledby="dashboard-title">
      {expandingAgentId && <div className={styles.launchOverlay} aria-hidden="true" />}
      <div className={styles.hero}>
        <h1 id="dashboard-title">Добро пожаловать, {greetingName}</h1>
        <p>
          Сегодня: {taskCompletingSummary?.total ?? dashboardSummary.activeTasks} задач в доступных агентских сценариях,{" "}
          {activeReviewTasks} требуют проверки, {completedByAgent} в архиве
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
        <h2 id="quick-launch-title">Быстрый запуск ({availableAgents.length})</h2>
        <div className={styles.launchGrid}>
          {isAgentsPending && <article className={styles.launchCard}>Загружаем агентов...</article>}
          {!isAgentsPending && !availableAgents.length && (
            <article className={styles.launchCard}>Нет агентов, доступных текущему пользователю.</article>
          )}
          {availableAgents.map((agent) => {
            const Icon = iconForAgent(agent);

            return (
              <article className={styles.launchCard} key={agent.id}>
                <div className={`${styles.launchArt} ${styles.documents}`}>
                  <Icon size={52} strokeWidth={1.7} aria-hidden="true" />
                </div>
                <div className={styles.launchBody}>
                  <div className={styles.launchHead}>
                    <h3>{agent.name}</h3>
                    <span className={styles.status}>
                      <span aria-hidden="true" />
                      Активен
                    </span>
                  </div>
                  <p>{agent.purpose || agent.slug}</p>
                  <button
                    type="button"
                    onClick={() => handleLaunch(agent)}
                    disabled={!agent.can_run || expandingAgentId === agent.id}
                  >
                    {expandingAgentId === agent.id ? "Открываем..." : "Запустить"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
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
