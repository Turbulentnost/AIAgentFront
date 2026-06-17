import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ndControlApi } from "@/api/endpoints";
import { FormSelect } from "@/components/form-controls";
import type { DepartmentStructuralDocumentCard } from "@/types";
import {
  EXTRACTION_STATUS_LABELS,
  SMK_DOCUMENT_LEVEL_FILTER_OPTIONS,
  SMK_DOCUMENT_TYPE_FILTER_OPTIONS
} from "./constants";
import NdControlDataTable from "./NdControlDataTable";
import { formatDateTime } from "./utils";
import styles from "../NdControlAgent.module.css";

type Props = {
  departmentId: string;
  search: string;
  onOpenCard?: (card: DepartmentStructuralDocumentCard) => void;
  onReextract?: (documentId: string) => void;
};

export default function DepartmentDocumentCardsTab({
  departmentId,
  search,
  onOpenCard,
  onReextract
}: Props) {
  const [documentTypeFilter, setDocumentTypeFilter] = useState("");
  const [documentLevelFilter, setDocumentLevelFilter] = useState("");

  const cards = useQuery({
    queryKey: [
      "nd-control",
      "structural-document-cards",
      departmentId,
      search,
      documentTypeFilter,
      documentLevelFilter
    ],
    queryFn: () =>
      ndControlApi.listDepartmentDocumentCards(departmentId, {
        query: search || undefined,
        document_type: documentTypeFilter || undefined,
        document_level: documentLevelFilter || undefined,
        page: 1,
        size: 100
      }),
    enabled: Boolean(departmentId)
  });

  const filterControls = (
    <div className={styles.toolbarFilters}>
      <FormSelect
        compact
        value={documentTypeFilter}
        onChange={setDocumentTypeFilter}
        options={SMK_DOCUMENT_TYPE_FILTER_OPTIONS}
        ariaLabel="Фильтр по типу документа"
      />
      <FormSelect
        compact
        value={documentLevelFilter}
        onChange={setDocumentLevelFilter}
        options={SMK_DOCUMENT_LEVEL_FILTER_OPTIONS}
        ariaLabel="Фильтр по уровню СМК"
      />
    </div>
  );

  if (cards.isLoading) return <p className={styles.emptyHint}>Загрузка карточек…</p>;
  if (cards.isError) return <p className={styles.emptyHint}>Не удалось загрузить карточки документов.</p>;
  if (!cards.data?.items.length) {
    return (
      <div className={styles.emptyStateBlock}>
        {filterControls}
        <p>Карточки документов пока не созданы для этого отдела.</p>
        <p className={styles.emptyHint}>Запустите анализ, чтобы создать карточки из прикреплённых баз знаний.</p>
      </div>
    );
  }

  return (
    <>
      {filterControls}
      <NdControlDataTable>
        <thead className={styles.tableHead}>
          <tr>
            <th>Код</th>
            <th>Наименование</th>
            <th>Тип документа</th>
            <th>Уровень СМК</th>
            <th>Версия</th>
            <th>Статус НД</th>
            <th>Извлечение</th>
            <th>Процессов</th>
            <th>Связей</th>
            <th>Проверка</th>
            <th>Обновлено</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {cards.data.items.map((card) => (
            <tr key={card.document_card_id}>
              <td>{card.document_code ?? "—"}</td>
              <td className={styles.cellEllipsis}>{card.title ?? card.file_name ?? "—"}</td>
              <td>{card.document_type_label ?? "—"}</td>
              <td>{card.document_level_label ?? "—"}</td>
              <td>{card.version ?? "—"}</td>
              <td>{card.status ?? "—"}</td>
              <td>
                <span
                  className={
                    card.extraction_status === "failed"
                      ? styles.badgeError
                      : card.extraction_status === "needs_review"
                        ? styles.badgeReview
                        : styles.badgeOk
                  }
                >
                  {EXTRACTION_STATUS_LABELS[card.extraction_status] ?? card.extraction_status}
                </span>
              </td>
              <td>{card.processes_count}</td>
              <td>{card.relations_count}</td>
              <td>{card.needs_review_count}</td>
              <td>{formatDateTime(card.updated_at)}</td>
              <td className={styles.actionsCell}>
                <button type="button" className={styles.linkBtn} onClick={() => onOpenCard?.(card)}>
                  Открыть
                </button>
                {onReextract ? (
                  <button type="button" className={styles.linkBtn} onClick={() => onReextract(card.document_id)}>
                    Переизвлечь
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </NdControlDataTable>
    </>
  );
}
