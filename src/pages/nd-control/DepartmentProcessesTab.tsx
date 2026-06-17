import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ndControlApi } from "@/api/endpoints";
import { FormSelect } from "@/components/form-controls";
import formStyles from "@/components/form-controls/form-controls.module.css";
import type { DepartmentProcessItem } from "@/types";
import NdControlDataTable from "./NdControlDataTable";
import styles from "../NdControlAgent.module.css";

type Props = {
  departmentId: string;
  search: string;
  isAnalysisRunning?: boolean;
  analysisProcessed?: number;
  analysisTotal?: number;
  selectedProcessId: string | null;
  onSelectProcess: (process: DepartmentProcessItem | null) => void;
  onConfirmProcessOwner: (process: DepartmentProcessItem) => void;
  onOpenRelations: (processId: string, processName: string) => void;
  onOpenDocuments?: () => void;
  onStartAnalysis?: () => void;
};

const FILTERS = [
  { id: "", label: "Все" },
  { id: "owner_confirmed", label: "Владелец подтверждён" },
  { id: "owner_unconfirmed", label: "Владелец не подтверждён" },
  { id: "needs_review", label: "Требует проверки" },
  { id: "high_confidence", label: "Высокая уверенность" },
  { id: "medium_confidence", label: "Средняя уверенность" },
  { id: "low_confidence", label: "Низкая уверенность" },
  { id: "has_relations", label: "Есть связи" },
  { id: "no_relations", label: "Нет связей" }
];

const SORTS = [
  { id: "name", label: "По названию" },
  { id: "confidence", label: "По уверенности" },
  { id: "relations_count", label: "По количеству связей" },
  { id: "documents_count", label: "По количеству документов" },
  { id: "needs_review", label: "Сначала требующие проверки" }
];

function ownerBadgeClass(status: string) {
  if (status === "Подтверждён") return styles.badgeOk;
  if (status === "Требует проверки") return styles.badgeReview;
  return styles.badgeNeutral;
}

function confidenceDotClass(level: string | null | undefined) {
  if (level === "high") return styles.confidenceDotHigh;
  if (level === "low") return styles.confidenceDotLow;
  return styles.confidenceDotMedium;
}

function shortText(value: string | null | undefined, max = 120) {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export default function DepartmentProcessesTab({
  departmentId,
  search,
  isAnalysisRunning,
  analysisProcessed,
  analysisTotal,
  selectedProcessId,
  onSelectProcess,
  onConfirmProcessOwner,
  onOpenRelations,
  onOpenDocuments,
  onStartAnalysis
}: Props) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("name");

  const processes = useQuery({
    queryKey: ["nd-control", "department-processes", departmentId, search, filter, sort],
    queryFn: () =>
      ndControlApi.listDepartmentProcesses(departmentId, {
        query: search || undefined,
        filter: filter || undefined,
        sort: sort || undefined,
        page: 1,
        size: 200
      }),
    enabled: Boolean(departmentId)
  });

  const items = processes.data?.items ?? [];

  useEffect(() => {
    if (!items.length) {
      onSelectProcess(null);
      return;
    }
    const currentInList = selectedProcessId
      ? items.find((item) => item.process_id === selectedProcessId)
      : null;
    if (currentInList) {
      onSelectProcess(currentInList);
      return;
    }
    onSelectProcess(items[0]);
  }, [items, selectedProcessId, onSelectProcess]);

  if (isAnalysisRunning) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.processLoadingState}>
          <Loader2 size={28} className={styles.spinIcon} aria-hidden />
          <p>Агент извлекает процессы из документов отдела…</p>
          {analysisTotal ? (
            <p className={styles.processLoadingMeta}>
              Обработано документов: {analysisProcessed ?? 0} из {analysisTotal}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHint}>
        <p>
          Процессы — это виды деятельности, найденные агентом в документах отдела. Подробные действия, входы, выходы,
          формы и системы доступны в карточке процесса справа.
        </p>
      </div>

      <div className={styles.processToolbar}>
        <div className={styles.filterRow}>
          {FILTERS.map((item) => (
            <button
              key={item.id || "all"}
              type="button"
              className={`${styles.filterChip} ${filter === item.id ? styles.filterChipActive : ""}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={`${formStyles.field} ${styles.sortSelectWrap}`}>
          <span className={formStyles.fieldLabel}>Сортировка</span>
          <FormSelect
            compact
            value={sort}
            onChange={setSort}
            options={SORTS.map((item) => ({ value: item.id, label: item.label }))}
            ariaLabel="Сортировка процессов"
          />
        </div>
      </div>

      {processes.isLoading ? (
        <p className={styles.emptyHint}>Загрузка процессов…</p>
      ) : !items.length ? (
        <div className={styles.processEmptyState}>
          <h3>Процессы пока не найдены.</h3>
          <p>
            Агент создаёт процессы на основании карточек документов. Запустите анализ отдела или проверьте, что в
            прикреплённых базах знаний есть документы.
          </p>
          <div className={styles.processEmptyActions}>
            {onStartAnalysis ? (
              <button type="button" className={styles.primaryBtn} onClick={onStartAnalysis}>
                Запустить анализ
              </button>
            ) : null}
            {onOpenDocuments ? (
              <button type="button" className={styles.secondaryBtn} onClick={onOpenDocuments}>
                Открыть документы
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <NdControlDataTable className={styles.processTable}>
          <thead className={styles.tableHead}>
              <tr>
                <th>#</th>
                <th>Процесс</th>
                <th>Владелец</th>
                <th>Уверенность</th>
                <th>Документы</th>
                <th>Связи</th>
                <th>Системы / формы</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((process, index) => {
                const subtitle = shortText(process.goal || process.description);
                const docTooltip = process.source_documents.map((doc) => doc.display_name).join("\n");
                return (
                  <tr
                    key={process.process_id}
                    className={selectedProcessId === process.process_id ? styles.processRowSelected : undefined}
                    onClick={() => onSelectProcess(process)}
                  >
                    <td className={styles.tableIndexCell}>{index + 1}</td>
                        <td>
                          <div className={styles.processCellMain}>
                            <strong>{process.name}</strong>
                            {subtitle ? <small>{subtitle}</small> : null}
                          </div>
                        </td>
                    <td>
                      <div className={styles.processOwnerCell}>
                        <span>{process.owner.candidate ?? "—"}</span>
                        <span className={ownerBadgeClass(process.owner.status_label)}>{process.owner.status_label}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.confidenceValue}>
                        <span className={`${styles.confidenceDot} ${confidenceDotClass(process.owner.confidence)}`} />
                        {process.owner.confidence_label ?? "—"}
                      </span>
                    </td>
                    <td title={docTooltip || undefined}>
                      {process.source_documents[0]?.document_code ? (
                        <span className={styles.processDocLink}>{process.source_documents[0].document_code}</span>
                      ) : (
                        process.source_documents_count
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenRelations(process.process_id, process.name);
                        }}
                      >
                        {process.relations_count}
                      </button>
                    </td>
                    <td>
                      <span className={styles.processSystemsPreview}>{process.systems_preview}</span>
                    </td>
                    <td className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                      <button type="button" className={styles.linkBtn} onClick={() => onSelectProcess(process)}>
                        Открыть
                      </button>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => onOpenRelations(process.process_id, process.name)}
                      >
                        Связи
                      </button>
                      {!process.owner.confirmed ? (
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => onConfirmProcessOwner(process)}
                        >
                          {process.owner.candidate ? "Подтвердить владельца" : "Назначить владельца"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </NdControlDataTable>
      )}
    </div>
  );
}
