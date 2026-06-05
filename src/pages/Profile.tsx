import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Save,
  ShieldCheck,
  ShoppingCart,
  Trophy,
  Upload,
  UserRoundCog,
  UsersRound
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AxiosError } from "axios";
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
import type { AgentAccess, Task, UserUpdate } from "@/types";
import styles from "./Profile.module.css";

const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ProfileFormState {
  email: string;
  username: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  full_name: string;
  phone: string;
  position: string;
}

const emptyForm: ProfileFormState = {
  email: "",
  username: "",
  last_name: "",
  first_name: "",
  middle_name: "",
  full_name: "",
  phone: "",
  position: ""
};

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

function routeForAgent(agent: AgentAccess) {
  if (agent.slug === "task_compliting_agent") return "/agents/task-compliting";
  return "/agents";
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
    href: routeForAgent(agent),
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isCameraBouncing, setIsCameraBouncing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      email: user.email,
      username: user.username ?? "",
      last_name: user.last_name ?? "",
      first_name: user.first_name ?? "",
      middle_name: user.middle_name ?? "",
      full_name: user.full_name ?? "",
      phone: user.phone ?? "",
      position: user.position ?? ""
    });
  }, [user]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

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

  const updateProfileMutation = useMutation({
    mutationFn: (payload: UserUpdate) => usersApi.update(user!.id, payload),
    onSuccess: async (updatedUser) => {
      setMessage("Профиль обновлён");
      setError(null);
      setIsEditing(false);
      queryClient.setQueryData(["auth", "me"], updatedUser);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(getApiErrorMessage(err, "Не удалось обновить профиль"));
    }
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(user!.id, file),
    onSuccess: async (updatedUser) => {
      setMessage("Аватар обновлён");
      setError(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }
      queryClient.setQueryData(["auth", "me"], updatedUser);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(getApiErrorMessage(err, "Не удалось загрузить аватар"));
    }
  });

  const avatarSrc = useMemo(() => avatarPreview || user?.avatar_url || null, [avatarPreview, user?.avatar_url]);

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

  function handleFieldChange(field: keyof ProfileFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    updateProfileMutation.mutate(toUserUpdate(form));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);
    setError(null);

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      setError("Можно загрузить только JPEG, PNG или WEBP");
      event.target.value = "";
      return;
    }

    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setError("Размер аватара не должен превышать 5 МБ");
      event.target.value = "";
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
    uploadMutation.mutate(file);
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
        <button className={styles.editButton} type="button" onClick={() => setIsEditing((current) => !current)}>
          <Edit3 size={18} strokeWidth={2.2} aria-hidden="true" />
          {isEditing ? "Скрыть форму" : "Редактировать профиль"}
        </button>
      </div>

      <div className={styles.topGrid}>
        <article className={`${styles.card} ${styles.identityCard}`}>
          <div className={styles.avatarWrap}>
            {avatarSrc ? (
              <img className={styles.avatar} src={avatarSrc} alt="" />
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
            accept={AVATAR_ALLOWED_TYPES.join(",")}
            onChange={handleFileChange}
            disabled={uploadMutation.isPending}
          />
          <button className={styles.uploadButton} type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} strokeWidth={2.1} aria-hidden="true" />
            {uploadMutation.isPending ? "Загрузка..." : "Загрузить новое фото"}
          </button>
          {message && <div className={styles.successMessage}>{message}</div>}
          {error && <div className={styles.errorMessage}>{error}</div>}
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

      {isEditing && (
        <article className={`${styles.card} ${styles.infoCard}`}>
          <h2>Редактирование данных</h2>
          <form className={styles.editForm} onSubmit={handleSubmit}>
            <label>
              Email
              <input type="email" value={form.email} onChange={(event) => handleFieldChange("email", event.target.value)} required />
            </label>
            <label>
              Логин
              <input value={form.username} onChange={(event) => handleFieldChange("username", event.target.value)} />
            </label>
            <label>
              Фамилия
              <input value={form.last_name} onChange={(event) => handleFieldChange("last_name", event.target.value)} />
            </label>
            <label>
              Имя
              <input value={form.first_name} onChange={(event) => handleFieldChange("first_name", event.target.value)} />
            </label>
            <label>
              Отчество
              <input value={form.middle_name} onChange={(event) => handleFieldChange("middle_name", event.target.value)} />
            </label>
            <label>
              Полное имя
              <input value={form.full_name} onChange={(event) => handleFieldChange("full_name", event.target.value)} />
            </label>
            <label>
              Телефон
              <input value={form.phone} onChange={(event) => handleFieldChange("phone", event.target.value)} />
            </label>
            <label>
              Должность
              <input value={form.position} onChange={(event) => handleFieldChange("position", event.target.value)} />
            </label>
            <button className={styles.editButton} type="submit" disabled={updateProfileMutation.isPending}>
              <Save size={18} strokeWidth={2.1} aria-hidden="true" />
              {updateProfileMutation.isPending ? "Сохраняем..." : "Сохранить профиль"}
            </button>
          </form>
        </article>
      )}

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

function toUserUpdate(form: ProfileFormState): UserUpdate {
  return {
    email: form.email.trim(),
    username: nullable(form.username),
    last_name: nullable(form.last_name),
    first_name: nullable(form.first_name),
    middle_name: nullable(form.middle_name),
    full_name: nullable(form.full_name),
    phone: nullable(form.phone),
    position: nullable(form.position)
  };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item?.msg || String(item)).join("; ");
  }
  return fallback;
}
