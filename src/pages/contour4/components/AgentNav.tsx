import { Link } from "react-router-dom";
import { CONTOUR4_AGENT_LIST, CONTOUR4_AGENTS } from "@/mock-data/contour4";
import styles from "../Contour4Workspace.module.css";

export default function AgentNav({ activeId }: { activeId: string }) {
  return (
    <nav className={styles.muted} style={{ fontSize: 12 }}>
      {CONTOUR4_AGENT_LIST.map((id, index) => {
        const agent = CONTOUR4_AGENTS[id];
        return (
          <span key={id}>
            {index > 0 ? " · " : null}
            <Link
              to={`/contour4/${id}`}
              className={id === activeId ? styles.active : undefined}
            >
              {agent.sysNo} {agent.role}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
