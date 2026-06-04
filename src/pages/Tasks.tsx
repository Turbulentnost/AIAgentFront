import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/api/endpoints";

export default function Tasks() {
  const { data, isError, isPending } = useQuery({ queryKey: ["tasks", "list"], queryFn: () => tasksApi.list() });

  if (isPending) return <div className="card">Загружаем задачи...</div>;
  if (isError) return <div className="card">Не удалось загрузить задачи</div>;

  return (
    <div className="card">
      <h2>Задачи оркестратора</h2>
      {!data?.length ? (
        <p>Задач пока нет.</p>
      ) : (
        <table>
          <tbody>
            {data.map((task) => (
              <tr key={task.id}>
                <td>
                  {task.title}
                  {task.description && (
                    <>
                      <br />
                      <small>{task.description}</small>
                    </>
                  )}
                </td>
                <td>{task.status}</td>
                <td>
                  {task.agent_id && <small>agent: {task.agent_id.slice(0, 8)}…</small>}
                  {task.celery_task_id && (
                    <>
                      <br />
                      <small>celery: {task.celery_task_id.slice(0, 8)}…</small>
                    </>
                  )}
                  {task.error_message && (
                    <>
                      <br />
                      <small className="error">{task.error_message}</small>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
