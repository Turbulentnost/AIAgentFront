import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/api/endpoints";
export default function Tasks() {
  const { data, isError } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });
  if (isError) return <div className="card">Не удалось загрузить задачи</div>;
  return <div className="card"><h2>Задачи оркестратора</h2>{!data?.length ? <p>Задач пока нет.</p> : <table><tbody>{data.map((t) => <tr key={t.id}><td>{t.title}</td><td>{t.status}</td></tr>)}</tbody></table>}</div>;
}
