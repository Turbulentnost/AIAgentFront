import type { ProcurementCaseDetail } from "@/types/procurement";
import {
  caseTitle,
  formatDate,
  formatDateTime,
  formatQuantity,
  sourceActiveLabel,
  AGENT_WAIT_LABELS,
  STATUS_LABELS
} from "@/utils/procurementDashboard";
import { AgentTimeline } from "./AgentTimeline";
import { RouteStagesBar } from "./RouteStagesBar";
import styles from "../ProcurementAgent.module.css";

type Props = {
  detail: ProcurementCaseDetail;
  sourceLabel: string;
  mode: "bases" | "cases";
};

export function CaseDetailPanel({ detail, sourceLabel, mode }: Props) {
  const currentState = detail.current_state;
  return (
    <section className={styles.detailsPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>{caseTitle(detail)}</h3>
          <p>{sourceLabel}</p>
        </div>
        <span className={detail.source_active ? styles.syncBadgeOk : styles.syncBadge}>
          {sourceActiveLabel(detail)}
        </span>
      </div>

      <div className={styles.detailGrid}>
        <div>
          <span>Текущий статус</span>
          <strong>{STATUS_LABELS[detail.status] ?? detail.status}</strong>
        </div>
        <div>
          <span>Исполнитель</span>
          <strong>
            {currentState?.current_agent_label ||
              detail.current_agent_name ||
              "Оркестратор закупок"}
          </strong>
        </div>
        {currentState?.wait_status ? (
          <div>
            <span>Состояние агента</span>
            <strong>
              {AGENT_WAIT_LABELS[currentState.wait_status] || currentState.wait_status}
            </strong>
          </div>
        ) : null}
        <div>
          <span>Основание</span>
          <strong>{sourceLabel}</strong>
        </div>
        <div>
          <span>Номер документа</span>
          <strong>{detail.source_number || "—"}</strong>
        </div>
        <div>
          <span>Дата документа</span>
          <strong>{formatDateTime(detail.source_date)}</strong>
        </div>
        <div>
          <span>Статус документа 1С</span>
          <strong>{detail.source_status || "—"}</strong>
        </div>
        <div>
          <span>Последняя синхронизация с 1С</span>
          <strong>{formatDateTime(detail.source_synced_at)}</strong>
        </div>
        <div>
          <span>Инициатор</span>
          <strong>{detail.initiator_name || "Название не получено"}</strong>
        </div>
        <div>
          <span>Подразделение</span>
          <strong>{detail.department_name || "Название не получено"}</strong>
        </div>
        <div>
          <span>Склад</span>
          <strong>{detail.warehouse_name || "Название не получено"}</strong>
        </div>
        <div>
          <span>Общая желаемая дата поставки</span>
          <strong>{formatDate(detail.required_date)}</strong>
        </div>
        {detail.closed_reason_label ? (
          <div>
            <span>Причина архива</span>
            <strong>{detail.closed_reason_label}</strong>
          </div>
        ) : null}
      </div>

      {mode === "cases" ? (
        <>
          <RouteStagesBar stages={detail.route_stages || []} />
          <div className={styles.caseBodySplit}>
            <div>
              <h4>Ход кейса</h4>
              <AgentTimeline entries={detail.timeline || []} />
            </div>
            <aside className={styles.stateCard}>
              <h4>Текущее состояние</h4>
              <div>
                <span>Этап</span>
                <strong>{currentState?.control_point || detail.control_point || "basis"}</strong>
              </div>
              <div>
                <span>Статус</span>
                <strong>{STATUS_LABELS[detail.status] ?? detail.status}</strong>
              </div>
              {currentState?.task_status ? (
                <div>
                  <span>Статус задачи агента</span>
                  <strong>
                    {AGENT_WAIT_LABELS[currentState.wait_status || ""] ||
                      currentState.task_status}
                  </strong>
                </div>
              ) : null}
              <div>
                <span>Контроль основания</span>
                <strong>{detail.source_active ? "К обеспечению" : "Не актуально"}</strong>
              </div>
              <p>
                {currentState?.summary ||
                  currentState?.wait_reason ||
                  detail.summary ||
                  "Основание и кейс синхронизируются каждые 30 минут. При смене действия или отмене кейс уходит в архив."}
              </p>
            </aside>
          </div>
        </>
      ) : null}

      <div>
        <h4>Позиции ТМЦ</h4>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Номенклатура</th>
                <th>Кол-во</th>
                <th>Ед.</th>
                <th>Поставить к дате</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {detail.positions.map((position) => (
                <tr key={position.id}>
                  <td>{position.line_number}</td>
                  <td>
                    <div>{position.nomenclature_name || "Название не получено"}</div>
                  </td>
                  <td>{formatQuantity(position.quantity)}</td>
                  <td>{position.unit || "—"}</td>
                  <td>{formatDate(position.required_date || detail.required_date)}</td>
                  <td>{position.supply_action || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
