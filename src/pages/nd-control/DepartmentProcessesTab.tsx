import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ndControlApi } from "@/api/endpoints";
import type { DepartmentProcessItem } from "@/types";
import ConfirmProcessOwnerDialog from "./ConfirmProcessOwnerDialog";
import ProcessDetailsDrawer from "./ProcessDetailsDrawer";
import styles from "../NdControlAgent.module.css";

type Props = {
  departmentId: string;
  search: string;
  isAnalysisRunning?: boolean;
  analysisProcessed?: number;
  analysisTotal?: number;
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

function confidenceBadgeClass(level: string | null | undefined) {
  if (level === "high") return styles.badgeOk;
  if (level === "low") return styles.badgeReview;
  return styles.badgeNeutral;
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
  onOpenRelations,
  onOpenDocuments,
  onStartAnalysis
}: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [selectedProcess, setSelectedProcess] = useState<DepartmentProcessItem | null>(null);
  const [confirmProcess, setConfirmProcess] = useState<DepartmentProcessItem | null>(null);

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

  const confirmOwner = useMutation({
    mutationFn: (processId: string) => ndControlApi.confirmProcessOwner(processId, {}),
    onSuccess: async () => {
      setConfirmProcess(null);
      setSelectedProcess(null);
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  const items = processes.data?.items ?? [];

  const selectedInList = useMemo(
    () => (selectedProcess ? items.find((item) => item.process_id === selectedProcess.process_id) ?? selectedProcess : null),
    [items, selectedProcess]
  );

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
          формы и системы доступны в карточке процесса.
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
        <label className={styles.sortSelectWrap}>
          <span>Сортировка</span>
          <select className={styles.sortSelect} value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
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
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.processTable}`}>
            <thead>
              <tr>
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
              {items.map((process) => {
                const subtitle = shortText(process.goal || process.description);
                const docTooltip = process.source_documents.map((doc) => doc.display_name).join("\n");
                return (
                  <tr
                    key={process.process_id}
                    className={selectedProcess?.process_id === process.process_id ? styles.processRowSelected : undefined}
                    onClick={() => setSelectedProcess(process)}
                  >
                    <td>
                      <div className={styles.processCellMain}>
                        <span className={styles.processName}>{process.name}</span>
                        {subtitle ? <span className={styles.processSubtitle}>{subtitle}</span> : null}
                      </div>
                    </td>
                    <td>
                      <div className={styles.processOwnerCell}>
                        <span>{process.owner.candidate ?? "—"}</span>
                        <span className={ownerBadgeClass(process.owner.status_label)}>{process.owner.status_label}</span>
                      </div>
                    </td>
                    <td>
                      <span className={confidenceBadgeClass(process.owner.confidence)}>
                        {process.owner.confidence_label ?? "—"}
                      </span>
                    </td>
                    <td title={docTooltip || undefined}>{process.source_documents_count}</td>
                    <td>{process.relations_count}</td>
                    <td>
                      <span className={styles.processSystemsPreview}>{process.systems_preview}</span>
                    </td>
                    <td className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                      <button type="button" className={styles.linkBtn} onClick={() => setSelectedProcess(process)}>
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
                          onClick={() => setConfirmProcess(process)}
                        >
                          {process.owner.candidate ? "Подтвердить владельца" : "Назначить владельца"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProcessDetailsDrawer
        process={selectedInList}
        onClose={() => setSelectedProcess(null)}
        onConfirmOwner={setConfirmProcess}
        onOpenRelations={onOpenRelations}
      />

      <ConfirmProcessOwnerDialog
        process={confirmProcess}
        onClose={() => setConfirmProcess(null)}
        onConfirm={() => {
          if (confirmProcess) confirmOwner.mutate(confirmProcess.process_id);
        }}
        isPending={confirmOwner.isPending}
      />
    </div>
  );
}
