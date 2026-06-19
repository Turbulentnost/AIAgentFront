import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileStack } from "lucide-react";
import { ndControlApi } from "@/api/endpoints";
import { FormSearchInput } from "@/components/form-controls";
import type { NdControlPermissions, NdControlTemplate, NdTemplateType } from "@/types";
import NdControlDataTable from "./NdControlDataTable";
import TemplateDetailPanel from "./TemplateDetailPanel";
import { ND_TEMPLATE_TYPE_LABELS, TEMPLATE_CLASSIFICATION_STATUS_LABELS } from "./constants";
import styles from "../NdControlAgent.module.css";

type Props = {
  permissions: NdControlPermissions;
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
};

function primaryStatus(template: NdControlTemplate) {
  const stats = template.classification_stats;
  if (stats.failed > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.failed, className: styles.badgeError };
  if (stats.needs_review > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.needs_review, className: styles.badgeReview };
  if (stats.processing > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.processing, className: styles.badgeNeutral };
  if (stats.pending > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.pending, className: styles.badgeNeutral };
  if (stats.completed > 0) return { label: TEMPLATE_CLASSIFICATION_STATUS_LABELS.completed, className: styles.badgeOk };
  return { label: "Без документов", className: styles.badgeNeutral };
}

export default function TemplatesPanel({ permissions, selectedTemplateId, onSelectTemplate }: Props) {
  const [query, setQuery] = useState("");

  const templates = useQuery({
    queryKey: ["nd-control", "templates", query],
    queryFn: () => ndControlApi.templates.list({ query: query || undefined, page: 1, size: 100 })
  });

  const selectedTemplate = useMemo(
    () => templates.data?.items.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates.data?.items]
  );

  const filteredTemplates = templates.data?.items ?? [];

  return (
    <section className={styles.templatesMode}>
      <div className={styles.templatesHeader}>
        <div>
          <h2>Шаблоны нормативных документов</h2>
          <p>15 фиксированных типов шаблонов, документы и статусы классификации.</p>
        </div>
        <span className={styles.badgeNeutral}>{templates.data?.total ?? 0} шаблонов</span>
      </div>

      <div className={styles.templateToolbarSingle}>
        <FormSearchInput compact value={query} onChange={setQuery} placeholder="Поиск по названию или типу…" />
      </div>

      {templates.isLoading ? (
        <p className={styles.emptyHint}>Загрузка шаблонов…</p>
      ) : !filteredTemplates.length ? (
        <div className={styles.emptyState}>
          <FileStack size={36} />
          <p>Шаблоны не найдены.</p>
        </div>
      ) : (
        <NdControlDataTable>
          <thead className={styles.tableHead}>
            <tr>
              <th>Шаблон</th>
              <th>Тип</th>
              <th>Документов</th>
              <th>Статус классификации</th>
              <th>Баз знаний</th>
            </tr>
          </thead>
          <tbody>
            {filteredTemplates.map((template) => {
              const status = primaryStatus(template);
              return (
                <tr key={template.id} className={template.id === selectedTemplateId ? styles.processRowSelected : undefined} onClick={() => onSelectTemplate(template.id)}>
                  <td>
                    <div className={styles.entityCell}>
                      <strong>{template.name}</strong>
                      {template.description ? <span className={styles.entityType}>{template.description}</span> : null}
                    </div>
                  </td>
                  <td><span className={styles.badgeNeutral}>{template.template_type_label || ND_TEMPLATE_TYPE_LABELS[template.template_type as NdTemplateType]}</span></td>
                  <td>{template.documents_count}</td>
                  <td><span className={status.className}>{status.label}</span></td>
                  <td>{template.knowledge_bases_count}</td>
                </tr>
              );
            })}
          </tbody>
        </NdControlDataTable>
      )}

      {selectedTemplate ? <TemplateDetailPanel template={selectedTemplate} permissions={permissions} /> : null}
    </section>
  );
}
