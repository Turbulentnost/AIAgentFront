import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { departmentsApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import type { DepartmentCreate } from "@/types";

export default function Departments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DepartmentCreate>({ name: "", slug: "", description: "" });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: departmentsApi.list });
  const createMutation = useMutation({
    mutationFn: departmentsApi.create,
    onSuccess: async () => {
      setForm({ name: "", slug: "", description: "" });
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    }
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({ ...form, is_active: true });
  }

  return (
    <div className="grid two-columns">
      {user?.is_superuser && (
        <form className="card form-card" onSubmit={handleSubmit}>
          <h2>Создать подразделение</h2>
          <input placeholder="Название" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <input placeholder="Код / slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
          <textarea placeholder="Описание" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <button disabled={createMutation.isPending}>{createMutation.isPending ? "Создаём..." : "Создать"}</button>
        </form>
      )}
      <div className="card">
        <h2>Подразделения</h2>
        {departmentsQuery.isError && <p className="error">Не удалось загрузить подразделения.</p>}
        {!departmentsQuery.data?.length ? <p>Подразделения ещё не созданы.</p> : (
          <table>
            <tbody>
              {departmentsQuery.data.map((department) => (
                <tr key={department.id}>
                  <td>{department.name}<br /><small>{department.slug}</small></td>
                  <td>{department.is_active ? "Активно" : "Отключено"}</td>
                  <td>{department.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
