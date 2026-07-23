import { PackageSearch, ShoppingCart } from "lucide-react";
import type { ProcurementCaseDetail } from "@/types/procurement";
import { formatDate } from "@/utils/procurementDashboard";
import {
  deficitTone,
  parallelSupplierOrderRows,
  uncoveredPickerPositions,
  withUnit
} from "./parallelProcurement";
import styles from "../ProcurementAgent.module.css";

type Props = {
  detail: ProcurementCaseDetail;
};

export function ParallelProcurementPanels({ detail }: Props) {
  const uncovered = uncoveredPickerPositions(detail);
  const orders = parallelSupplierOrderRows(detail);

  return (
    <div className={styles.parallelPanels}>
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
                    <td className={deficitTone(position.confirmed_deficit) ? styles.metricDeficit : ""}>
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

      <section className={styles.parallelPanel}>
        <div className={styles.parallelPanelHeader}>
          <div>
            <ShoppingCart size={16} />
            <strong>Менеджер по закупкам</strong>
          </div>
          <span>{orders.length} в заказах поставщику</span>
        </div>
        <p className={styles.parallelPanelHint}>
          Позиции, по которым уже ведётся закупка: номер заказа поставщику, количество, поставщик и
          дата прибытия.
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
                      <strong className={styles.parallelOrderNumber}>{row.supplier_order_number}</strong>
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
    </div>
  );
}
