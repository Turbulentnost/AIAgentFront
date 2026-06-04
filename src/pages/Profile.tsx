import { ChangeEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const uploadMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(user!.id, file),
    onSuccess: async () => {
      setMessage("Аватар обновлён");
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    }
  });

  if (!user) return <div className="card">Профиль не загружен</div>;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  return (
    <div className="grid two-columns">
      <div className="card profile-card">
        <h2>Профиль</h2>
        {user.avatar_url ? <img className="avatar" src={user.avatar_url} alt="Аватар" /> : <div className="avatar placeholder">?</div>}
        <h3>{user.full_name || user.email}</h3>
        <p>{user.position || "Должность не указана"}</p>
        <label>
          Загрузить аватар
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
        </label>
        {message && <div className="success">{message}</div>}
      </div>
      <div className="card">
        <h2>Данные пользователя</h2>
        <dl className="details">
          <dt>Email</dt><dd>{user.email}</dd>
          <dt>Логин</dt><dd>{user.username || "-"}</dd>
          <dt>Телефон</dt><dd>{user.phone || "-"}</dd>
          <dt>Подразделение</dt><dd>{user.department_id || "-"}</dd>
          <dt>Роль</dt><dd>{user.role_id || "-"}</dd>
          <dt>Статус</dt><dd>{user.is_active ? "Активен" : "Заблокирован"}</dd>
          <dt>Последний вход</dt><dd>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "-"}</dd>
        </dl>
      </div>
    </div>
  );
}
