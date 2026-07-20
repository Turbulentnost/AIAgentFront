import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CONTOUR4_AGENT_LIST, CONTOUR4_AGENTS, isContour4AgentId } from "@/mock-data/contour4";
import type {
  Contour4AgentId,
  Contour4Hitl,
  Contour4HitlDecisionPayload,
  Contour4Kpi,
  Contour4KpiSummary,
  Contour4Notification,
  Contour4Widget
} from "@/types/contour4";
import { createId } from "@/utils/createId";
import Contour4WidgetHost from "./Contour4WidgetHost";
import {
  canViewHitlSensitive,
  filterRowsByCfoCode,
  getContour4Session,
  setContour4Session
} from "./contour4Session";
import styles from "./Contour4Workspace.module.css";
import {
  buildKpis,
  formatKpiValue,
  kpiStatus,
  progressPct,
  statusLabel,
  summarizeKpis
} from "./kpiUtils";

function AgentNav({ activeId }: { activeId: string }) {
  return (
    <nav className={styles.muted} style={{ fontSize: 12 }}>
      {CONTOUR4_AGENT_LIST.map((id, index) => {
        const agent = CONTOUR4_AGENTS[id];
        return (
          <span key={id}>
            {index > 0 ? " · " : null}
            <Link to={`/contour4/${id}`} className={id === activeId ? styles.active : undefined}>
              {agent.sysNo} {agent.role}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

function SummaryRow({ sum }: { sum: Contour4KpiSummary }) {
  const cards = [
    {
      key: "ok",
      iconClass: styles.statusIconOk,
      valueClass: styles.statusValueOk,
      activeClass:
        sum.blocking === 0 && sum.below === 0 ? styles.statusCardActiveOk : undefined,
      icon: "✓",
      title: "Достигнуто",
      desc: `${sum.pct}% KPI в целевом диапазоне`,
      value: sum.ok
    },
    {
      key: "warn",
      iconClass: styles.statusIconWarn,
      valueClass: styles.statusValueWarn,
      activeClass:
        sum.border > 0 && sum.blocking === 0 ? styles.statusCardActiveWarn : undefined,
      icon: "!",
      title: "На границе",
      desc: "Показатель близко к целевому порогу",
      value: sum.border
    },
    {
      key: "bad",
      iconClass: styles.statusIconBad,
      valueClass: styles.statusValueBad,
      activeClass:
        sum.blocking > 0 || sum.below > 0 ? styles.statusCardActiveBad : undefined,
      icon: "!",
      title: "Критические",
      desc: "Ниже цели или блокирующие отклонения",
      value: sum.blocking + sum.below
    },
    {
      key: "total",
      iconClass: styles.statusIconNeutral,
      valueClass: styles.statusValueNeutral,
      activeClass: undefined,
      icon: "#",
      title: "Всего KPI",
      desc: "Специальные §12.2 и общие §12.1",
      value: sum.total
    },
    {
      key: "blocking",
      iconClass: styles.statusIconBad,
      valueClass: styles.statusValueBad,
      activeClass: undefined,
      icon: "×",
      title: "Блокирующих",
      desc: "Требуют внимания / остановки процесса",
      value: sum.blocking
    },
    {
      key: "guardrail",
      iconClass: styles.statusIconNeutral,
      valueClass: styles.statusValueNeutral,
      activeClass: undefined,
      icon: "◎",
      title: "Guardrail",
      desc: "Срабатывания защитных ограничений",
      value: sum.guardrail
    }
  ];

  return (
    <div className={styles.summaryRow}>
      {cards.map((card) => (
        <div
          key={card.key}
          className={`${styles.statusCard}${card.activeClass ? ` ${card.activeClass}` : ""}`}
        >
          <div className={card.iconClass} aria-hidden="true">
            {card.icon}
          </div>
          <div className={styles.statusBody}>
            <h3 className={styles.statusTitle}>{card.title}</h3>
            <p className={styles.statusDesc}>{card.desc}</p>
          </div>
          <div className={card.valueClass}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}

function KpiGrid({ kpis }: { kpis: Contour4Kpi[] }) {
  return (
    <>
      <h2 className={styles.sectionTitle}>Показатели эффективности (KPI)</h2>
      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => {
          const st = kpiStatus(kpi);
          const pct = progressPct(kpi);
          const blocking = kpi.blocking && st !== "ok";
          const statusClass =
            st === "ok"
              ? styles.kpiStatusOk
              : st === "border"
                ? styles.kpiStatusBorder
                : styles.kpiStatusBelow;
          const barClass =
            st === "ok"
              ? styles.progressBar
              : st === "border"
                ? styles.progressBorder
                : styles.progressBelow;
          return (
            <article
              key={kpi.id}
              className={blocking ? styles.kpiCardBlocking : styles.kpiCard}
            >
              <div className={styles.kpiCardTop}>
                <span className={styles.kpiId}>{kpi.id}</span>
                {blocking ? <span className={styles.badgeBlocking}>БЛОКИРУЮЩИЙ</span> : null}
              </div>
              <div className={styles.kpiName}>{kpi.name}</div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{formatKpiValue(kpi)}</span>
                <span className={styles.kpiTarget}>цель {kpi.target}</span>
              </div>
              <div className={styles.progress}>
                <i className={barClass} style={{ width: `${pct}%` }} />
              </div>
              <div className={statusClass}>
                <span className={styles.dot} />
                {statusLabel(st)}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function NotificationsPanel({
  notifications,
  unread
}: {
  notifications: Contour4Notification[];
  unread: number;
}) {
  return (
    <div className={styles.panelCard}>
      <div className={styles.panelCardHead}>
        Уведомления
        {unread > 0 ? <span className={styles.badgeCount}>{unread}</span> : null}
      </div>
      <div className={styles.panelCardBody}>
        {!notifications.length ? (
          <p className={styles.hitlEmpty}>Нет уведомлений</p>
        ) : (
          <ul className={styles.notifList}>
            {notifications.map((n) => (
              <li
                key={n.id}
                className={n.unread ? styles.notifItemUnread : styles.notifItem}
              >
                <div
                  className={
                    n.type === "hitl"
                      ? styles.nTypeHitl
                      : n.type === "escalation"
                        ? styles.nTypeEscalation
                        : styles.nType
                  }
                >
                  {n.type}
                </div>
                <div className={styles.nTitle}>{n.title}</div>
                <div className={styles.nText}>{n.text}</div>
                <div className={styles.nTime}>{n.time}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

async function submitHitlDecision(payload: Contour4HitlDecisionPayload): Promise<void> {
  // Mock transport — same payload shape as backend resume (human_action + idempotency_key)
  await new Promise((r) => setTimeout(r, 400));
  console.info("[contour4 HITL mock submit]", payload);
}

function HitlPanel({
  agentId,
  hitl,
  requiresHumanReview,
  canViewSensitive,
  blockApproveRegistry,
  doneAction,
  lastIdempotencyKey,
  onDecide
}: {
  agentId: Contour4AgentId;
  hitl: Contour4Hitl;
  requiresHumanReview: boolean;
  canViewSensitive: boolean;
  blockApproveRegistry: boolean;
  doneAction: string | null;
  lastIdempotencyKey: string | null;
  onDecide: (action: string, idempotencyKey: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!requiresHumanReview) {
    return (
      <div className={styles.panelCard}>
        <div className={styles.panelCardHead}>Окно решения (HITL)</div>
        <div className={styles.panelCardBody}>
          <p className={styles.hitlEmpty}>
            requires_human_review=false — пауза графа не активна
          </p>
        </div>
      </div>
    );
  }

  if (doneAction) {
    return (
      <div className={styles.panelCard}>
        <div className={styles.panelCardHead}>Окно решения (HITL)</div>
        <div className={styles.panelCardBody}>
          <div className={styles.hitlDone}>
            Решение отправлено: <code>{doneAction}</code>
            <br />
            <span style={{ fontWeight: 500 }}>Mock transport — payload с idempotency_key</span>
            {lastIdempotencyKey ? (
              <p className={styles.idemKey}>idempotency_key: {lastIdempotencyKey}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const handleClick = async (action: string, requiresComment: boolean) => {
    if (submitting) return;
    if (requiresComment && !comment.trim()) {
      setError("Для этого действия нужен комментарий (requires_comment).");
      return;
    }
    if (
      (action === "approve" || action === "approve_registry") &&
      blockApproveRegistry
    ) {
      setError("Утверждение реестра запрещено: есть строки без согласования ЦФО.");
      return;
    }
    if (!canViewSensitive) {
      setError("Недостаточно прав (user_role ≠ hitl_assignee_role).");
      return;
    }
    setError(null);
    setSubmitting(true);
    const idempotencyKey = createId();
    try {
      await onDecide(action, idempotencyKey);
    } finally {
      setSubmitting(false);
    }
  };

  const btnClass = (style: Contour4Hitl["buttons"][number]["style"]) => {
    if (style === "primary") return styles.btnPrimary;
    if (style === "danger") return styles.btnDanger;
    return styles.btnSecondary;
  };

  const maskedFields = canViewSensitive
    ? hitl.fields
    : hitl.fields.map((f) =>
        f.format === "money" ? { ...f, value: "••••" } : f
      );

  return (
    <div className={styles.panelCard}>
      <div className={styles.panelCardHead}>Окно решения (HITL)</div>
      <div className={styles.panelCardBody}>
        {!canViewSensitive ? (
          <div className={styles.roleGateBanner}>
            Роль сессии не совпадает с assignee_role=<code>{hitl.assignee_role}</code>.
            Суммы скрыты. Переключите роль сессии Contour4 ниже в шапке.
          </div>
        ) : null}
        <div className={styles.hitlHeadRow}>
          <h3 className={styles.hitlTitle}>{hitl.title}</h3>
          <span className={styles.badgeOk}>Ожидает решения</span>
        </div>
        <p className={styles.hitlSummary}>{hitl.summary}</p>
        {hitl.recommendation ? (
          <p className={styles.hitlSuggest}>{hitl.recommendation}</p>
        ) : null}
        {hitl.risks.length > 0 ? (
          <div className={styles.hitlAlert}>
            <strong>Требуется решение человека</strong>
            <p>{hitl.summary}</p>
          </div>
        ) : null}
        <div className={styles.hitlFields}>
          {maskedFields.map((field) => (
            <div key={field.key} className={styles.hitlField}>
              <span className={styles.fLabel}>{field.label}</span>
              <span className={styles.fValue}>{field.value}</span>
            </div>
          ))}
        </div>
        {hitl.risks.length > 0 ? (
          <div className={styles.hitlRisks}>
            <strong>Риски</strong>
            <ul>
              {hitl.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className={styles.hitlSuggest}>
          Рекомендация агента: <code>{hitl.suggested_action || "—"}</code>
        </p>
        {hitl.norm_refs.length > 0 ? (
          <p className={styles.hitlSuggest}>Нормы: {hitl.norm_refs.join(" · ")}</p>
        ) : null}
        <textarea
          className={styles.hitlComment}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Комментарий (если required)"
          disabled={submitting || !canViewSensitive}
        />
        {error ? <p className={styles.hitlError}>{error}</p> : null}
        <div className={styles.hitlActions}>
          {hitl.buttons.map((btn) => {
            const blockedApprove =
              blockApproveRegistry &&
              (btn.action === "approve" || btn.action === "approve_registry");
            return (
              <button
                key={btn.id}
                type="button"
                className={btnClass(btn.style)}
                disabled={submitting || !canViewSensitive || blockedApprove}
                title={
                  blockedApprove
                    ? "Есть строки без ЦФО"
                    : undefined
                }
                onClick={() => void handleClick(btn.action, btn.requires_comment)}
              >
                {submitting ? "Отправка…" : btn.label}
              </button>
            );
          })}
        </div>
        <p className={styles.idemKey}>
          agent={agentId}; assignee={hitl.hitl_assignee_role ?? hitl.assignee_role}
        </p>
      </div>
    </div>
  );
}

function applyAbacToWidgets(
  widgets: Contour4Widget[],
  agentId: Contour4AgentId,
  sessionRole: string,
  cfoCode?: string
): Contour4Widget[] {
  const session = { user_role: sessionRole, cfo_code: cfoCode };
  return widgets.map((w) => {
    if (w.type !== "table" || !w.data.rows) return w;

    if (agentId === "accountant" && w.id === "W-ACC-QUEUE") {
      return {
        ...w,
        data: {
          ...w.data,
          rows: w.data.rows.filter(
            (r) => r.fully_approved === true || r.fully_approved === "true"
          )
        }
      };
    }

    if (agentId === "cfo_head") {
      const rows = filterRowsByCfoCode(w.data.rows, session, agentId);
      return { ...w, data: { ...w.data, rows } };
    }

    return w;
  });
}

export default function Contour4AgentWorkspace() {
  const { agentId = "" } = useParams();
  const [doneAction, setDoneAction] = useState<string | null>(null);
  const [lastIdempotencyKey, setLastIdempotencyKey] = useState<string | null>(null);
  const [sessionTick, setSessionTick] = useState(0);

  useEffect(() => {
    setDoneAction(null);
    setLastIdempotencyKey(null);
  }, [agentId]);

  const agent = isContour4AgentId(agentId) ? CONTOUR4_AGENTS[agentId] : null;
  const session = useMemo(
    () => getContour4Session(isContour4AgentId(agentId) ? agentId : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionTick forces re-read
    [agentId, sessionTick]
  );

  const kpis = useMemo(() => (agent ? buildKpis(agent) : []), [agent]);
  const sum = useMemo(() => summarizeKpis(kpis), [kpis]);

  const widgets = useMemo(() => {
    if (!agent) return [];
    return applyAbacToWidgets(
      agent.widgets,
      agent.id,
      session.user_role,
      session.cfo_code
    );
  }, [agent, session.cfo_code, session.user_role]);

  const canViewSensitive = agent
    ? canViewHitlSensitive(session, agent.hitl.assignee_role)
    : false;

  const blockApproveRegistry = useMemo(() => {
    if (!agent || agent.id !== "executive_director") return false;
    const lines = agent.widgets.find((w) => w.id === "W-EXEC-LINES");
    return (lines?.data.rows ?? []).some(
      (r) => r.cfo_approved === false || r.cfo_approved === "false"
    );
  }, [agent]);

  if (!agent) {
    return (
      <div className={styles.root}>
        <div className={styles.appBar}>
          <nav>
            <Link to="/contour4">← Все роли контура 4</Link>
          </nav>
        </div>
        <div className={styles.notFound}>
          Агент не найден.{" "}
          <Link to="/contour4">Вернуться к списку</Link>
        </div>
      </div>
    );
  }

  const unread = agent.notifications.filter((n) => n.unread).length;

  const onDecide = async (action: string, idempotencyKey: string) => {
    const payload: Contour4HitlDecisionPayload = {
      agent_id: agent.id,
      human_action: action,
      human_payload: {
        comment: undefined,
        ...(action === "set_priority"
          ? {
              line_priorities: [
                { payment_request_id: "PR-9", priority: 1 },
                { payment_request_id: "PR-1", priority: 2 }
              ]
            }
          : {})
      },
      idempotency_key: idempotencyKey,
      hitl_assignee_role: agent.hitl.hitl_assignee_role ?? agent.hitl.assignee_role,
      user_role: String(session.user_role)
    };
    await submitHitlDecision(payload);
    setLastIdempotencyKey(idempotencyKey);
    setDoneAction(action);
  };

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
              onChange={(e) => {
                setContour4Session({
                  user_role: e.target.value,
                  cfo_code: session.cfo_code ?? "CFO-12"
                });
                setSessionTick((t) => t + 1);
              }}
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
                  onChange={(e) => {
                    setContour4Session({
                      user_role: session.user_role,
                      cfo_code: e.target.value
                    });
                    setSessionTick((t) => t + 1);
                  }}
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
          Mock Contour4 — виджеты MVP + HITL с idempotency_key и gate assignee_role. Без боевого
          API портов 8101–8106 (payload готов к интеграции).
        </div>
      </div>
    </div>
  );
}
