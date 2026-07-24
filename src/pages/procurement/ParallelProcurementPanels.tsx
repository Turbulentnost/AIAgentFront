import { ClipboardCheck, PackageSearch, ShoppingCart } from "lucide-react";
import type { ProcurementCaseDetail } from "@/types/procurement";
import { formatDate } from "@/utils/procurementDashboard";
import {
  deficitTone,
  detectParallelProcurement,
  parallelSupplierOrderRows,
  QUALITY_ENGINEER_AGENT_ID,
  uncoveredPickerPositions,
  withUnit
} from "./parallelProcurement";
import styles from "../ProcurementAgent.module.css";

type Props = {
  detail: ProcurementCaseDetail;
  mode?: "parallel" | "purchase_manager" | "otk";
};

type OtkPresentationRow = {
  id: string;
  purchase_order: string;
  supplier: string;
  invoice_number: string;
  status: string;
  lines_count: number;
};

function otkPresentationRows(detail: ProcurementCaseDetail): OtkPresentationRow[] {
  const raw = detail.case_metadata?.otk_presentations;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item, index) => ({
      id: String(item.id || `otk-${index}`),
      purchase_order: String(item.purchase_order || "—"),
      supplier: String(item.supplier || item.counterparty || "—"),
      invoice_number: String(item.invoice_number || "—"),
      status: String(item.status || "queued"),
      lines_count: Array.isArray(item.lines) ? item.lines.length : 0
    }));
}

export function ParallelProcurementPanels({ detail, mode = "parallel" }: Props) {
  const uncovered = uncoveredPickerPositions(detail);
  const orders = parallelSupplierOrderRows(detail);
  const presentations = otkPresentationRows(detail);
  const parallel = detectParallelProcurement(detail);
  const otkBranch =
    parallel.branches.find((branch) => branch.agentId === QUALITY_ENGINEER_AGENT_ID) ||
    (parallel.continuation?.agentId === QUALITY_ENGINEER_AGENT_ID
      ? parallel.continuation
      : null);
  const showPicker =
    mode === "parallel" &&
    parallel.branches.some((branch) => branch.id === "branch_picker");
  const showManager =
    mode !== "otk" ||
    parallel.branches.some((branch) => branch.id === "branch_purchase_manager") ||
    parallel.continuation?.agentId === "purchase_manager_agent";
  const showOtk =
    Boolean(otkBranch) ||
    mode === "otk" ||
    presentations.length > 0 ||
    Boolean(detail.case_metadata?.otk_started_at);

  const tmc = detail.case_metadata?.tmc_presentation_coverage as
    | Record<string, unknown>
    | undefined;
  const tmcStatus = String(tmc?.status || "");
  const covered = Number(tmc?.covered_orders ?? presentations.length);
  const total = Number(tmc?.orders_count ?? tmc?.total_orders ?? 0);

  return (
    <div className={styles.parallelPanels}>
      {showPicker ? (
        <section className={styles.parallelPanel}>
          <div className={styles.parallelPanelHeader}>
            <div>
              <PackageSearch size={16} />
              <strong>Кладовщик-комплектовщик</strong>
            </div>
            <span>{uncovered.length} без заказа поставщику</span>
          </div>
          <p className={styles.parallelPanelHint}>
            Номенклатуры, по которым заказ поставщику ещё не создан: потребность, доступность и
            дефицит из расчёта комплектовщика.
          </p>
          {uncovered.length ? (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Номенклатура</th>
                    <th>Потребность</th>
                    <th>Доступно</th>
                    <th>Дефицит</th>
                  </tr>
                </thead>
                <tbody>
                  {uncovered.map((position) => (
                    <tr key={position.line_id}>
                      <td>
                        <strong>{position.nomenclature_name}</strong>
                      </td>
                      <td>{withUnit(position.requested_quantity, position.unit)}</td>
                      <td className={styles.metricCovered}>
                        {withUnit(position.available_for_issue, position.unit)}
                      </td>
                      <td
                        className={
                          deficitTone(position.confirmed_deficit) ? styles.metricDeficit : ""
                        }
                      >
                        {withUnit(position.confirmed_deficit, position.unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              Все позиции уже покрыты заказами поставщику.
            </div>
          )}
        </section>
      ) : null}

      {showManager ? (
        <section className={styles.parallelPanel}>
          <div className={styles.parallelPanelHeader}>
            <div>
              <ShoppingCart size={16} />
              <strong>Менеджер по закупкам</strong>
            </div>
            <span>
              {tmcStatus === "partial"
                ? `Журнал ТМЦ ${covered}/${total || "?"} · не закрыт`
                : `${orders.length} в заказах поставщику`}
            </span>
          </div>
          <p className={styles.parallelPanelHint}>
            {tmcStatus === "partial"
              ? "Менеджер не завершается, пока по всем активным ЗП нет записи в журнале предъявления ТМЦ."
              : "Позиции, по которым уже ведётся закупка: номер заказа поставщику, количество, поставщик и дата прибытия."}
          </p>
          {orders.length ? (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>№ заказа поставщику</th>
                    <th>Номенклатура</th>
                    <th>Заказано</th>
                    <th>Поставщик</th>
                    <th>Дата прибытия</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <strong className={styles.parallelOrderNumber}>
                          {row.supplier_order_number}
                        </strong>
                      </td>
                      <td>{row.nomenclature_name}</td>
                      <td className={styles.metricCovered}>
                        {withUnit(row.quantity, row.unit)}
                      </td>
                      <td>{row.supplier_name}</td>
                      <td>{row.arrival_date ? formatDate(row.arrival_date) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>Связанные заказы поставщику пока не найдены.</div>
          )}
        </section>
      ) : null}

      {showOtk ? (
        <section className={styles.parallelPanel}>
          <div className={styles.parallelPanelHeader}>
            <div>
              <ClipboardCheck size={16} />
              <strong>Работник ОТК</strong>
            </div>
            <span>
              {tmcStatus === "partial"
                ? `Запущен · журнал ${covered}/${total || "?"}`
                : `${presentations.length} предъявлений`}
            </span>
          </div>
          <p className={styles.parallelPanelHint}>
            Агент ОТК стартует при первой записи журнала ТМЦ по любому ЗП кейса. Карточки — по
            найденным предъявлениям; полный handoff менеджера только когда журнал закрыт по всем ЗП.
          </p>
          {presentations.length ? (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Заказ поставщику</th>
                    <th>Поставщик</th>
                    <th>№ УПД / счёта</th>
                    <th>Строк</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {presentations.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong className={styles.parallelOrderNumber}>{row.purchase_order}</strong>
                      </td>
                      <td>{row.supplier}</td>
                      <td>{row.invoice_number}</td>
                      <td>{row.lines_count}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              Журнал ТМЦ ещё не дал карточек предъявления для этого кейса.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
