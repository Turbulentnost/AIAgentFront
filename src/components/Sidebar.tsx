import { NavLink } from "react-router-dom";
export const nav = [
  ["/", "Дашборд"],
  ["/agents", "Агенты"],
  ["/agent-builder", "Конструктор агентов"],
  ["/tasks", "Задачи"],
  ["/knowledge-base", "База знаний"],
  ["/documents", "Документы"],
  ["/users", "Пользователи"],
  ["/departments", "Подразделения"],
  ["/profile", "Профиль"],
  // ["/monitoring", "Мониторинг"]
] as const;

export default function Sidebar() {
  return <aside className="sidebar"><div className="brand">AI Agents</div><nav>{nav.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} className={({isActive}) => `nav-link ${isActive ? "active" : ""}`}>{label}</NavLink>)}</nav></aside>;
}
