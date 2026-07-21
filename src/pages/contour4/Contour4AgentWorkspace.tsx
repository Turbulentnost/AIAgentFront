import { Link, useParams } from "react-router-dom";
import { CONTOUR4_AGENT_LIST } from "@/mock-data/contour4";
import AgentNav from "./components/AgentNav";
import HitlPanel from "./components/HitlPanel";
import KpiGrid from "./components/KpiGrid";
import NotificationsPanel from "./components/NotificationsPanel";
import SummaryRow from "./components/SummaryRow";
import Contour4WidgetHost from "./Contour4WidgetHost";
import styles from "./Contour4Workspace.module.css";
import { useContour4Session } from "./hooks/useContour4Session";
import { useContour4WorkspaceModel } from "./hooks/useContour4WorkspaceModel";
import { useHitlDecision } from "./hooks/useHitlDecision";

export default function Contour4AgentWorkspace() {
  const { agentId = "" } = useParams();
  const { session, updateSession } = useContour4Session(agentId);
  const {
    agent,
    kpis,
    sum,
    widgets,
    canViewSensitive,
    blockApproveRegistry,
    unread
  } = useContour4WorkspaceModel(agentId, session);
  const { doneAction, lastIdempotencyKey, onDecide } = useHitlDecision({
    agentId,
    agent,
    session
  });

  if (!agent) {
    return (
      <div className={styles.root}>
        <div className={styles.appBar}>
          <nav>
            <Link to="/contour4">← Все роли контура 4</Link>
          </nav>
        </div>
        <div className={styles.notFound}>
          Агент не найден. <Link to="/contour4">Вернуться к списку</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.appBar}>
        <nav>
          <Link to="/contour4">← Все роли контура 4</Link>
          <span className={styles.muted}>|</span>
          <span className={styles.layoutBadge}>A · правая панель</span>
        </nav>
        <AgentNav activeId={agent.id} />
      </div>

      <div className={styles.page}>
        <section className={styles.headerCard}>
          <div className={styles.headerTop}>
            <h1>{agent.title}</h1>
          </div>
          <div className={styles.pills}>
            <span className={styles.pillStrong}>{agent.role}</span>
            <span className={styles.pill}>{agent.tz}</span>
            <span className={styles.pill}>{agent.sysNo}</span>
            <span className={styles.pill}>Подчиняется: {agent.reportsTo}</span>
            <span className={styles.pillAutonomy}>
              Уровень автономности {agent.autonomy}
            </span>
            <span className={styles.pill}>
              requires_human_review={String(agent.requires_human_review)}
            </span>
          </div>
          <div className={styles.sessionBar}>
            <span className={styles.muted}>Сессия Contour4 (stub Keycloak):</span>
            <select
              value={String(session.user_role)}
              onChange={(e) =>
                updateSession({
                  user_role: e.target.value,
                  cfo_code: session.cfo_code ?? "CFO-12"
                })
              }
            >
              {CONTOUR4_AGENT_LIST.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
              <option value="*">* (admin)</option>
            </select>
            {agent.id === "cfo_head" ? (
              <>
                <span className={styles.muted}>cfo_code:</span>
                <select
                  value={session.cfo_code ?? "CFO-12"}
                  onChange={(e) =>
                    updateSession({
                      user_role: session.user_role,
                      cfo_code: e.target.value
                    })
                  }
                >
                  <option value="CFO-12">CFO-12</option>
                  <option value="CFO-07">CFO-07</option>
                  <option value="CFO-99">CFO-99 (чужой)</option>
                </select>
              </>
            ) : null}
          </div>
        </section>

        <div className={styles.layoutA}>
          <main>
            <SummaryRow sum={sum} />
            <Contour4WidgetHost
              widgets={widgets}
              highlightBlockedRows={agent.id === "executive_director"}
            />
            <KpiGrid kpis={kpis} />
          </main>
          <aside className={styles.sidePanel}>
            <NotificationsPanel
              notifications={agent.notifications}
              unread={doneAction ? 0 : unread}
            />
            <HitlPanel
              agentId={agent.id}
              hitl={agent.hitl}
              requiresHumanReview={agent.requires_human_review}
              canViewSensitive={canViewSensitive}
              blockApproveRegistry={blockApproveRegistry}
              doneAction={doneAction}
              lastIdempotencyKey={lastIdempotencyKey}
              onDecide={onDecide}
            />
          </aside>
        </div>

        <div className={styles.mockBanner}>
          Mock Contour4 — виджеты MVP + HITL с idempotency_key и gate
          assignee_role. Без боевого API портов 8101–8106 (payload готов к
          интеграции).
        </div>
      </div>
    </div>
  );
}
