import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Info } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { departmentsApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import formStyles from "@/components/form-controls/form-controls.module.css";
import ThemePicker from "@/components/ThemePicker";
import { profileFallbacks, resolveDepartmentLabels, roleNameById } from "@/mock-data/profile";
import type { User, UserUpdate } from "@/types";
import styles from "./ProfileEdit.module.css";

type ProfileEditForm = {
  email: string;
  username: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  phone: string;
  position: string;
};

function toFormValue(value: string | null | undefined) {
  return value ?? "";
}

function userToForm(user: User): ProfileEditForm {
  return {
    email: user.email,
    username: toFormValue(user.username),
    last_name: toFormValue(user.last_name),
    first_name: toFormValue(user.first_name),
    middle_name: toFormValue(user.middle_name),
    phone: toFormValue(user.phone),
    position: toFormValue(user.position)
  };
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function buildUpdatePayload(form: ProfileEditForm, user: User): UserUpdate {
  const payload: UserUpdate = {};
  const email = form.email.trim();

  if (email !== user.email) payload.email = email;

  const username = normalizeOptional(form.username);
  if (username !== user.username) payload.username = username;

  const lastName = normalizeOptional(form.last_name);
  if (lastName !== user.last_name) payload.last_name = lastName;

  const firstName = normalizeOptional(form.first_name);
  if (firstName !== user.first_name) payload.first_name = firstName;

  const middleName = normalizeOptional(form.middle_name);
  if (middleName !== user.middle_name) payload.middle_name = middleName;

  const phone = normalizeOptional(form.phone);
  if (phone !== user.phone) payload.phone = phone;

  const position = normalizeOptional(form.position);
  if (position !== user.position) payload.position = position;

  const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ") || null;
  const currentFullName = user.full_name || [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(" ") || null;
  if (fullName !== currentFullName) payload.full_name = fullName;

  return payload;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ProfileEdit() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileEditForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list,
    enabled: Boolean(user)
  });

  useEffect(() => {
    if (user) setForm(userToForm(user));
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (payload: UserUpdate) => usersApi.update(user!.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/profile");
    },
    onError: () => {
      setFormError("Не удалось сохранить изменения. Проверьте данные и попробуйте снова.");
    }
  });

  const hasChanges = useMemo(() => {
    if (!user || !form) return false;
    return Object.keys(buildUpdatePayload(form, user)).length > 0;
  }, [form, user]);

  const { divisionName, subdivisionName } = useMemo(
    () => resolveDepartmentLabels(departmentsQuery.data, user?.department_id),
    [departmentsQuery.data, user?.department_id]
  );

  const roleName = user?.role_id ? roleNameById[user.role_id] ?? profileFallbacks.roleName : profileFallbacks.roleName;

  function updateField<K extends keyof ProfileEditForm>(key: K, value: ProfileEditForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setFormError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !form) return;

    if (!form.email.trim()) {
      setFormError("Укажите электронную почту");
      return;
    }

    if (!isValidEmail(form.email)) {
      setFormError("Укажите корректный адрес электронной почты");
      return;
    }

    const payload = buildUpdatePayload(form, user);
    if (!Object.keys(payload).length) {
      setFormError("Нет изменений для сохранения");
      return;
    }

    setFormError(null);
    updateMutation.mutate(payload);
  }

  if (isLoading || (user && !form)) {
    return (
      <section className={styles.page}>
        <div className={styles.loadingCard}>Загружаем данные профиля...</div>
      </section>
    );
  }

  if (!user || !form) {
    return <Navigate to="/login" replace />;
  }

  return (
    <section className={styles.page} aria-labelledby="profile-edit-title">
      <header className={styles.header}>
        <Link className={styles.backLink} to="/profile">
          <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
          Назад к профилю
        </Link>
        <div>
          <h1 id="profile-edit-title">Редактирование профиля</h1>
          <p>Обновите контактные данные и сведения о себе. Подразделение и роль изменяются администратором.</p>
        </div>
      </header>

      <article className={styles.card}>
        <div className={styles.sectionTitle}>
          <h2>Основные сведения</h2>
          <p>Поля соответствуют данным, которые отображаются в карточке профиля.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Электронная почта <span className={styles.required}>*</span>
              </span>
              <input
                className={formStyles.control}
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Имя пользователя</span>
              <input
                className={formStyles.control}
                type="text"
                autoComplete="username"
                placeholder="ivanov"
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Фамилия</span>
              <input
                className={formStyles.control}
                type="text"
                autoComplete="family-name"
                placeholder="Иванов"
                value={form.last_name}
                onChange={(event) => updateField("last_name", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Имя</span>
              <input
                className={formStyles.control}
                type="text"
                autoComplete="given-name"
                placeholder="Иван"
                value={form.first_name}
                onChange={(event) => updateField("first_name", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Отчество</span>
              <input
                className={formStyles.control}
                type="text"
                autoComplete="additional-name"
                placeholder="Иванович"
                value={form.middle_name}
                onChange={(event) => updateField("middle_name", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Телефон</span>
              <input
                className={formStyles.control}
                type="tel"
                autoComplete="tel"
                placeholder="+7 (999) 000-00-00"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </label>

            <label className={`${styles.field} ${styles.wideField}`}>
              <span className={styles.fieldLabel}>Должность</span>
              <input
                className={formStyles.control}
                type="text"
                autoComplete="organization-title"
                placeholder="Руководитель проекта"
                value={form.position}
                onChange={(event) => updateField("position", event.target.value)}
              />
            </label>
          </div>

          <div className={styles.readOnlyBlock}>
            <h3>Управляется администратором</h3>
            <dl className={styles.readOnlyGrid}>
              <div>
                <dt>Отдел</dt>
                <dd>{divisionName}</dd>
              </div>
              <div>
                <dt>Подразделение</dt>
                <dd>{subdivisionName}</dd>
              </div>
              <div>
                <dt>Роль</dt>
                <dd>{roleName}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>{user.is_active ? "Активен" : "Заблокирован"}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.infoCallout}>
            <Info size={16} strokeWidth={2.2} aria-hidden="true" />
            <p>Изменения вступят в силу сразу после сохранения и отобразятся на странице профиля.</p>
          </div>

          {formError ? <p className={styles.formError}>{formError}</p> : null}

          <div className={styles.actions}>
            <Link className={styles.secondaryButton} to="/profile">
              Отмена
            </Link>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={!hasChanges || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </article>

      <article className={styles.card}>
        <div className={styles.sectionTitle}>
          <h2>Внешний вид</h2>
          <p>Выберите тему интерфейса. Базовые «Светлая» и «Тёмная» — стандартные темы платформы. Остальные — авторские стили.</p>
        </div>
        <ThemePicker className={styles.themePicker} />
      </article>
    </section>
  );
}
