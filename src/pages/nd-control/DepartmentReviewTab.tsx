import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ndControlApi } from "@/api/endpoints";
import type { DepartmentRelationItem } from "@/types";
import NdControlDataTable from "./NdControlDataTable";
import styles from "../NdControlAgent.module.css";

type Props = {
  departmentId: string;
  search: string;
  canManageDepartments: boolean;
};

function RelationReviewTable({
  relations,
  onApprove,
  onReject,
  canManageDepartments
}: {
  relations: DepartmentRelationItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  canManageDepartments: boolean;
}) {
  return (
    <NdControlDataTable>
      <thead className={styles.tableHead}>
          <tr>
            <th>Источник</th>
            <th>Связь</th>
            <th>Цель</th>
            <th>Основание</th>
            <th>Уверенность</th>
            {canManageDepartments ? <th>Действия</th> : null}
          </tr>
        </thead>
        <tbody>
          {relations.map((relation) => (
            <tr key={relation.relation_id}>
              <td>
                <div className={styles.entityCell}>
                  <span className={styles.entityType}>{relation.source.type_label}</span>
                  <span className={styles.entityName}>{relation.source_display_name}</span>
                </div>
              </td>
              <td>{relation.relation_type_label}</td>
              <td>
                <div className={styles.entityCell}>
                  <span className={styles.entityType}>{relation.target.type_label}</span>
                  <span className={styles.entityName}>{relation.target_display_name}</span>
                </div>
              </td>
              <td>{relation.has_evidence ? relation.evidence.label : "Нет основания"}</td>
              <td>{relation.confidence_label}</td>
              {canManageDepartments ? (
                <td className={styles.actionsCell}>
                  <button type="button" className={styles.linkBtn} onClick={() => onApprove(relation.relation_id)}>
                    Подтвердить
                  </button>
                  <button type="button" className={styles.linkBtn} onClick={() => onReject(relation.relation_id)}>
                    Отклонить
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
      </tbody>
    </NdControlDataTable>
  );
}

export default function DepartmentReviewTab({ departmentId, search, canManageDepartments }: Props) {
  const queryClient = useQueryClient();
  const review = useQuery({
    queryKey: ["nd-control", "review-pending", departmentId, search],
    queryFn: () =>
      ndControlApi.listReviewPending(departmentId, {
        query: search || undefined
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
    !data?.process_owners.length &&
    !data?.important_relations.length &&
    !data?.relations_without_evidence.length &&
    !data?.weak_relations.length &&
    !data?.documents.length &&
    !data?.extraction_errors.length;

  return (
    <div className={styles.tabContent}>
      {empty ? <p className={styles.emptyHint}>Элементов, требующих проверки, не найдено.</p> : null}

      {data?.process_owners.length ? (
        <section className={styles.sectionCard}>
          <h3>Владельцы процессов</h3>
          <p className={styles.sectionHint}>Подтвердите или скорректируйте кандидата владельца для каждого процесса.</p>
          <NdControlDataTable>
            <thead className={styles.tableHead}>
                <tr>
                  <th>Процесс</th>
                  <th>Кандидат</th>
                  <th>Уверенность</th>
                  {canManageDepartments ? <th>Действия</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.process_owners.map((item) => (
                  <tr key={item.process_id}>
                    <td>{item.process_name}</td>
                    <td>{item.owner_candidate ?? "—"}</td>
                    <td>{item.confidence_label ?? "—"}</td>
                    {canManageDepartments ? (
                      <td className={styles.actionsCell}>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => confirmOwner.mutate(item.process_id)}
                        >
                          Подтвердить
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
          </NdControlDataTable>
        </section>
      ) : null}

      {data?.important_relations.length ? (
        <section className={styles.sectionCard}>
          <h3>Важные связи без подтверждения</h3>
          <p className={styles.sectionHint}>
            Основные связи с основанием, которые влияют на анализ изменений. Проверьте и подтвердите или отклоните.
          </p>
          <RelationReviewTable
            relations={data.important_relations}
            onApprove={(id) => approveRelation.mutate(id)}
            onReject={(id) => rejectRelation.mutate(id)}
            canManageDepartments={canManageDepartments}
          />
        </section>
      ) : null}

      {data?.relations_without_evidence.length ? (
        <section className={styles.sectionCard}>
          <h3>Связи без основания</h3>
          <p className={styles.sectionHint}>
            Эти связи не имеют цитаты или ссылки на раздел документа. Не подтверждайте их без ручной проверки.
          </p>
          <RelationReviewTable
            relations={data.relations_without_evidence}
            onApprove={(id) => approveRelation.mutate(id)}
            onReject={(id) => rejectRelation.mutate(id)}
            canManageDepartments={canManageDepartments}
          />
        </section>
      ) : null}

      {data?.weak_relations.length ? (
        <section className={styles.sectionCard}>
          <h3>Слабые inferred-связи</h3>
          <p className={styles.sectionHint}>
            Упоминания отделов и другие служебные связи с низким приоритетом. Обычно не требуют срочного подтверждения.
          </p>
          <RelationReviewTable
            relations={data.weak_relations}
            onApprove={(id) => approveRelation.mutate(id)}
            onReject={(id) => rejectRelation.mutate(id)}
            canManageDepartments={canManageDepartments}
          />
        </section>
      ) : null}

      {data?.extraction_errors.length ? (
        <section className={styles.sectionCard}>
          <h3>Ошибки извлечения</h3>
          <p className={styles.sectionHint}>Документы, при обработке которых произошла ошибка. Запустите повторный анализ.</p>
          <NdControlDataTable>
            <thead className={styles.tableHead}>
                <tr>
                  <th>Код</th>
                  <th>Документ</th>
                  <th>Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {data.extraction_errors.map((doc) => (
                  <tr key={doc.document_card_id}>
                    <td>{doc.document_code ?? "—"}</td>
                    <td>{doc.title ?? "—"}</td>
                    <td>{doc.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
          </NdControlDataTable>
        </section>
      ) : null}

      {data?.documents.length ? (
        <section className={styles.sectionCard}>
          <h3>Документы на проверке</h3>
          <p className={styles.sectionHint}>Карточки документов, которые агент пометил как требующие ручной проверки.</p>
          <NdControlDataTable>
            <thead className={styles.tableHead}>
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
          </NdControlDataTable>
        </section>
      ) : null}
    </div>
  );
}
