import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "@/api/endpoints";
export default function Agents() {
  const { data, isError } = useQuery({ queryKey: ["agents", "available"], queryFn: agentsApi.available });
  if (isError) return <div className="card">Не удалось загрузить агентов</div>;
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2>Доступные агенты</h2>
        <Link to="/agent-builder" className="pill">Создать агента</Link>
      </div>
      {!data?.length ? <p>Нет агентов, доступных текущему пользователю.</p> : (
        <table>
          <tbody>
            {data.map((agent) => (
              <tr key={agent.id}>
                <td>{agent.name}<br /><small>{agent.purpose || agent.slug}</small></td>
                <td>{agent.status}</td>
                <td>
                  {agent.can_run && <span className="pill">Запуск</span>}
                  {agent.can_approve && <span className="pill">Согласование</span>}
                  {agent.can_configure && <span className="pill">Настройка</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
