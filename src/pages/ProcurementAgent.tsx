import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import {
  useProcurementCase,
  useProcurementDashboard,
  useProcurementPermissions,
  useRefreshProcurementSources
} from "@/hooks/useProcurementDashboard";
import type { ProcurementCaseSummary, ProcurementSourceGroup } from "@/types/procurement";
import styles from "./ProcurementAgent.module.css";

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  data_check: "Проверка данных",
  coverage_check: "Проверка покрытия",
  human_required: "Нужен человек",
  blocked: "Заблокирован",
  closed: "Закрыт",
  failed: "Ошибка"
};
const SYNC_STATUS_LABELS: Record<string, string> = {
  available: "доступен",
  capability_unavailable: "недоступен",
  error: "ошибка чтения",
  unknown: "не проверен"
};

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

function caseTitle(item: ProcurementCaseSummary): string {
  return item.source_number || item.source_1c_ref.slice(0, 8);
}

export default function ProcurementAgent() {
  const permissionsQuery = useProcurementPermissions();
  const canAccess = permissionsQuery.data?.can_access_orchestrator ?? false;
  const dashboardQuery = useProcurementDashboard(canAccess);
  const refreshMutation = useRefreshProcurementSources();
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");

  const groups = dashboardQuery.data?.groups ?? [];
  const activeGroup: ProcurementSourceGroup | null =
    groups.find((group) => group.source_type === selectedSource) ?? groups[0] ?? null;

  useEffect(() => {
    if (!selectedSource && groups[0]) {
      setSelectedSource(groups[0].source_type);
    }
  }, [groups, selectedSource]);

  useEffect(() => {
    if (!activeGroup) {
      setSelectedCaseId("");
      return;
    }
    if (!activeGroup.cases.some((item) => item.id === selectedCaseId)) {
      setSelectedCaseId(activeGroup.cases[0]?.id ?? "");
    }
  }, [activeGroup, selectedCaseId]);

  const detailQuery = useProcurementCase(selectedCaseId || null, canAccess);
  const detail = detailQuery.data;
  const detailSourceLabel =
    groups.find((group) => group.source_type === detail?.source_type)?.label_ru ?? "—";

  const stats = useMemo(() => {
    const allCases = groups.flatMap((group) => group.cases);
    return [
      { label: "Неотработанные кейсы", value: allCases.length },
      {
        label: "Нужен человек",
        value: allCases.filter((item) => item.status === "human_required").length
      },
      {
        label: "В работе",
        value: allCases.filter((item) =>
          ["new", "data_check", "coverage_check"].includes(item.status)
        ).length
      },
      {
        label: "Недоступные источники",
        value: groups.filter((group) => !group.available).length
      }
    ];
  }, [groups]);

  if (permissionsQuery.isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <Loader2 className={styles.spin} size={18} /> Загрузка прав доступа...
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <div className={styles.forbidden}>
          <AlertTriangle size={18} />
          Оркестратор закупок доступен только администратору системы.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Оркестратор закупок</h2>
          <p>Polling оснований 1С каждые 5 минут · Level 0 · только чтение</p>
        </div>
        <button
          className={styles.refreshButton}
          disabled={refreshMutation.isPending}
          onClick={() => refreshMutation.mutate()}
          type="button"
        >
          {refreshMutation.isPending ? <Loader2 className={styles.spin} size={16} /> : <RefreshCw size={16} />}
          Обновить сейчас
        </button>
      </div>

      <div className={styles.statsRow}>
        {stats.map((stat) => (
          <div className={styles.statCard} key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.sourceTabs}>
        {groups.map((group) => (
          <button
            className={
              group.source_type === activeGroup?.source_type
                ? styles.sourceTabActive
                : styles.sourceTab
            }
            key={group.source_type}
            onClick={() => setSelectedSource(group.source_type)}
            type="button"
          >
            <span>{group.label_ru}</span>
            <strong>{group.cases_count}</strong>
            {!group.available ? <em>недоступно</em> : null}
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <section className={styles.queuePanel}>
          <div className={styles.panelHeader}>
            <h3>{activeGroup?.label_ru ?? "Основания"}</h3>
            {activeGroup?.sync ? (
              <span className={styles.syncBadge}>
                {SYNC_STATUS_LABELS[activeGroup.sync.capability_status] ??
                  activeGroup.sync.capability_status}
              </span>
            ) : null}
          </div>

          {!activeGroup?.available ? (
            <div className={styles.warningBox}>
              <AlertTriangle size={16} />
              {activeGroup?.unavailable_reason || "Источник недоступен в OData."}
            </div>
          ) : null}
          {activeGroup?.sync.last_error ? (
            <div className={styles.warningBox}>
              <AlertTriangle size={16} />
              {activeGroup.sync.last_error}
            </div>
          ) : null}

          {dashboardQuery.isLoading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.spin} size={16} /> Загрузка кейсов...
            </div>
          ) : null}

          {!dashboardQuery.isLoading && (activeGroup?.cases.length ?? 0) === 0 ? (
            <div className={styles.emptyState}>Пока нет карточек по этому основанию.</div>
          ) : null}

          <div className={styles.caseList}>
            {(activeGroup?.cases ?? []).map((item) => (
              <button
                className={item.id === selectedCaseId ? styles.caseItemActive : styles.caseItem}
                key={item.id}
                onClick={() => setSelectedCaseId(item.id)}
                type="button"
              >
                <div className={styles.caseItemTop}>
                  <strong>{caseTitle(item)}</strong>
                  <span>{STATUS_LABELS[item.status] ?? item.status}</span>
                </div>
                <div className={styles.caseItemMeta}>
                  <span>{item.positions_count} позиций</span>
                  <span>{formatDateTime(item.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.detailsPanel}>
          {!selectedCaseId ? (
            <div className={styles.emptyState}>Выберите карточку кейса.</div>
          ) : detailQuery.isLoading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.spin} size={16} /> Загрузка карточки...
            </div>
          ) : !detail ? (
            <div className={styles.emptyState}>Карточка не найдена.</div>
          ) : (
            <>
              <div className={styles.panelHeader}>
                <div>
                  <h3>{caseTitle(detail)}</h3>
                  <p>{STATUS_LABELS[detail.status] ?? detail.status}</p>
                </div>
                <span className={styles.syncBadge}>{detail.control_point || "KT1"}</span>
              </div>

              <div className={styles.detailGrid}>
                <div><span>Текущий статус</span><strong>{STATUS_LABELS[detail.status] ?? detail.status}</strong></div>
                <div><span>Кейс находится на агенте</span><strong>{detail.current_agent_name || "Оркестратор закупок"}</strong></div>
                <div><span>Основание</span><strong>{detailSourceLabel}</strong></div>
                <div><span>Номер документа</span><strong>{detail.source_number || "—"}</strong></div>
                <div><span>Дата документа</span><strong>{formatDateTime(detail.source_date)}</strong></div>
                <div><span>Статус документа 1С</span><strong>{detail.source_status || "—"}</strong></div>
                <div><span>Инициатор</span><strong>{detail.initiator_name || "Название не получено"}</strong></div>
                <div><span>Подразделение</span><strong>{detail.department_name || "Название не получено"}</strong></div>
                <div><span>Склад</span><strong>{detail.warehouse_name || "Название не получено"}</strong></div>
                <div><span>Требуемая дата</span><strong>{formatDateTime(detail.required_date)}</strong></div>
              </div>

              {detail.summary || detail.deviation_summary ? (
                <div className={styles.warningBox}>
                  {detail.summary || detail.deviation_summary}
                </div>
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
                        <th>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.positions.map((position) => (
                        <tr key={position.id}>
                          <td>{position.line_number}</td>
                          <td>
                            <div>{position.nomenclature_name || "Название не получено"}</div>
                          </td>
                          <td>{position.quantity}</td>
                          <td>{position.unit || "—"}</td>
                          <td>{formatDateTime(position.required_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </>
          )}
        </section>
      </div>
    </div>
  );
}
