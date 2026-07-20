import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type {
  ProductionPreparationEngineerCaseDetail,
  ProductionPreparationEngineerOutput
} from "@/types/procurement";
import { caseTitle, formatDate, formatDateTime } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  detail: ProductionPreparationEngineerCaseDetail;
};

function quantity(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("ru-RU", { maximumFractionDigits: 3 })
    : String(value);
}

function outputFrom(detail: ProductionPreparationEngineerCaseDetail) {
  const latest = detail.latest_result?.output_data;
  const stored = detail.case_metadata?.production_preparation_engineer_output;
  return (latest || stored || null) as ProductionPreparationEngineerOutput | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  fully_covered: "Полностью обеспечено",
  transfer_required: "Требуется перемещение",
  partially_covered: "Обеспечено частично",
  covered_by_open_order: "Покрыто открытым заказом",
  procurement_required: "Требуется закупка",
  critical_shortage: "Критический дефицит",
  clarification_required: "Требуется уточнение"
};

const CRITICALITY_LABELS: Record<string, string> = {
  normal: "Обычная",
  high: "Высокая",
  critical: "Критическая"
};

export function ProductionPreparationEngineerResultPanel({ detail }: Props) {
  const output = outputFrom(detail);
  const positions = output?.positions ?? [];
  const exclusions = positions.flatMap((position) =>
    position.excluded_supply.map((item) => ({ position, item }))
  );
  const deficits = positions.filter((position) => Number(position.net_requirement) > 0);
  const critical = positions.filter((position) => position.critical_impact);
  const missingData = Array.from(
    new Set([
      ...(output?.missing_data ?? []),
      ...(output?.validation_issues ?? []).map((item) => item.message),
      ...(output?.excluded_capabilities ?? [])
    ])
  );
  const source = output?.case;

  return (
    <section className={styles.detailsPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>{caseTitle(detail)}</h3>
          <p>Расчёт потребности и обеспеченности ТМЦ</p>
        </div>
        <span className={detail.source_active ? styles.syncBadgeOk : styles.syncBadge}>
          {detail.source_active ? "Основание актуально" : "Основание неактуально"}
        </span>
      </div>

      {!output ? (
        <div className={styles.emptyState}>
          Результат ещё не сформирован. Кейс находится в очереди или ожидает данные 1С.
        </div>
      ) : (
        <div className={styles.resultStatus}>
          {missingData.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <div>
            <strong>{output.summary}</strong>
            <span>{output.recommended_next_step}</span>
          </div>
        </div>
      )}

      <div>
        <h4>Входные сведения</h4>
        <div className={styles.detailGrid}>
          <div><span>Кейс</span><strong>{source?.case_number || caseTitle(detail)}</strong></div>
          <div><span>Документ 1С</span><strong>{source?.source_number || detail.source_number || "—"}</strong></div>
          <div><span>Дата документа</span><strong>{formatDateTime(source?.source_date || detail.source_date)}</strong></div>
          <div><span>Статус документа</span><strong>{source?.source_status || detail.source_status || "—"}</strong></div>
          <div><span>Производственный заказ</span><strong>{source?.production_order_number || source?.production_order_1c_ref || "Не определён"}</strong></div>
          <div><span>Подразделение</span><strong>{source?.department_name || detail.department_name || "—"}</strong></div>
          <div><span>Склад / кладовая</span><strong>{source?.warehouse_name || detail.warehouse_name || "Не указан"}</strong></div>
          <div><span>Требуемая дата</span><strong>{formatDate(source?.required_date || detail.required_date)}</strong></div>
          <div><span>Последняя синхронизация с 1С</span><strong>{formatDateTime(source?.source_synced_at || detail.source_synced_at)}</strong></div>
          <div><span>Расчёт выполнен</span><strong>{formatDateTime(output?.calculated_at)}</strong></div>
        </div>
      </div>

      <div>
        <h4>Выбранные ресурсные спецификации</h4>
        {output?.specifications.length ? (
          <div className={styles.resultCards}>
            {output.specifications.map((specification) => (
              <article className={styles.resultCard} key={specification.specification_id}>
                <strong>{specification.name}</strong>
                <span>Статус: {specification.status}</span>
                <small>Версия: {specification.version || "—"} · Материалов: {specification.materials.length}</small>
                <small>Действует: {formatDate(specification.valid_from)} — {formatDate(specification.valid_to)}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>Действующая спецификация не выбрана.</div>
        )}
      </div>

      <div>
        <h4>Расчёт по позициям</h4>
        {positions.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Номенклатура / характеристика</th>
                  <th>Ед.</th>
                  <th>Заказ / этап</th>
                  <th>Изделий</th>
                  <th>Норма</th>
                  <th>Потери, %</th>
                  <th>Валовая потребность</th>
                  <th>Свободный остаток</th>
                  <th>Другие склады</th>
                  <th>Поступления</th>
                  <th>Всего обеспечено</th>
                  <th>Чистая потребность</th>
                  <th>Требуемая дата</th>
                  <th>Критичность</th>
                  <th>Способ покрытия</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.line_id}>
                    <td>
                      <strong>{position.nomenclature_name}</strong>
                      <small>{position.characteristic_name || "Без характеристики"}</small>
                    </td>
                    <td>{position.unit}</td>
                    <td>{position.production_order || "—"}<small>{position.production_stage || "Этап не указан"}</small></td>
                    <td>{quantity(position.product_quantity)}</td>
                    <td>{quantity(position.consumption_rate)}</td>
                    <td>{quantity(position.technological_loss_percent)}</td>
                    <td>{quantity(position.gross_requirement)}</td>
                    <td>{quantity(position.free_stock)}</td>
                    <td>{quantity(position.available_other_warehouses)}</td>
                    <td>{quantity(position.confirmed_arrivals)}</td>
                    <td>{quantity(position.total_available_supply)}</td>
                    <td>{quantity(position.net_requirement)}</td>
                    <td>{formatDate(position.required_date)}</td>
                    <td>{CRITICALITY_LABELS[position.criticality] || position.criticality}</td>
                    <td>
                      {OUTCOME_LABELS[position.outcome] || position.outcome}
                      <small>{position.coverage_method}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>Подтверждённый построчный расчёт отсутствует.</div>
        )}
      </div>

      <div className={styles.resultColumns}>
        <div>
          <h4>Исключённые источники</h4>
          {exclusions.length ? (
            <ul className={styles.resultList}>
              {exclusions.map(({ position, item }) => (
                <li key={`${position.line_id}-${item.supply_id}`}>
                  <strong>{position.nomenclature_name}: {quantity(item.quantity)} {position.unit}</strong>
                  <span>{item.reason} · {item.source_type}</span>
                </li>
              ))}
            </ul>
          ) : <div className={styles.emptyState}>Исключённых источников нет.</div>}
        </div>
        <div>
          <h4>Дефициты</h4>
          {deficits.length ? (
            <ul className={styles.resultList}>
              {deficits.map((position) => (
                <li key={position.line_id}>
                  <strong>{position.nomenclature_name}: {quantity(position.net_requirement)} {position.unit}</strong>
                  <span>{position.recommendation}</span>
                </li>
              ))}
            </ul>
          ) : <div className={styles.emptyState}>Дефицитов нет.</div>}
        </div>
      </div>

      <div>
        <h4>Критическое влияние</h4>
        {critical.length ? (
          <ul className={styles.missingDataList}>
            {critical.map((position) => (
              <li key={position.line_id}>
                <strong>{position.nomenclature_name}</strong>: {position.critical_impact?.consequence}
                {" · "}приоритет {position.critical_impact?.recommended_priority}
                {position.critical_impact?.possible_stop_date
                  ? ` · возможная остановка ${formatDate(position.critical_impact.possible_stop_date)}`
                  : ""}
              </li>
            ))}
          </ul>
        ) : <div className={styles.emptyState}>Критическое влияние не подтверждено.</div>}
      </div>

      <div>
        <h4>Уточнения и недоступные данные</h4>
        {missingData.length ? (
          <ul className={styles.missingDataList}>
            {missingData.map((message) => <li key={message}>{message}</li>)}
          </ul>
        ) : <div className={styles.emptyState}>Уточнения не требуются.</div>}
      </div>
    </section>
  );
}
