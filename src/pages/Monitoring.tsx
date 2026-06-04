import { useQuery } from "@tanstack/react-query";
import { healthApi } from "@/api/endpoints";

export default function Monitoring() {
  const health = useQuery({ queryKey: ["health"], queryFn: healthApi.get, refetchInterval: 15000 });
  const ready = useQuery({ queryKey: ["health", "ready"], queryFn: healthApi.ready, refetchInterval: 15000 });

  return (
    <div className="grid">
      <div className="card">
        <h2>Health</h2>
        {health.isError ? (
          <p className="error">Backend недоступен</p>
        ) : health.data ? (
          <dl className="details">
            <dt>Статус</dt>
            <dd>{health.data.status}</dd>
            <dt>Среда</dt>
            <dd>{health.data.environment}</dd>
            <dt>Версия</dt>
            <dd>{health.data.version}</dd>
          </dl>
        ) : (
          <p>Проверка...</p>
        )}
      </div>
      <div className="card">
        <h2>Ready</h2>
        {ready.isError ? (
          <p className="error">Сервис не готов (БД или зависимости)</p>
        ) : ready.data ? (
          <dl className="details">
            <dt>Статус</dt>
            <dd>{ready.data.status}</dd>
            {ready.data.checks &&
              Object.entries(ready.data.checks).flatMap(([key, value]) => [
                <dt key={`${key}-dt`}>{key}</dt>,
                <dd key={`${key}-dd`}>{value}</dd>
              ])}
          </dl>
        ) : (
          <p>Проверка...</p>
        )}
      </div>
      <div className="card">
        <h2>Метрики</h2>
        <p>Prometheus-метрики backend: <code>/metrics</code> (на том же хосте API).</p>
      </div>
    </div>
  );
}
