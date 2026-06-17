import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ndControlApi } from "@/api/endpoints";
import type { DepartmentRelationItem } from "@/types";
import NdControlDataTable from "./NdControlDataTable";
import styles from "../NdControlAgent.module.css";

type Props = {
  departmentId: string;
  search: string;
  processId?: string;
  processName?: string;
  onClearProcessFilter?: () => void;
};

const FILTERS = [
  { id: "primary", label: "Основные" },
  { id: "all", label: "Все" },
  { id: "unconfirmed", label: "Неподтверждённые" },
  { id: "confirmed", label: "Подтверждённые" },
  { id: "no_evidence", label: "Требуют основания" },
  { id: "service", label: "Служебные" }
];

function EntityCell({ entity }: { entity: { type_label: string; name: string } }) {
  return (
    <div className={styles.entityCell}>
      <span className={styles.entityType}>{entity.type_label}</span>
      <span className={styles.entityName}>{entity.name}</span>
    </div>
  );
}

function confidenceBadgeClass(level: string) {
  if (level === "high") return styles.badgeOk;
  if (level === "low") return styles.badgeReview;
  return styles.badgeNeutral;
}

function RelationRow({
  relation,
  onApprove,
  onReject,
  approvePending,
  rejectPending
}: {
  relation: DepartmentRelationItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approvePending: boolean;
  rejectPending: boolean;
}) {
  const weak = !relation.has_evidence || relation.is_weak_relation || relation.is_service_relation;
  return (
    <>
      <tr className={weak ? styles.relationWeakRow : undefined}>
        <td>
          <EntityCell entity={relation.source} />
        </td>
        <td>{relation.relation_type_label}</td>
        <td>
          <EntityCell entity={relation.target} />
        </td>
        <td>
          <span className={confidenceBadgeClass(relation.confidence)}>{relation.confidence_label}</span>
        </td>
        <td>{relation.extraction_type_label}</td>
        <td>
          <span className={relation.is_confirmed ? styles.badgeOk : styles.badgeReview}>
            {relation.confirmation_status_label}
          </span>
        </td>
        <td>
          {relation.has_evidence ? (
            relation.evidence.label
          ) : (
            <span className={styles.missingEvidence}>Нет основания</span>
          )}
        </td>
        <td className={styles.actionsCell}>
          {!relation.is_confirmed ? (
            <>
              <button
                type="button"
                className={styles.linkBtn}
                disabled={approvePending}
                onClick={() => onApprove(relation.relation_id)}
              >
                Подтвердить
              </button>
              <button
                type="button"
                className={styles.linkBtn}
                disabled={rejectPending}
                onClick={() => onReject(relation.relation_id)}
              >
                Отклонить
              </button>
            </>
          ) : null}
        </td>
      </tr>
      <tr className={styles.relationDescriptionRow}>
        <td colSpan={8}>
          <span className={styles.relationDescription}>{relation.relation_description}</span>
        </td>
      </tr>
    </>
  );
}

export default function DepartmentRelationsTab({
  departmentId,
  search,
  processId,
  processName,
  onClearProcessFilter
}: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("primary");
  const [page, setPage] = useState(1);
  const [bulkWarning, setBulkWarning] = useState<string | null>(null);
  const size = 50;

  const relations = useQuery({
    queryKey: ["nd-control", "department-relations", departmentId, search, filter, processId, page],
    queryFn: () =>
      ndControlApi.listDepartmentRelations(departmentId, {
        query: search || undefined,
        filter: filter || undefined,
        process_id: processId || undefined,
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

  const bulkApprove = useMutation({
    mutationFn: (relationIds: string[]) => ndControlApi.bulkApproveRelations(relationIds),
    onSuccess: async (result) => {
      setBulkWarning(
        result.skipped.length
          ? `Подтверждено: ${result.approved.length}. Пропущено (требуют ручной проверки): ${result.skipped.length}.`
          : `Подтверждено связей: ${result.approved.length}.`
      );
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  const bulkCandidates = useMemo(
    () => (relations.data?.items ?? []).filter((item) => item.can_bulk_approve),
    [relations.data?.items]
  );

  const totalPages = relations.data ? Math.max(1, Math.ceil(relations.data.total / size)) : 1;

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHint}>
        <p>
          Связи показывают, как документы, процессы, отделы, роли, формы и системы связаны между собой. Эти связи
          используются агентом для анализа влияния изменений.
        </p>
        <p className={styles.tabHintSecondary}>
          Процессы — это найденные виды деятельности. Связи — это отношения между процессами, документами, отделами,
          ролями и системами.
        </p>
      </div>

      {processId ? (
        <div className={styles.activeFilterBanner}>
          <span>
            Показаны связи процесса: {processName ?? "выбранный процесс"}
          </span>
          {onClearProcessFilter ? (
            <button type="button" className={styles.linkBtn} onClick={onClearProcessFilter}>
              Сбросить фильтр
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={styles.filterRow}>
        {FILTERS.map((item) => (
          <button
            key={item.id}
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

      {bulkCandidates.length ? (
        <div className={styles.bulkActionsRow}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={bulkApprove.isPending}
            onClick={() => bulkApprove.mutate(bulkCandidates.map((item) => item.relation_id))}
          >
            Подтвердить явные связи ({bulkCandidates.length})
          </button>
          <span className={styles.bulkHint}>
            Массовое подтверждение доступно только для явных связей с высокой уверенностью и основанием.
          </span>
        </div>
      ) : null}

      {bulkWarning ? <p className={styles.infoHint}>{bulkWarning}</p> : null}

      {relations.isLoading ? (
        <p className={styles.emptyHint}>Загрузка связей…</p>
      ) : !relations.data?.items.length ? (
        <p className={styles.emptyHint}>Связи для этого отдела не найдены.</p>
      ) : (
        <>
          <NdControlDataTable>
            <thead className={styles.tableHead}>
                <tr>
                  <th>Источник</th>
                  <th>Тип связи</th>
                  <th>Цель</th>
                  <th>Уверенность</th>
                  <th>Извлечение</th>
                  <th>Подтверждение</th>
                  <th>Основание</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {relations.data.items.map((relation) => (
                  <RelationRow
                    key={relation.relation_id}
                    relation={relation}
                    onApprove={(id) => approve.mutate(id)}
                    onReject={(id) => reject.mutate(id)}
                    approvePending={approve.isPending}
                    rejectPending={reject.isPending}
                  />
                ))}
            </tbody>
          </NdControlDataTable>
          <div className={styles.paginationRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
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
