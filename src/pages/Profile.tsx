import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { usersApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import type { User, UserUpdate } from "@/types";

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

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

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

  const avatarSrc = useMemo(() => avatarPreview || user?.avatar_url || null, [avatarPreview, user?.avatar_url]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: UserUpdate) => usersApi.update(user!.id, payload),
    onSuccess: async (updatedUser) => {
      setMessage("Профиль обновлён");
      setError(null);
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

  if (!user) return <div className="card">Профиль не загружен</div>;

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

  return (
    <div className="grid two-columns">
      <div className="card profile-card">
        <h2>Профиль</h2>
        {avatarSrc ? <img className="avatar large" src={avatarSrc} alt="Аватар" /> : <div className="avatar large placeholder">{initials(user)}</div>}
        <h3>{user.full_name || user.email}</h3>
        <p>{user.position || "Должность не указана"}</p>
        <div className="profile-meta">
          <span className={user.is_active ? "status active" : "status blocked"}>{user.is_active ? "Активен" : "Заблокирован"}</span>
          <span className="pill">{user.is_verified ? "Подтверждён" : "Не подтверждён"}</span>
        </div>
        <label className="upload-control">
          <span>Загрузить новое фото</span>
          <small>JPEG, PNG или WEBP, до 5 МБ. Файл сохранится в MinIO, в PostgreSQL останется только путь.</small>
          <input type="file" accept={AVATAR_ALLOWED_TYPES.join(",")} onChange={handleFileChange} disabled={uploadMutation.isPending} />
        </label>
        {uploadMutation.isPending && <small>Загружаем аватар...</small>}
        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card form-card">
        <h2>Данные пользователя</h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => handleFieldChange("email", event.target.value)} required />
          </label>
          <label>
            Логин
            <input value={form.username} onChange={(event) => handleFieldChange("username", event.target.value)} placeholder="Короткий логин" />
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
            Полное имя для отображения
            <input value={form.full_name} onChange={(event) => handleFieldChange("full_name", event.target.value)} />
          </label>
          <label>
            Телефон
            <input value={form.phone} onChange={(event) => handleFieldChange("phone", event.target.value)} placeholder="+7..." />
          </label>
          <label>
            Должность
            <input value={form.position} onChange={(event) => handleFieldChange("position", event.target.value)} />
          </label>

          <div className="form-actions">
            <button type="submit" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? "Сохраняем..." : "Сохранить профиль"}
            </button>
          </div>
        </form>

        <h3>Служебная информация</h3>
        <dl className="details">
          <dt>ID пользователя</dt><dd>{user.id}</dd>
          <dt>Подразделение</dt><dd>{user.department_id || "-"}</dd>
          <dt>Роль</dt><dd>{user.role_id || "-"}</dd>
          <dt>Bucket аватара</dt><dd>{user.avatar_bucket || "-"}</dd>
          <dt>Object name</dt><dd>{user.avatar_object_name || "-"}</dd>
          <dt>Последний вход</dt><dd>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "-"}</dd>
          <dt>Создан</dt><dd>{new Date(user.created_at).toLocaleString()}</dd>
          <dt>Обновлён</dt><dd>{new Date(user.updated_at).toLocaleString()}</dd>
        </dl>
      </div>
    </div>
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

function initials(user: User): string {
  const source = user.full_name || user.email;
  const letters = source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return letters || "?";
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item?.msg || String(item)).join("; ");
  }
  return fallback;
}
