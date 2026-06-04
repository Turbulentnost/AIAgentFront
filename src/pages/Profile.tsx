import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Edit3,
  FileText,
  Lock,
  Mail,
  Monitor,
  Phone,
  Play,
  ShieldCheck,
  ShoppingCart,
  Trophy,
  Upload,
  UserRoundCog,
  UsersRound
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { agentsApi, departmentsApi, tasksApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import {
  mockProfileActivities,
  mockProfileAgents,
  mockSecurityItems,
  profileFallbacks,
  roleNameById
} from "@/mock-data/profile";
import type { ProfileActivityItem, ProfileAgentCard, ProfileAgentIcon } from "@/mock-data/profile";
import type { AgentAccess, Task } from "@/types";
import styles from "./Profile.module.css";

const agentIcons: Record<ProfileAgentIcon, typeof FileText> = {
  document: FileText,
  clipboard: ClipboardCheck,
  analysis: UserRoundCog,
  cart: ShoppingCart,
  trophy: Trophy
};

const securityIcons = {
  lock: Lock,
  shield: ShieldCheck,
  monitor: Monitor
} as const;

const activityIcons = {
  play: Play,
  upload: Upload,
  report: FileText
} as const;

function initialsFromName(name: string) {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getDisplayName(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  return user.full_name || [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(" ") || user.email;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}

function formatLastLogin(value: string | null | undefined) {
  if (!value) return "Сегодня в 09:14";
  const date = new Date(value);
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
  return `Сегодня в ${time}`;
}

function accessLabel(agent: AgentAccess) {
  if (!agent.can_run && !agent.can_view_results) return "Нет доступа";
  if (agent.can_run && agent.can_view_results) return "Запуск и просмотр";
  if (agent.can_run) return "Запуск";
  return "Просмотр";
}

function toneForIndex(index: number): ProfileAgentCard["tone"] {
  return (["blue", "green", "violet", "orange", "slate"] as const)[index] ?? "blue";
}

function iconForIndex(index: number): ProfileAgentIcon {
  return (["document", "clipboard", "analysis", "cart", "trophy"] as const)[index] ?? "document";
}

function toProfileAgent(agent: AgentAccess, index: number): ProfileAgentCard {
  return {
    id: agent.id,
    title: agent.name,
    description: agent.purpose || mockProfileAgents[index]?.description || "Доступный ИИ-агент платформы",
    tone: toneForIndex(index),
    icon: iconForIndex(index),
    accessLabel: accessLabel(agent),
    href: "/agents",
    isLocked: !agent.can_run && !agent.can_view_results
  };
}

function toActivityFromTask(task: Task, index: number): ProfileActivityItem {
  const fallback = mockProfileActivities[index] ?? mockProfileActivities[0];
  return {
    id: task.id,
    title: task.title || fallback.title,
    subtitle: task.description || fallback.subtitle,
    time: task.updated_at ? formatLastLogin(task.updated_at) : fallback.time,
    icon: fallback.icon,
    tone: fallback.tone
  };
}

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraBouncing, setIsCameraBouncing] = useState(false);

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list,
    enabled: Boolean(user)
  });

  const agentsQuery = useQuery({
    queryKey: ["agents", "available", "profile"],
    queryFn: agentsApi.available,
    enabled: Boolean(user)
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", "profile", 3],
    queryFn: () => tasksApi.list({ limit: 3 }),
    enabled: Boolean(user)
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(user!.id, file),
    onSuccess: async () => {
      setMessage("Аватар обновлён");
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    }
  });

  if (!user) return <div className="card">Профиль не загружен</div>;

  const displayName = getDisplayName(user);
  const initials = initialsFromName(displayName) || "П";
  const departmentName =
    departmentsQuery.data?.find((department) => department.id === user.department_id)?.name ||
    profileFallbacks.departmentName;
  const roleName =
    (user.is_superuser ? "Суперадминистратор" : undefined) ||
    (user.role_id ? roleNameById[user.role_id] : undefined) ||
    profileFallbacks.roleName;
  const position = user.position || profileFallbacks.position;
  const phone = user.phone || profileFallbacks.phone;
  const createdAt = user.created_at || profileFallbacks.createdAt;
  const lastLoginAt = user.last_login_at || profileFallbacks.lastLoginAt;

  const profileAgents = useMemo(() => {
    const fromApi = agentsQuery.data?.slice(0, 5).map(toProfileAgent) ?? [];
    if (fromApi.length >= 5) return fromApi;
    return [...fromApi, ...mockProfileAgents.slice(fromApi.length)].slice(0, 5);
  }, [agentsQuery.data]);

  const profileActivities = useMemo(() => {
    const fromApi = tasksQuery.data?.slice(0, 3).map(toActivityFromTask) ?? [];
    if (fromApi.length >= 3) return fromApi;
    return [...fromApi, ...mockProfileActivities.slice(fromApi.length)].slice(0, 3);
  }, [tasksQuery.data]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  function handleCameraClick() {
    setIsCameraBouncing(true);
    fileInputRef.current?.click();
    window.setTimeout(() => setIsCameraBouncing(false), 450);
  }

  return (
    <section className={styles.profile} aria-labelledby="profile-title">
      <div className={styles.header}>
        <div>
          <h1 id="profile-title">Профиль пользователя</h1>
          <p>Управление учетной записью, доступами и персональными настройками</p>
        </div>
        <button className={styles.editButton} type="button">
          <Edit3 size={18} strokeWidth={2.2} aria-hidden="true" />
          Редактировать профиль
        </button>
      </div>

      <div className={styles.topGrid}>
        <article className={`${styles.card} ${styles.identityCard}`}>
          <div className={styles.avatarWrap}>
            {user.avatar_url ? (
              <img className={styles.avatar} src={user.avatar_url} alt="" />
            ) : (
              <span className={styles.avatarFallback}>{initials}</span>
            )}
            <span className={styles.avatarOverlay} aria-hidden="true" />
            <button
              className={`${styles.cameraButton} ${isCameraBouncing ? styles.cameraBounce : ""}`}
              type="button"
              aria-label="Загрузить фото профиля"
              onClick={handleCameraClick}
            >
              <Camera className={styles.cameraIcon} size={20} strokeWidth={2.1} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.identityInfo}>
            <h2>{displayName}</h2>
            <p>
              <Building2 size={18} strokeWidth={2} aria-hidden="true" />
              {departmentName}
            </p>
            <p>
              <BriefcaseBusiness size={18} strokeWidth={2} aria-hidden="true" />
              {position}
            </p>
            <p>
              <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
              Роль: {roleName}
            </p>
            <span className={styles.statusBadge}>
              <span aria-hidden="true" />
              {user.is_active ? "Активен" : "Заблокирован"}
            </span>
          </div>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
          />
          <button className={styles.uploadButton} type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} strokeWidth={2.1} aria-hidden="true" />
            {uploadMutation.isPending ? "Загрузка..." : "Загрузить новое фото"}
          </button>
          {message && <div className={styles.successMessage}>{message}</div>}
        </article>

        <article className={`${styles.card} ${styles.infoCard}`}>
          <h2>Основная информация</h2>
          <dl className={styles.infoGrid}>
            <div>
              <dt>
                <Mail size={18} strokeWidth={2} aria-hidden="true" />
                Email
              </dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>
                <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
                Роль
              </dt>
              <dd>{roleName}</dd>
            </div>
            <div>
              <dt>
                <Phone size={18} strokeWidth={2} aria-hidden="true" />
                Телефон
              </dt>
              <dd>{phone}</dd>
            </div>
            <div>
              <dt>
                <span className={styles.statusDot} aria-hidden="true" />
                Статус
              </dt>
              <dd>
                <span className={styles.inlineStatus}>
                  <span aria-hidden="true" />
                  {user.is_active ? "Активен" : "Заблокирован"}
                </span>
              </dd>
            </div>
            <div>
              <dt>
                <BriefcaseBusiness size={18} strokeWidth={2} aria-hidden="true" />
                Должность
              </dt>
              <dd>{position}</dd>
            </div>
            <div>
              <dt>
                <CalendarDays size={18} strokeWidth={2} aria-hidden="true" />
                Дата создания
              </dt>
              <dd>{formatDate(createdAt)}</dd>
            </div>
            <div>
              <dt>
                <UsersRound size={18} strokeWidth={2} aria-hidden="true" />
                Подразделение
              </dt>
              <dd>{departmentName}</dd>
            </div>
            <div>
              <dt>
                <Clock3 size={18} strokeWidth={2} aria-hidden="true" />
                Последний вход
              </dt>
              <dd>{formatLastLogin(lastLoginAt)}</dd>
            </div>
          </dl>
        </article>
      </div>

      <section className={`${styles.card} ${styles.agentsPanel}`} aria-labelledby="profile-agents-title">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="profile-agents-title">Доступные ИИ-агенты</h2>
            <p>Агенты, доступные для запуска и просмотра в соответствии с вашей ролью</p>
          </div>
          <Link className={styles.allLink} to="/agents">
            Все агенты
            <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.agentGrid}>
          {profileAgents.map((agent) => {
            const Icon = agentIcons[agent.icon];

            return (
              <Link
                className={`${styles.agentCard} ${agent.isLocked ? styles.locked : ""}`}
                key={agent.id}
                to={agent.href}
              >
                <span className={`${styles.agentIcon} ${styles[agent.tone]}`}>
                  <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <div>
                  <h3>{agent.title}</h3>
                  <p>{agent.description}</p>
                  <span className={`${styles.accessBadge} ${styles[agent.tone]}`}>{agent.accessLabel}</span>
                </div>
                <ChevronRight className={styles.agentChevron} size={18} strokeWidth={2.3} aria-hidden="true" />
                {agent.isLocked && <Lock className={styles.agentLock} size={18} strokeWidth={2.2} aria-hidden="true" />}
              </Link>
            );
          })}
        </div>
      </section>

      <div className={styles.bottomGrid}>
        <section className={`${styles.card} ${styles.securityPanel}`} aria-labelledby="profile-security-title">
          <h2 id="profile-security-title">Безопасность</h2>
          <div className={styles.securityList}>
            {mockSecurityItems.map((item) => {
              const Icon = securityIcons[item.icon];

              return (
                <article className={styles.securityItem} key={item.id}>
                  <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                  </div>
                  <button type="button">{item.actionLabel}</button>
                </article>
              );
            })}
          </div>
        </section>

        <section className={`${styles.card} ${styles.activityPanel}`} aria-labelledby="profile-activity-title">
          <h2 id="profile-activity-title">Последняя активность</h2>
          <div className={styles.activityList}>
            {profileActivities.map((activity) => {
              const Icon = activityIcons[activity.icon];

              return (
                <article className={styles.activityItem} key={activity.id}>
                  <span className={`${styles.activityIcon} ${styles[activity.tone]}`}>
                    <Icon size={20} strokeWidth={2.1} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{activity.title}</h3>
                    <p>{activity.subtitle}</p>
                  </div>
                  <time>{activity.time}</time>
                </article>
              );
            })}
          </div>
          <Link className={styles.activityLink} to="/tasks">
            Показать всю активность
            <ChevronRight size={20} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </section>
  );
}
