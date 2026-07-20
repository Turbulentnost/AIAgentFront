import { Link } from "react-router-dom";
import { CONTOUR4_AGENT_LIST, CONTOUR4_AGENTS } from "@/mock-data/contour4";
import styles from "./Contour4Workspace.module.css";

export default function Contour4Hub() {
  return (
    <div className={styles.root}>
      <div className={styles.appBar}>
        <nav>
          <Link to="/login">← Вход в платформу</Link>
          <span className={styles.muted}>|</span>
          <span className={styles.layoutBadge}>Контур №4 · mock UI</span>
        </nav>
      </div>

      <div className={styles.hub}>
        <h1>Дашборды KPI — контур №4</h1>
        <p className={styles.lead}>
          Статические рабочие места по макетам ui_mocks (Layout A: KPI слева, уведомления и HITL
          справа). Без вызовов API — только демо-данные.
        </p>

        <div className={styles.hubGrid}>
          {CONTOUR4_AGENT_LIST.map((id) => {
            const agent = CONTOUR4_AGENTS[id];
            return (
              <Link key={id} className={styles.hubCard} to={`/contour4/${id}`}>
                <strong>{agent.title}</strong>
                <span>
                  {agent.role} · {agent.sysNo} · {agent.tz}
                </span>
                <span className={styles.hubTag}>автономность {agent.autonomy}</span>
              </Link>
            );
          })}
        </div>

        <div className={styles.mockBanner} style={{ marginTop: 32 }}>
          Источник дизайна: папка ui_mocks. Интеграция с AIAgentBack и оркестратор — отдельно.
        </div>
      </div>
    </div>
  );
}
