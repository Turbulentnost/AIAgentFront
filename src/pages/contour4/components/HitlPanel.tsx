import { useEffect, useRef, useState } from "react";
import type { Contour4AgentId, Contour4Hitl } from "@/types/contour4";
import { createId } from "@/utils/createId";
import styles from "../Contour4Workspace.module.css";
import { validateHitlClick } from "../lib/hitlValidation";

export default function HitlPanel({
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
  onDecide: (
    action: string,
    idempotencyKey: string,
    signal?: AbortSignal
  ) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const aliveRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

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
            <span style={{ fontWeight: 500 }}>
              Mock transport — payload с idempotency_key
            </span>
            {lastIdempotencyKey ? (
              <p className={styles.idemKey}>
                idempotency_key: {lastIdempotencyKey}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const handleClick = async (action: string, requiresComment: boolean) => {
    if (submitting) return;
    const validationError = validateHitlClick({
      action,
      comment,
      canViewSensitive,
      blockApproveRegistry,
      requiresComment
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    const idempotencyKey = createId();
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await onDecide(action, idempotencyKey, ac.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      throw err;
    } finally {
      if (aliveRef.current) {
        setSubmitting(false);
      }
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
            Роль сессии не совпадает с assignee_role=
            <code>{hitl.assignee_role}</code>. Суммы скрыты. Переключите роль
            сессии Contour4 ниже в шапке.
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
          <p className={styles.hitlSuggest}>
            Нормы: {hitl.norm_refs.join(" · ")}
          </p>
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
                title={blockedApprove ? "Есть строки без ЦФО" : undefined}
                onClick={() => void handleClick(btn.action, btn.requires_comment)}
              >
                {submitting ? "Отправка…" : btn.label}
              </button>
            );
          })}
        </div>
        <p className={styles.idemKey}>
          agent={agentId}; assignee=
          {hitl.hitl_assignee_role ?? hitl.assignee_role}
        </p>
      </div>
    </div>
  );
}
