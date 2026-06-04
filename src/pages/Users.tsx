import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { departmentsApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import type { UserCreate } from "@/types";

const emptyForm: UserCreate = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  middle_name: "",
  position: "",
  phone: "",
  department_id: null
};

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserCreate>(emptyForm);
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: usersApi.list, enabled: Boolean(user?.is_superuser) });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: departmentsApi.list });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  if (!user?.is_superuser) {
    return <div className="card">Раздел доступен только суперпользователю.</div>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      department_id: form.department_id || null
    });
  }

  return (
    <div className="grid two-columns">
      <form className="card form-card" onSubmit={handleSubmit}>
        <h2>Создать пользователя</h2>
        <input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input placeholder="Пароль" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} required />
        <input placeholder="Фамилия" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
        <input placeholder="Имя" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
        <input placeholder="Отчество" value={form.middle_name} onChange={(event) => setForm({ ...form, middle_name: event.target.value })} />
        <input placeholder="Должность" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
        <input placeholder="Телефон" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <select value={form.department_id || ""} onChange={(event) => setForm({ ...form, department_id: event.target.value || null })}>
          <option value="">Без подразделения</option>
          {departmentsQuery.data?.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <button disabled={createMutation.isPending}>{createMutation.isPending ? "Создаём..." : "Создать"}</button>
      </form>
      <div className="card">
        <h2>Пользователи</h2>
        {usersQuery.isError && <p className="error">Не удалось загрузить пользователей.</p>}
        {!usersQuery.data?.length ? <p>Пользователей пока нет.</p> : (
          <table>
            <tbody>
              {usersQuery.data.map((item) => (
                <tr key={item.id}>
                  <td>{item.full_name || item.email}<br /><small>{item.position || item.email}</small></td>
                  <td>{item.is_active ? "Активен" : "Заблокирован"}</td>
                  <td><button className="secondary-button" onClick={() => deactivateMutation.mutate(item.id)} disabled={!item.is_active}>Заблокировать</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
