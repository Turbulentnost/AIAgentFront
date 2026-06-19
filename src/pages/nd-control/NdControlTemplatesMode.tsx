import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2 } from "lucide-react";
import { ndControlApi } from "@/api/endpoints";
import { FormSearchInput } from "@/components/form-controls";
import type { NdTemplateType } from "@/types";
import NdControlDataTable from "./NdControlDataTable";
import styles from "../NdControlAgent.module.css";

type Props = {
  canManage: boolean;
};

export default function NdControlTemplatesMode({ canManage }: Props) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<NdTemplateType | "">("");
  const [templateType, setTemplateType] = useState<NdTemplateType | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const templateTypes = useQuery({
    queryKey: ["nd-control", "template-types"],
    queryFn: () => ndControlApi.listTemplateTypes()
  });

  const templates = useQuery({
    queryKey: ["nd-control", "templates", query, filterType],
    queryFn: () =>
      ndControlApi.listTemplates({
        query: query || undefined,
        template_type: filterType || undefined,
        page: 1,
        size: 100
      })
  });

  const selectedTypeLabel = useMemo(
    () => templateTypes.data?.find((item) => item.value === templateType)?.label ?? null,
    [templateType, templateTypes.data]
  );

  const createTemplate = useMutation({
    mutationFn: () =>
      ndControlApi.createTemplate({
        template_type: templateType as NdTemplateType,
        name: title.trim() || selectedTypeLabel,
        description: description.trim() || null
      }),
    onSuccess: async () => {
      setTemplateType("");
      setTitle("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "templates"] });
    }
  });

  const archiveTemplate = useMutation({
    mutationFn: (templateId: string) => ndControlApi.archiveTemplate(templateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "templates"] });
    }
  });

  const canSubmit = canManage && Boolean(templateType) && !createTemplate.isPending;

  return (
    <section className={styles.templatesMode}>
      <div className={styles.templatesHeader}>
        <div>
          <h2>Шаблоны нормативных документов</h2>
          <p>Фиксированный реестр типов шаблонов. Документы и базы знаний связываются с шаблоном отдельно.</p>
        </div>
        <span className={styles.badgeNeutral}>{templates.data?.total ?? 0} шаблонов</span>
      </div>

      {canManage ? (
        <div className={styles.templateForm}>
          <div className={styles.templateFormTitle}>
            <Plus size={18} />
            <strong>Добавить фиксированный шаблон</strong>
          </div>
          <div className={styles.templateFormGrid}>
            <label>
              <span>Тип шаблона</span>
              <select value={templateType} onChange={(event) => setTemplateType(event.target.value as NdTemplateType | "")}>
                <option value="">Выберите тип</option>
                {templateTypes.data?.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Название</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="По умолчанию из типа" />
            </label>
            <label className={styles.templateFormWide}>
              <span>Описание</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </label>
          </div>
          {createTemplate.error ? (
            <p className={styles.templateError}>Не удалось добавить шаблон.</p>
          ) : null}
          <button type="button" className={styles.primaryBtn} disabled={!canSubmit} onClick={() => createTemplate.mutate()}>
            Добавить шаблон
          </button>
        </div>
      ) : null}

      <div className={styles.templateToolbar}>
        <FormSearchInput compact value={query} onChange={setQuery} placeholder="Поиск по шаблонам и источникам…" />
        <select value={filterType} onChange={(event) => setFilterType(event.target.value as NdTemplateType | "")}>
          <option value="">Все типы</option>
          {templateTypes.data?.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {templates.isLoading ? (
        <p className={styles.emptyHint}>Загрузка шаблонов…</p>
      ) : !templates.data?.items.length ? (
        <div className={styles.emptyState}>
          <FileText size={36} />
          <p>Шаблоны пока не зарегистрированы.</p>
        </div>
      ) : (
        <NdControlDataTable>
          <thead className={styles.tableHead}>
            <tr>
              <th>Тип</th>
              <th>Название</th>
              <th>Баз знаний</th>
              <th>Документов</th>
              {canManage ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {templates.data.items.map((template) => (
              <tr key={template.id}>
                <td><span className={styles.badgeNeutral}>{template.template_type_label}</span></td>
                <td>
                  <div className={styles.entityCell}>
                    <strong>{template.title}</strong>
                    {template.description ? <span className={styles.entityType}>{template.description}</span> : null}
                  </div>
                </td>
                <td>{template.knowledge_bases_count}</td>
                <td>{template.documents_count}</td>
                {canManage ? (
                  <td>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      disabled={archiveTemplate.isPending}
                      onClick={() => archiveTemplate.mutate(template.id)}
                      aria-label="Архивировать шаблон"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </NdControlDataTable>
      )}
    </section>
  );
}
