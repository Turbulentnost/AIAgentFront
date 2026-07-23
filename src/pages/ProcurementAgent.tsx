import { useEffect, useMemo } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  useProcurementCase,
  useProcurementDashboard,
  useProcurementPermissions,
  useRefreshProcurementSources
} from "@/hooks/useProcurementDashboard";
import type { ProcurementDashboardView, ProcurementSourceGroup } from "@/types/procurement";
import { SYNC_STATUS_LABELS } from "@/utils/procurementDashboard";
import { CaseDetailPanel } from "./procurement/CaseDetailPanel";
import { CaseListPanel } from "./procurement/CaseListPanel";
import { ProcurementModeSwitch } from "./procurement/ProcurementModeSwitch";
import styles from "./ProcurementAgent.module.css";

export default function ProcurementAgent() {
  const permissionsQuery = useProcurementPermissions();
  const canAccess = permissionsQuery.data?.can_access_orchestrator ?? false;
  const refreshMutation = useRefreshProcurementSources();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = searchParams.get("mode") === "cases" ? "cases" : "bases";
  const caseView: ProcurementDashboardView =
    searchParams.get("view") === "archive" ? "archive" : mode === "cases" ? "processing" : "active";
  const selectedSource = searchParams.get("source") || "";
  const selectedCaseId = searchParams.get("case") || "";

  const dashboardView: ProcurementDashboardView =
    mode === "bases" ? "active" : caseView === "archive" ? "archive" : "processing";
  const activeDashboardQuery = useProcurementDashboard(canAccess, "active");
  const processingDashboardQuery = useProcurementDashboard(canAccess, "processing");
  const archiveDashboardQuery = useProcurementDashboard(canAccess, "archive");
  const dashboardQuery =
    dashboardView === "archive"
      ? archiveDashboardQuery
      : dashboardView === "processing"
        ? processingDashboardQuery
        : activeDashboardQuery;
  const countsQuery = activeDashboardQuery;

  const groups = dashboardQuery.data?.groups ?? [];
  const counts = dashboardQuery.data?.counts ??
    countsQuery.data?.counts ?? { active: 0, processing: 0, archive: 0 };
  const activeGroup: ProcurementSourceGroup | null =
    groups.find((group) => group.source_type === selectedSource) ?? groups[0] ?? null;
  const flatCases = useMemo(() => activeGroup?.cases ?? [], [activeGroup]);

  useEffect(() => {
    if (!selectedSource && groups[0]) {
      const next = new URLSearchParams(searchParams);
      next.set("source", groups[0].source_type);
      setSearchParams(next, { replace: true });
    }
  }, [groups, searchParams, selectedSource, setSearchParams]);

  useEffect(() => {
    if (!flatCases.length) {
      if (selectedCaseId) {
        const next = new URLSearchParams(searchParams);
        next.delete("case");
        setSearchParams(next, { replace: true });
      }
      return;
    }
    if (!flatCases.some((item) => item.id === selectedCaseId)) {
      const next = new URLSearchParams(searchParams);
      next.set("case", flatCases[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [flatCases, searchParams, selectedCaseId, setSearchParams]);

  const detailQuery = useProcurementCase(selectedCaseId || null, canAccess);
  const detail = detailQuery.data;
  const detailSourceLabel =
    groups.find((group) => group.source_type === detail?.source_type)?.label_ru ??
    countsQuery.data?.groups.find((group) => group.source_type === detail?.source_type)?.label_ru ??
    "—";

  const stats = useMemo(
    () => [
      { label: "Актуальные основания", value: counts.active },
      { label: "Кейсы в работе", value: counts.processing },
      { label: "Архив", value: counts.archive },
      {
        label: "Недоступные источники",
        value: (countsQuery.data?.groups ?? groups).filter((group) => !group.available).length
      }
    ],
    [counts, countsQuery.data?.groups, groups]
  );

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next);
  };

  const searchCaseByNumber = (rawQuery: string): boolean => {
    const query = rawQuery.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, "");
    if (!query) return false;
    const normalize = (value?: string | null) =>
      value?.toLocaleLowerCase("ru-RU").replace(/\s+/g, "") ?? "";
    const findCase = (items: typeof flatCases) =>
      items.find((item) => normalize(item.source_number) === query) ||
      items.find(
        (item) =>
          normalize(item.source_number).includes(query) ||
          normalize(item.source_1c_ref).includes(query)
      );
    const processingCases =
      processingDashboardQuery.data?.groups.flatMap((group) => group.cases) ?? [];
    const archiveCases = archiveDashboardQuery.data?.groups.flatMap((group) => group.cases) ?? [];
    const processingCase = findCase(processingCases);
    if (processingCase) {
      updateParams({
        mode: "cases",
        view: "processing",
        source: processingCase.source_type,
        case: processingCase.id
      });
      return true;
    }
    const archiveCase = findCase(archiveCases);
    if (archiveCase) {
      updateParams({
        mode: "cases",
        view: "archive",
        source: archiveCase.source_type,
        case: archiveCase.id
      });
      return true;
    }
    return false;
  };

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
          <p>
            Актуальные основания и кейсы в обработке синхронизируются каждые 30 минут · только
            чтение
          </p>
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

      <ProcurementModeSwitch
        activeCount={counts.active}
        archiveCount={counts.archive}
        caseView={caseView === "archive" ? "archive" : "processing"}
        mode={mode}
        onCaseViewChange={(view) =>
          updateParams({
            mode: "cases",
            view: view === "archive" ? "archive" : "processing",
            case: null
          })
        }
        onModeChange={(nextMode) =>
          updateParams({
            mode: nextMode === "cases" ? "cases" : null,
            view: nextMode === "cases" ? "processing" : null,
            case: null,
            source: selectedSource || null
          })
        }
        onSearch={searchCaseByNumber}
        processingCount={counts.processing}
        searchLoading={processingDashboardQuery.isLoading || archiveDashboardQuery.isLoading}
      />

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
            onClick={() => updateParams({ source: group.source_type, case: null })}
            type="button"
          >
            <span>{group.label_ru}</span>
            <strong>{group.cases_count}</strong>
            {mode === "bases" && !group.available ? <em>недоступно</em> : null}
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        {mode === "bases" ? (
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
                <Loader2 className={styles.spin} size={16} /> Загрузка оснований...
              </div>
            ) : null}
            {flatCases.length === 0 && !dashboardQuery.isLoading ? (
              <div className={styles.emptyState}>Сейчас нет актуальных заказов этого типа.</div>
            ) : null}
            <div className={styles.caseList}>
              {flatCases.map((item) => (
                <button
                  className={item.id === selectedCaseId ? styles.caseItemActive : styles.caseItem}
                  key={item.id}
                  onClick={() => updateParams({ case: item.id })}
                  type="button"
                >
                  <div className={styles.caseItemTop}>
                    <strong>{item.source_number || item.source_1c_ref.slice(0, 8)}</strong>
                    <span>{item.positions_count} поз.</span>
                  </div>
                  <div className={styles.caseItemMeta}>
                    <span>Актуально в 1С</span>
                    <span>
                      {item.source_date
                        ? new Date(item.source_date).toLocaleString("ru-RU", {
                            timeZone: "Europe/Moscow"
                          })
                        : "—"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <CaseListPanel
            cases={flatCases}
            emptyText={
              caseView === "archive"
                ? "В архиве нет кейсов этого основания."
                : "Нет кейсов в обработке по этому основанию."
            }
            onSelect={(caseId) => updateParams({ case: caseId })}
            selectedCaseId={selectedCaseId}
            showArchiveMeta={caseView === "archive"}
            title={
              caseView === "archive"
                ? `Архив · ${activeGroup?.label_ru ?? "основание"}`
                : `В работе · ${activeGroup?.label_ru ?? "основание"}`
            }
          />
        )}

        {!selectedCaseId ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>Выберите карточку.</div>
          </section>
        ) : detailQuery.isLoading ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>
              <Loader2 className={styles.spin} size={16} /> Загрузка карточки...
            </div>
          </section>
        ) : !detail ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>Карточка не найдена.</div>
          </section>
        ) : (
          <CaseDetailPanel detail={detail} mode={mode} sourceLabel={detailSourceLabel} />
        )}
      </div>
    </div>
  );
}
