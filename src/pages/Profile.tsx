import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  Edit3,
  Eye,
  EyeOff,
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
  UsersRound,
  X
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { agentsApi, departmentsApi, tasksApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import formStyles from "@/components/form-controls/form-controls.module.css";
import {
  mockProfileActivities,
  mockSecurityItems,
  profileFallbacks,
  resolveDepartmentLabels,
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

function iconForAgent(agent: AgentAccess): ProfileAgentIcon {
  const key = `${agent.slug} ${agent.name} ${agent.purpose ?? ""}`.toLowerCase();
  if (key.includes("tender") || key.includes("тендер")) return "trophy";
  if (key.includes("закуп") || key.includes("purchase") || key.includes("procurement")) return "cart";
  if (
    key.includes("kd") ||
    key.includes("td") ||
    key.includes("кд") ||
    key.includes("document") ||
    key.includes("документ")
  ) {
    return "document";
  }
  if (key.includes("ol") || key.includes("опрос") || key.includes("анализ") || key.includes("analysis")) {
    return "analysis";
  }
  return "clipboard";
}

function pickProfileAgents(agents: AgentAccess[]) {
  const accessible = agents.filter((agent) => agent.can_run || agent.can_view_results);
  const source = accessible.length ? accessible : agents;
  return source.slice(0, 5);
}

function toProfileAgent(agent: AgentAccess, index: number): ProfileAgentCard {
  return {
    id: agent.id,
    title: agent.name,
    description: agent.purpose?.trim() || "Доступный ИИ-агент платформы",
    tone: toneForIndex(index),
    icon: iconForAgent(agent),
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

type PasswordFieldKey = "newPassword" | "confirmPassword";

type PasswordVisibility = Record<PasswordFieldKey, boolean>;

type PasswordChangeForm = {
  email: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyPasswordVisibility: PasswordVisibility = {
  newPassword: false,
  confirmPassword: false
};

const PASSWORD_MODAL_CLOSE_MS = 260;

const emptyPasswordForm: PasswordChangeForm = {
  email: "",
  newPassword: "",
  confirmPassword: ""
};

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordModalClosing, setIsPasswordModalClosing] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>(emptyPasswordForm);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
  const [passwordVisibility, setPasswordVisibility] = useState<PasswordVisibility>(emptyPasswordVisibility);
  const passwordModalCloseTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraButtonRef = useRef<HTMLButtonElement>(null);
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

  const finishPasswordModalClose = useCallback(() => {
    setIsPasswordModalOpen(false);
    setIsPasswordModalClosing(false);
    setPasswordForm(emptyPasswordForm);
    setPasswordFormError(null);
    setPasswordVisibility(emptyPasswordVisibility);
  }, []);

  const requestClosePasswordModal = useCallback(() => {
    if (isPasswordModalClosing) return;

    setIsPasswordModalClosing(true);
    if (passwordModalCloseTimerRef.current) {
      window.clearTimeout(passwordModalCloseTimerRef.current);
    }
    passwordModalCloseTimerRef.current = window.setTimeout(() => {
      finishPasswordModalClose();
      passwordModalCloseTimerRef.current = null;
    }, PASSWORD_MODAL_CLOSE_MS);
  }, [finishPasswordModalClose, isPasswordModalClosing]);

  const openPasswordModal = useCallback(() => {
    if (!user) return;

    if (passwordModalCloseTimerRef.current) {
      window.clearTimeout(passwordModalCloseTimerRef.current);
      passwordModalCloseTimerRef.current = null;
    }

    setPasswordForm({
      email: user.email,
      newPassword: "",
      confirmPassword: ""
    });
    setPasswordFormError(null);
    setPasswordVisibility(emptyPasswordVisibility);
    setIsPasswordModalClosing(false);
    setIsPasswordModalOpen(true);
  }, [user]);

  useEffect(() => {
    if (!isPasswordModalOpen || isPasswordModalClosing) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") requestClosePasswordModal();
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isPasswordModalClosing, isPasswordModalOpen, requestClosePasswordModal]);

  useEffect(
    () => () => {
      if (passwordModalCloseTimerRef.current) {
        window.clearTimeout(passwordModalCloseTimerRef.current);
      }
    },
    []
  );

  const isPasswordModalVisible = isPasswordModalOpen || isPasswordModalClosing;

  if (!user) return <div className="card">Профиль не загружен</div>;

  const displayName = getDisplayName(user);
  const initials = initialsFromName(displayName) || "П";
  const { divisionName, subdivisionName } = resolveDepartmentLabels(departmentsQuery.data, user.department_id);
  const roleName =
    (user.is_superuser ? "Суперадминистратор" : undefined) ||
    (user.role_id ? roleNameById[user.role_id] : undefined) ||
    profileFallbacks.roleName;
  const position = user.position || profileFallbacks.position;
  const phone = user.phone || profileFallbacks.phone;
  const createdAt = user.created_at || profileFallbacks.createdAt;
  const lastLoginAt = user.last_login_at || profileFallbacks.lastLoginAt;

  const profileAgents = useMemo(
    () => pickProfileAgents(agentsQuery.data ?? []).map(toProfileAgent),
    [agentsQuery.data]
  );

  const profileActivities = useMemo(() => {
    const fromApi = tasksQuery.data?.slice(0, 3).map(toActivityFromTask) ?? [];
    if (fromApi.length >= 3) return fromApi;
    return [...fromApi, ...mockProfileActivities.slice(fromApi.length)].slice(0, 3);
  }, [tasksQuery.data]);

  function releaseAvatarPickerFocus() {
    cameraButtonRef.current?.blur();
    fileInputRef.current?.blur();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    releaseAvatarPickerFocus();
    if (file) uploadMutation.mutate(file);
  }

  function handleCameraClick() {
    setIsCameraBouncing(true);
    fileInputRef.current?.click();
    window.setTimeout(() => setIsCameraBouncing(false), 450);

    let pickerOpened = false;

    function handleWindowBlur() {
      pickerOpened = true;
      window.removeEventListener("blur", handleWindowBlur);
    }

    function handleWindowFocus() {
      window.removeEventListener("focus", handleWindowFocus);
      if (pickerOpened) releaseAvatarPickerFocus();
    }

    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordForm.email.trim()) {
      setPasswordFormError("Укажите электронную почту");
      return;
    }

    if (!passwordForm.newPassword) {
      setPasswordFormError("Укажите новый пароль");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFormError("Пароли не совпадают");
      return;
    }

    setPasswordFormError(null);
    setMessage("Новый пароль сохранён локально — подключение к API будет добавлено позже");
    requestClosePasswordModal();
  }

  return (
    <section className={styles.profile} aria-labelledby="profile-title">
      <div className={styles.header}>
        <div>
          <h1 id="profile-title">Профиль пользователя</h1>
          <p>Управление учетной записью, доступами и персональными настройками</p>
        </div>
        <Link className={styles.editButton} to="/profile/edit">
          <Edit3 size={18} strokeWidth={2.2} aria-hidden="true" />
          Редактировать профиль
        </Link>
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
              ref={cameraButtonRef}
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
              {subdivisionName}
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
                <Circle size={18} strokeWidth={2} aria-hidden="true" />
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
                <Building2 size={18} strokeWidth={2} aria-hidden="true" />
                Отдел
              </dt>
              <dd>{divisionName}</dd>
            </div>
            <div>
              <dt>
                <UsersRound size={18} strokeWidth={2} aria-hidden="true" />
                Подразделение
              </dt>
              <dd>{subdivisionName}</dd>
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
          {agentsQuery.isPending ? (
            <p className={styles.agentsEmpty}>Загружаем агентов…</p>
          ) : agentsQuery.isError ? (
            <p className={styles.agentsEmpty}>Не удалось загрузить агентов</p>
          ) : !profileAgents.length ? (
            <p className={styles.agentsEmpty}>Нет доступных агентов для вашей роли.</p>
          ) : (
            profileAgents.map((agent) => {
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
            })
          )}
        </div>
      </section>

      <div className={styles.bottomGrid}>
        <section className={`${styles.card} ${styles.securityPanel}`} aria-labelledby="profile-security-title">
          <h2 id="profile-security-title">Безопасность</h2>
          <div className={styles.securityList}>
            {mockSecurityItems.map((item) => {
              const Icon = securityIcons[item.icon];
              const isMfa = item.id === "mfa";
              const isPassword = item.id === "password";
              const subtitle = isMfa
                ? isTwoFactorEnabled
                  ? "Подключена"
                  : "Не подключена"
                : item.subtitle;
              const actionLabel = isMfa ? (isTwoFactorEnabled ? "Отключить" : "Подключить") : item.actionLabel;

              return (
                <article className={styles.securityItem} key={item.id}>
                  <Icon
                    className={isMfa && isTwoFactorEnabled ? styles.securityIconEnabled : undefined}
                    size={24}
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                  <div>
                    <h3>{item.title}</h3>
                    <p className={isMfa && isTwoFactorEnabled ? styles.securityStatusEnabled : undefined}>
                      {subtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={isMfa && isTwoFactorEnabled ? styles.securityActionDisable : undefined}
                    aria-pressed={isMfa ? isTwoFactorEnabled : undefined}
                    onClick={
                      isPassword
                        ? openPasswordModal
                        : isMfa
                          ? () => setIsTwoFactorEnabled((current) => !current)
                          : undefined
                    }
                  >
                    {actionLabel}
                  </button>
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

      {isPasswordModalVisible ? (
        <div
          className={`${styles.modalBackdrop} ${
            isPasswordModalClosing ? styles.modalBackdropClosing : styles.modalBackdropOpening
          }`}
          role="presentation"
          onClick={requestClosePasswordModal}
        >
          <div
            className={`${styles.card} ${styles.passwordModal} ${
              isPasswordModalClosing ? styles.passwordModalClosing : styles.passwordModalOpening
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHeader}>
              <div>
                <h2 id="password-modal-title">Смена пароля</h2>
                <p>Укажите почту и новый пароль. Данные пока сохраняются только локально.</p>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                aria-label="Закрыть"
                onClick={requestClosePasswordModal}
              >
                <X size={18} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </header>

            <form className={styles.modalForm} onSubmit={handlePasswordSubmit}>
              <label className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Электронная почта</span>
                <input
                  className={formStyles.control}
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={passwordForm.email}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>

              <label className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Новый пароль</span>
                <div className={styles.passwordField}>
                  <input
                    className={`${formStyles.control} ${styles.passwordInput}`}
                    type={passwordVisibility.newPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Введите новый пароль"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    aria-label={passwordVisibility.newPassword ? "Скрыть пароль" : "Показать пароль"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      setPasswordVisibility((current) => ({
                        ...current,
                        newPassword: !current.newPassword
                      }))
                    }
                  >
                    {passwordVisibility.newPassword ? (
                      <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Eye size={16} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>

              <label className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Подтверждение пароля</span>
                <div className={styles.passwordField}>
                  <input
                    className={`${formStyles.control} ${styles.passwordInput}`}
                    type={passwordVisibility.confirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Повторите новый пароль"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    aria-label={passwordVisibility.confirmPassword ? "Скрыть пароль" : "Показать пароль"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      setPasswordVisibility((current) => ({
                        ...current,
                        confirmPassword: !current.confirmPassword
                      }))
                    }
                  >
                    {passwordVisibility.confirmPassword ? (
                      <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Eye size={16} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>

              {passwordFormError ? <p className={styles.modalError}>{passwordFormError}</p> : null}

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancelButton} onClick={requestClosePasswordModal}>
                  Отмена
                </button>
                <button type="submit" className={styles.modalSubmitButton}>
                  Сохранить пароль
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
