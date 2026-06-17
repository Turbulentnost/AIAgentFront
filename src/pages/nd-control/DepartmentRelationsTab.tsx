import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ndControlApi } from "@/api/endpoints";
import styles from "../NdControlAgent.module.css";

type Props = {
  departmentId: string;
  search: string;
};

const FILTERS = [
  { id: "", label: "Все" },
  { id: "unconfirmed", label: "Неподтверждённые" },
  { id: "confirmed", label: "Подтверждённые" }
];

export default function DepartmentRelationsTab({ departmentId, search }: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const size = 50;

  const relations = useQuery({
    queryKey: ["nd-control", "department-relations", departmentId, search, filter, page],
    queryFn: () =>
      ndControlApi.listDepartmentRelations(departmentId, {
        query: search || undefined,
        filter: filter || undefined,
        page,
        size
      }),
    enabled: Boolean(departmentId)
  });

  const approve = useMutation({
    mutationFn: (relationId: string) => ndControlApi.approveRelation(relationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  const reject = useMutation({
    mutationFn: (relationId: string) => ndControlApi.rejectRelation(relationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  const totalPages = relations.data ? Math.max(1, Math.ceil(relations.data.total / size)) : 1;

  return (
    <div className={styles.tabContent}>
      <div className={styles.filterRow}>
        {FILTERS.map((item) => (
          <button
            key={item.id || "all"}
            type="button"
            className={`${styles.filterChip} ${filter === item.id ? styles.filterChipActive : ""}`}
            onClick={() => {
              setFilter(item.id);
              setPage(1);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {relations.isLoading ? (
        <p className={styles.emptyHint}>Загрузка связей…</p>
      ) : !relations.data?.items.length ? (
        <p className={styles.emptyHint}>Связи для этого отдела не найдены.</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Источник</th>
                  <th>Тип связи</th>
                  <th>Цель</th>
                  <th>Уверенность</th>
                  <th>Извлечение</th>
                  <th>Подтверждение</th>
                  <th>Evidence</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {relations.data.items.map((relation) => (
                  <tr key={relation.relation_id}>
                    <td>{relation.source_name}</td>
                    <td>{relation.relation_type_label}</td>
                    <td>{relation.target_name}</td>
                    <td>{relation.confidence}</td>
                    <td>{relation.extraction_type}</td>
                    <td>
                      {relation.is_confirmed ? (
                        <span className={styles.badgeOk}>Да</span>
                      ) : (
                        <span className={styles.badgeReview}>Нет</span>
                      )}
                    </td>
                    <td>{String(relation.evidence?.quote ?? relation.evidence?.section ?? "—")}</td>
                    <td className={styles.actionsCell}>
                      {!relation.is_confirmed ? (
                        <>
                          <button
                            type="button"
                            className={styles.linkBtn}
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(relation.relation_id)}
                          >
                            Подтвердить
                          </button>
                          <button
                            type="button"
                            className={styles.linkBtn}
                            disabled={reject.isPending}
                            onClick={() => reject.mutate(relation.relation_id)}
                          >
                            Отклонить
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationRow}>
            <button type="button" className={styles.secondaryBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Назад
            </button>
            <span>
              Страница {page} из {totalPages} · всего {relations.data.total}
            </span>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
            </button>
          </div>
        </>
      )}
    </div>
  );
}
