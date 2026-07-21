import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Play,
  ShieldAlert,
  UserCheck
} from "lucide-react";
import {
  useOmtoDashboard,
  useOmtoPermissions,
  useResumeOmtoAgent,
  useRunOmtoAgent
} from "@/hooks/useOmtoDashboard";
import type { OmtoKpiRow } from "@/types/omto";
import { HitlDecisionCard } from "./HitlDecisionCard";
import styles from "./OmtoAgentDashboard.module.css";

// Тип задачи по умолчанию для кнопки «Запустить агента» (наполняет реальные KPI).
const DEFAULT_TASK_TYPE: Record<string, string> = {
  procurement_manager_agent: "validate_spec",
  omto_head_agent: "daily_report",
  omto_deputy_agent: "assign_positions",
  kb_engineer_agent: "analog_review",
  security_officer_agent: "new_supplier_check"
};

function formatValue(row: OmtoKpiRow): string {
  if (row.value === null || row.value === undefined) return "—";
  if (row.unit === "percent") return `${row.value}%`;
  return `${row.value}`;
}

function cardTone(status: OmtoKpiRow["status"]): string {
  switch (status) {
    case "achieved":
      return styles.ok;
    case "warn":
      return styles.warn;
    case "below":
      return styles.bad;
    default:
      return styles.muted;
  }
}

function StatusPill({ row }: { row: OmtoKpiRow }) {
  switch (row.status) {
    case "achieved":
      return <span className={`${styles.pill} ${styles.pillOk}`}>Достигнут</span>;
    case "warn":
      return <span className={`${styles.pill} ${styles.pillWarn}`}>На границе</span>;
    case "below":
      return <span className={`${styles.pill} ${styles.pillBad}`}>Ниже цели</span>;
    case "pending_integration":
      return <span className={`${styles.pill} ${styles.pillMuted}`}>Ожидает интеграции 1С</span>;
    default:
      return <span className={`${styles.pill} ${styles.pillMuted}`}>Нет данных о запусках</span>;
  }
}

export default function OmtoAgentDashboard({ slug }: { slug: string }) {
  const permissionsQuery = useOmtoPermissions();
  const canAccess = permissionsQuery.data?.accessible_role_agents?.includes(slug) ?? false;
  const dashboardQuery = useOmtoDashboard(slug, canAccess);
  const runMutation = useRunOmtoAgent(slug);
  const resumeMutation = useResumeOmtoAgent(slug);
  // Последний результат запуска/возобновления — для панели HITL.
  // Панель показываем только для реальной HITL-паузы (есть hitl_pending),
  // а не для статуса needs_input (не хватает входных данных — возобновлять нечего).
  const lastResult = resumeMutation.data ?? runMutation.data;
  const pendingHitl =
    lastResult && lastResult.role_status === "waiting_human" && lastResult.hitl_pending
      ? lastResult
      : null;

  if (permissionsQuery.isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.stateBox}>
          <Loader2 className={styles.spin} size={18} /> Загрузка прав доступа…
        </div>
      </div>
    );
  }

  if (permissionsQuery.isError) {
    return (
      <div className={styles.page}>
        <div className={styles.forbidden}>
          <AlertTriangle size={18} /> Не удалось проверить права доступа.
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <div className={styles.forbidden}>
          <ShieldAlert size={18} />
          Этот KPI-дашборд доступен только сотруднику с соответствующей должностью.
        </div>
      </div>
    );
  }

  const data = dashboardQuery.data;

  return (
    <div className={styles.page}>
      {dashboardQuery.isLoading || !data ? (
        <div className={styles.stateBox}>
          <Loader2 className={styles.spin} size={18} /> Загрузка KPI…
        </div>
      ) : (
        <>
          <header className={styles.hero}>
            <div className={styles.eyebrow}>KPI ролевого агента · {data.agent.contour}</div>
            <h2>{data.agent.name}</h2>
            <div className={styles.heroFull}>{data.agent.name_full}</div>
            <div className={styles.chips}>
              <span className={`${styles.chip} ${styles.chipRole}`}>
                Должность: <b>{data.agent.position_role}</b>
              </span>
              <span className={styles.chip}>
                Автономность: <b>{data.agent.autonomy}</b>
              </span>
              <span className={styles.chip}>
                Реестр: <b>№{data.agent.registry_no}</b>
              </span>
              <span className={styles.chip}>
                Документ: <b>{data.agent.doc_ref}</b>
              </span>
            </div>
          </header>

          <div className={styles.runtime}>
            <div className={styles.runtimeCard}>
              <div className={styles.runtimeVal}>{data.runtime.total_runs}</div>
              <div className={styles.runtimeLabel}>Всего запусков</div>
            </div>
            <div className={styles.runtimeCard}>
              <div className={styles.runtimeVal}>{data.runtime.completed}</div>
              <div className={styles.runtimeLabel}>Завершено</div>
            </div>
            <div className={styles.runtimeCard}>
              <div className={styles.runtimeVal}>{data.runtime.with_issues}</div>
              <div className={styles.runtimeLabel}>С замечаниями</div>
            </div>
            <div className={styles.runtimeCard}>
              <div className={styles.runtimeVal}>{data.runtime.needs_input}</div>
              <div className={styles.runtimeLabel}>Нужны данные</div>
            </div>
            <div className={styles.runtimeCard}>
              <div className={styles.runtimeVal}>{data.runtime.waiting_human}</div>
              <div className={styles.runtimeLabel}>На согласовании</div>
            </div>
            <div className={styles.runtimeCard}>
              <div className={styles.runtimeVal}>{data.runtime.avg_latency_ms} мс</div>
              <div className={styles.runtimeLabel}>Среднее время</div>
            </div>
          </div>

          {pendingHitl ? (
            <div className={styles.hitlPanel}>
              <div className={styles.hitlHead}>
                <UserCheck size={18} />
                <div>
                  <strong>Требуется решение человека (HITL)</strong>
                  <div className={styles.hint}>
                    {pendingHitl.hitl_pending?.action
                      ? `Действие: ${pendingHitl.hitl_pending.action}`
                      : "Агент приостановлен до подтверждения."}
                    {pendingHitl.hitl_pending?.approver_role
                      ? ` · подтверждает: ${pendingHitl.hitl_pending.approver_role}`
                      : ""}
                  </div>
                </div>
              </div>
              <div className={styles.hitlActions}>
                <HitlDecisionCard result={pendingHitl} />
                <button
                  className={styles.runBtn}
                  disabled={resumeMutation.isPending}
                  onClick={() =>
                    resumeMutation.mutate({
                      thread_id: pendingHitl.thread_id,
                      resolution: "approved",
                      passed: true
                    })
                  }
                  type="button"
                >
                  {resumeMutation.isPending ? (
                    <Loader2 className={styles.spin} size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Подтвердить
                </button>
                <button
                  className={styles.rejectBtn}
                  disabled={resumeMutation.isPending}
                  onClick={() =>
                    resumeMutation.mutate({
                      thread_id: pendingHitl.thread_id,
                      resolution: "rejected",
                      passed: false
                    })
                  }
                  type="button"
                >
                  Отклонить
                </button>
              </div>
            </div>
          ) : null}

          <div className={styles.sectionHead}>
            <h3>
              Показатели KPI · достигнуто {data.summary.achieved} из {data.summary.total}
              {data.summary.achievement_rate !== null
                ? ` (${data.summary.achievement_rate}%)`
                : ""}
              {data.summary.pending > 0 ? ` · ожидают данных: ${data.summary.pending}` : ""}
            </h3>
            <button
              className={styles.runBtn}
              disabled={runMutation.isPending}
              onClick={() =>
                runMutation.mutate({ task_type: DEFAULT_TASK_TYPE[slug] || "" })
              }
              type="button"
            >
              {runMutation.isPending ? (
                <Loader2 className={styles.spin} size={16} />
              ) : (
                <Play size={16} />
              )}
              Запустить агента
            </button>
          </div>

          <div className={styles.grid}>
            {data.kpi.map((row) => {
              const hasValue = row.value !== null && row.value !== undefined;
              const showBar = hasValue && row.unit === "percent";
              const barWidth = showBar ? Math.max(0, Math.min(100, Number(row.value))) : 0;
              const fillTone =
                row.status === "achieved"
                  ? styles.ok
                  : row.status === "warn"
                    ? styles.warn
                    : styles.bad;
              return (
                <article className={`${styles.card} ${cardTone(row.status)}`} key={row.id}>
                  <div className={styles.cardTop}>
                    <span className={styles.kid}>{row.id}</span>
                    <div className={styles.badges}>
                      {row.blocking ? (
                        <span className={`${styles.badge} ${styles.badgeBlocking}`}>блокирующий</span>
                      ) : null}
                      {row.guardrail ? (
                        <span className={`${styles.badge} ${styles.badgeGuardrail}`}>guardrail</span>
                      ) : null}
                    </div>
                  </div>
                  <h4 className={styles.kname}>{row.name}</h4>
                  <div className={styles.valrow}>
                    <span className={hasValue ? styles.val : styles.valMuted}>
                      {formatValue(row)}
                    </span>
                    <span className={styles.target}>цель {row.target}</span>
                  </div>
                  {showBar ? (
                    <div className={styles.track}>
                      <div
                        className={`${styles.fill} ${fillTone}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  ) : (
                    <div style={{ height: 10 }} />
                  )}
                  <StatusPill row={row} />
                  <div className={styles.source}>
                    Источник: {row.source}
                    {row.data_source === "onec" ? " · сверка с 1С (подключается)" : ""}
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.footerNote}>
            <CheckCircle2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            Значения KPI вычисляются из реальной истории запусков агента. Показатели,
            требующие сверки с 1С/ОПЭ, отмечены «Ожидает интеграции 1С» — они наполнятся
            после подключения источников 1С без изменения дашборда.
            {data.generated_at ? (
              <>
                {" "}
                <CircleAlert size={13} style={{ verticalAlign: "-2px", margin: "0 4px" }} />
                Обновлено: {new Date(data.generated_at).toLocaleString("ru-RU")}.
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
