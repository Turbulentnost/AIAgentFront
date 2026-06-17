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
  { id: "high_confidence", label: "High confidence" },
  { id: "department_process", label: "Отдел → процесс" },
  { id: "document_process", label: "Документ → процесс" }
];

export default function DepartmentReviewTab({ departmentId, search }: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const review = useQuery({
    queryKey: ["nd-control", "review-pending", departmentId, search, filter],
    queryFn: () =>
      ndControlApi.listReviewPending(departmentId, {
        query: search || undefined,
        filter: filter || undefined
      }),
    enabled: Boolean(departmentId)
  });

  const approveRelation = useMutation({
    mutationFn: (relationId: string) => ndControlApi.approveRelation(relationId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["nd-control"] })
  });
  const rejectRelation = useMutation({
    mutationFn: (relationId: string) => ndControlApi.rejectRelation(relationId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["nd-control"] })
  });
  const confirmOwner = useMutation({
    mutationFn: (processId: string) => ndControlApi.confirmProcessOwner(processId, {}),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["nd-control"] })
  });

  if (review.isLoading) return <p className={styles.emptyHint}>Загрузка очереди проверки…</p>;
  const data = review.data;
  const empty =
    !data?.process_owners.length && !data?.relations.length && !data?.documents.length && !data?.conflicts.length;

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
      {empty ? <p className={styles.emptyHint}>Элементов, требующих проверки, не найдено.</p> : null}

      {data?.process_owners.length ? (
        <section className={styles.sectionCard}>
          <h3>Владельцы процессов</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Процесс</th>
                  <th>Кандидат</th>
                  <th>Confidence</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.process_owners.map((item) => (
                  <tr key={item.process_id}>
                    <td>{item.process_name}</td>
                    <td>{item.owner_candidate ?? "—"}</td>
                    <td>{item.confidence ?? "—"}</td>
                    <td className={styles.actionsCell}>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => confirmOwner.mutate(item.process_id)}
                      >
                        Подтвердить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {data?.relations.length ? (
        <section className={styles.sectionCard}>
          <h3>Неподтверждённые связи</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Источник</th>
                  <th>Связь</th>
                  <th>Цель</th>
                  <th>Evidence</th>
                  <th>Confidence</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.relations.map((relation) => (
                  <tr key={relation.relation_id}>
                    <td>{relation.source_name}</td>
                    <td>{relation.relation_type_label}</td>
                    <td>{relation.target_name}</td>
                    <td>{String(relation.evidence?.quote ?? "—")}</td>
                    <td>{relation.confidence}</td>
                    <td className={styles.actionsCell}>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => approveRelation.mutate(relation.relation_id)}
                      >
                        Подтвердить
                      </button>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => rejectRelation.mutate(relation.relation_id)}
                      >
                        Отклонить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {data?.documents.length ? (
        <section className={styles.sectionCard}>
          <h3>Документы needs_review</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Документ</th>
                  <th>Причина</th>
                </tr>
              </thead>
              <tbody>
                {data.documents.map((doc) => (
                  <tr key={doc.document_card_id}>
                    <td>{doc.document_code ?? "—"}</td>
                    <td>{doc.title ?? "—"}</td>
                    <td>{doc.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
