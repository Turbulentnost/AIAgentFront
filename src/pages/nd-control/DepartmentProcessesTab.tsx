import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ndControlApi } from "@/api/endpoints";
import styles from "../NdControlAgent.module.css";

type Props = {
  departmentId: string;
  search: string;
  onConfirmOwner?: (processId: string) => void;
};

const FILTERS = [
  { id: "", label: "Все" },
  { id: "owner_confirmed", label: "Владелец подтверждён" },
  { id: "owner_unconfirmed", label: "Владелец не подтверждён" },
  { id: "needs_review", label: "Требует проверки" }
];

export default function DepartmentProcessesTab({ departmentId, search, onConfirmOwner }: Props) {
  const [filter, setFilter] = useState("");
  const processes = useQuery({
    queryKey: ["nd-control", "department-processes", departmentId, search, filter],
    queryFn: () =>
      ndControlApi.listDepartmentProcesses(departmentId, {
        query: search || undefined,
        filter: filter || undefined,
        page: 1,
        size: 100
      }),
    enabled: Boolean(departmentId)
  });

  return (
    <div className={styles.tabContent}>
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
      {processes.isLoading ? (
        <p className={styles.emptyHint}>Загрузка процессов…</p>
      ) : !processes.data?.items.length ? (
        <p className={styles.emptyHint}>Процессы для этого отдела не найдены.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Цель</th>
                <th>Владелец</th>
                <th>Документы</th>
                <th>Формы</th>
                <th>Системы</th>
                <th>Связи</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {processes.data.items.map((process) => (
                <tr key={process.process_id}>
                  <td>{process.canonical_name}</td>
                  <td>{process.goal ?? "—"}</td>
                  <td>{process.owner_candidate ?? "—"}</td>
                  <td>{process.source_documents_count}</td>
                  <td>{process.forms_count}</td>
                  <td>{process.systems_count}</td>
                  <td>{process.relations_count}</td>
                  <td>
                    {process.owner_confirmed ? (
                      <span className={styles.badgeOk}>Подтверждён</span>
                    ) : (
                      <span className={styles.badgeReview}>Владелец не подтверждён</span>
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    {!process.owner_confirmed && onConfirmOwner ? (
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => onConfirmOwner(process.process_id)}
                      >
                        Подтвердить
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
