import { useQuery } from "@tanstack/react-query";
import { healthApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";

export default function Topbar({ title }: { title: string }) {
  const { data, isError } = useQuery({ queryKey: ["health", "live"], queryFn: healthApi.get, refetchInterval: 15000 });
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div className="topbar-actions">
        <span className="pill">{user?.full_name || user?.email || "Пользователь"}</span>
        <span className="pill">{isError ? "Backend недоступен" : data ? `Backend: ${data.environment}` : "Проверка backend"}</span>
        <button className="secondary-button" onClick={() => void logout()}>Выйти</button>
      </div>
    </header>
  );
}
