import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, departmentsApi, tasksApi } from "@/api/endpoints";
import { FormSelect } from "@/components/form-controls";
import type { AgentAccess, AgentStatus, Task } from "@/types";
import styles from "./Agents.module.css";

const AGENT_ILLUSTRATION = "/agent-catalog-illustration.png";

type KindTab = "all" | "chat" | "abstract";
type CategoryFilter = "all" | "generative" | "analytic";

const kindTabs: { id: KindTab; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "chat", label: "Чат-агенты" },
  { id: "abstract", label: "Абстрактные агенты" }
];

const categoryOptions = [
  { value: "all", label: "Все типы" },
  { value: "generative", label: "Генеративные" },
  { value: "analytic", label: "Аналитические" }
];

const statusPresentation: Record<
  AgentStatus,
  { label: string; tone: "active" | "blocked" | "inactive" }
> = {
  active: { label: "Активен", tone: "active" },
  ope: { label: "Активен", tone: "active" },
  testing: { label: "Деактивирован", tone: "inactive" },
  refinement: { label: "Деактивирован", tone: "inactive" },
  draft: { label: "Деактивирован", tone: "inactive" },
  suspended: { label: "Заблокирован", tone: "blocked" },
  archived: { label: "Заблокирован", tone: "blocked" }
};

function agentSearchKey(agent: AgentAccess) {
  return `${agent.slug} ${agent.name} ${agent.purpose ?? ""}`.toLowerCase();
}

function getAgentKind(agent: AgentAccess): "chat" | "abstract" {
  const key = agentSearchKey(agent);
  if (/chat|чат|assistant|ассистент|dialog|диалог/.test(key)) return "chat";
  return "abstract";
}

function getAgentCategory(agent: AgentAccess): "generative" | "analytic" {
  const key = agentSearchKey(agent);
  if (/generat|генерат|llm|gpt|chat|чат|text|текст|summary|сводк/.test(key)) return "generative";
  return "analytic";
}

function getCapabilityLabel(agent: AgentAccess) {
  const key = agentSearchKey(agent);
  if (/file|файл|вложен|attachment|1с|1c/.test(key)) return "Анализирует файлы";
  if (/document|документ|\bkd\b|\btd\b|кд|тд/.test(key)) return "Анализирует документы";
  if (/tender|тендер|закуп|procurement/.test(key)) return "Анализирует закупки";
  if (/comment|коммент|исполн/.test(key)) return "Анализирует комментарии";
  return "Автоматизирует задачи";
}

function formatUsageCount(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function buildUsageMap(tasks: Task[]) {
  const map = new Map<string, number>();
  for (const task of tasks) {
    if (!task.agent_id) continue;
    map.set(task.agent_id, (map.get(task.agent_id) ?? 0) + 1);
  }
  return map;
}

function pickRecommended(agents: AgentAccess[]) {
  const score = (agent: AgentAccess) => {
    const status = statusPresentation[agent.status];
    if (status.tone === "active") return 0;
    if (status.tone === "inactive") return 1;
    return 2;
  };

  return [...agents].sort((left, right) => score(left) - score(right)).slice(0, 6);
}

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const presentation = statusPresentation[status];
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
