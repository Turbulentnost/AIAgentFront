import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminUsersApi, agentsApi, departmentsApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import type { AdminUserCreate, UserAgentGrantCreate } from "@/types";

const emptyForm: AdminUserCreate = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  middle_name: "",
  position: "",
  phone: "",
  department_id: null,
  role_id: null,
  is_active: true,
  is_verified: true,
  must_change_password: true,
  agent_access: []
};

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdminUserCreate>(emptyForm);
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: adminUsersApi.list, enabled: Boolean(user?.is_superuser) });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: departmentsApi.list });
  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: agentsApi.list, enabled: Boolean(user?.is_superuser) });

  const createMutation = useMutation({
    mutationFn: adminUsersApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: adminUsersApi.deactivate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });

  if (!user?.is_superuser) {
    return <div className="card">Раздел доступен только суперпользователю.</div>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      department_id: form.department_id || null,
      role_id: form.role_id || null,
      agent_access: form.agent_access || []
    });
  }

  function toggleAgentAccess(agentId: string, checked: boolean) {
    const currentAccess = form.agent_access || [];
    if (!checked) {
      setForm({ ...form, agent_access: currentAccess.filter((access) => access.agent_id !== agentId) });
      return;
    }
    const grant: UserAgentGrantCreate = {
      agent_id: agentId,
      access_level: "run",
      can_run: true,
      can_view_results: true,
      can_approve: false,
      can_configure: false
    };
    setForm({ ...form, agent_access: [...currentAccess, grant] });
  }

  function updateAgentGrant(agentId: string, patch: Partial<UserAgentGrantCreate>) {
    setForm({
      ...form,
      agent_access: (form.agent_access || []).map((access) =>
        access.agent_id === agentId ? { ...access, ...patch } : access
      )
    });
  }

  return (
    <div className="grid two-columns">
      <form className="card form-card" onSubmit={handleSubmit}>
        <h2>Создать пользователя</h2>
        <input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input placeholder="Временный пароль" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} required />
        <small>Админ задаёт временный пароль. При первом входе пользователь введёт новый пароль.</small>
        <input placeholder="Фамилия" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
        <input placeholder="Имя" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
        <input placeholder="Отчество" value={form.middle_name} onChange={(event) => setForm({ ...form, middle_name: event.target.value })} />
        <input placeholder="Должность" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
        <input placeholder="Телефон" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <select value={form.department_id || ""} onChange={(event) => setForm({ ...form, department_id: event.target.value || null })}>
          <option value="">Без подразделения</option>
          {departmentsQuery.data?.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          Активен
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(form.must_change_password)} onChange={(event) => setForm({ ...form, must_change_password: event.target.checked })} />
          Требовать смену пароля при первом входе
        </label>
        <div className="access-list">
          <h3>Доступные ИИ-агенты</h3>
          {!agentsQuery.data?.length ? <small>Агенты пока не созданы.</small> : agentsQuery.data.map((agent) => {
            const grant = form.agent_access?.find((access) => access.agent_id === agent.id);
            return (
              <div className="access-item" key={agent.id}>
                <label className="checkbox-row">
                  <input type="checkbox" checked={Boolean(grant)} onChange={(event) => toggleAgentAccess(agent.id, event.target.checked)} />
                  {agent.name}
                </label>
                {grant && (
                  <div className="access-flags">
                    <label><input type="checkbox" checked={grant.can_run ?? true} onChange={(event) => updateAgentGrant(agent.id, { can_run: event.target.checked })} /> Запуск</label>
                    <label><input type="checkbox" checked={grant.can_view_results ?? true} onChange={(event) => updateAgentGrant(agent.id, { can_view_results: event.target.checked })} /> Результаты</label>
                    <label><input type="checkbox" checked={grant.can_approve ?? false} onChange={(event) => updateAgentGrant(agent.id, { can_approve: event.target.checked })} /> Согласование</label>
                    <label><input type="checkbox" checked={grant.can_configure ?? false} onChange={(event) => updateAgentGrant(agent.id, { can_configure: event.target.checked })} /> Настройка</label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button disabled={createMutation.isPending}>{createMutation.isPending ? "Создаём..." : "Создать"}</button>
        {createMutation.isError && <div className="error">Не удалось создать пользователя.</div>}
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
                  <td>{item.is_active ? "Активен" : "Заблокирован"}{item.must_change_password ? <><br /><small>Нужна смена пароля</small></> : null}</td>
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
