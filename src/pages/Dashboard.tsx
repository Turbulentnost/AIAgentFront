import { useQuery } from "@tanstack/react-query";
import { agentsApi, departmentsApi, tasksApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
export default function Dashboard() {
  const { user } = useAuth();
  const agents = useQuery({ queryKey: ["agents", "available"], queryFn: agentsApi.available });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });
  const departments = useQuery({ queryKey: ["departments"], queryFn: departmentsApi.list });
  return (
    <div className="grid">
      <div className="card"><b>Доступные агенты</b><strong>{agents.data?.length ?? "-"}</strong></div>
      <div className="card"><b>Задачи</b><strong>{tasks.data?.length ?? "-"}</strong></div>
      <div className="card"><b>Подразделения</b><strong>{departments.data?.length ?? "-"}</strong></div>
      <div className="card"><b>Пользователь</b><p>{user?.full_name || user?.email}</p><p>{user?.is_superuser ? "Суперадминистратор" : "Пользователь платформы"}</p></div>
      <div className="card"><b>Стек</b><p>FastAPI, JWT, PostgreSQL, Redis, Qdrant, MinIO</p></div>
    </div>
  );
}
