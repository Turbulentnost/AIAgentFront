import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, FileStack, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { documentsApi, knowledgeBasesApi, ndControlApi } from "@/api/endpoints";
import type { KnowledgeBaseListItem, NdControlPermissions, NdControlTemplate } from "@/types";
import NdControlDataTable from "./NdControlDataTable";
import { ND_TEMPLATE_TYPE_LABELS, TEMPLATE_CLASSIFICATION_STATUS_LABELS } from "./constants";
import styles from "../NdControlAgent.module.css";

type Props = {
  template: NdControlTemplate;
  permissions: NdControlPermissions;
};

type TabId = "documents" | "knowledge-bases";

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "pending", label: "Ожидает" },
  { value: "processing", label: "Классификация" },
  { value: "completed", label: "Готово" },
  { value: "needs_review", label: "Требует проверки" },
  { value: "failed", label: "Ошибка" }
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function confidence(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export default function TemplateDetailPanel({ template, permissions }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("documents");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedKbId, setSelectedKbId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const detail = useQuery({
    queryKey: ["nd-control", "template", template.id],
    queryFn: () => ndControlApi.templates.get(template.id)
  });

  const documents = useQuery({
    queryKey: ["nd-control", "template", template.id, "documents", statusFilter],
    queryFn: () =>
      ndControlApi.templates.documents(template.id, {
        page: 1,
        size: 100,
        classification_status: statusFilter || undefined
      })
  });

  const knowledgeBases = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: () => knowledgeBasesApi.list()
  });

  const existingSources = useQuery({
    queryKey: ["nd-control", "template", template.id, "sources", selectedKbId, sourceQuery],
    queryFn: () =>
      ndControlApi.listTemplateSources({
        knowledge_base_id: selectedKbId || undefined,
        query: sourceQuery || undefined,
        include_registered: true
      }),
    enabled: showAddModal && Boolean(selectedKbId)
  });

  const linkedKbIds = detail.data?.knowledge_base_ids ?? [];
  const linkedKnowledgeBases = useMemo(
    () => (knowledgeBases.data ?? []).filter((kb) => linkedKbIds.includes(kb.id)),
    [knowledgeBases.data, linkedKbIds]
  );

  const setKnowledgeBases = useMutation({
    mutationFn: (knowledge_base_ids: string[]) => ndControlApi.templates.setKnowledgeBases(template.id, { knowledge_base_ids }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "templates"] });
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "template", template.id] });
    }
  });

  const uploadAndAttach = useMutation({
    mutationFn: async () => {
      if (sourceId.trim()) {
        return ndControlApi.templates.addDocument(template.id, { knowledge_base_source_id: sourceId.trim() });
      }
      if (!selectedFile || !selectedKbId) throw new Error("Выберите БЗ и файл");
      const uploadedDocument = await documentsApi.upload(selectedFile);
      const source = await knowledgeBasesApi.addSource(selectedKbId, { document_id: uploadedDocument.id });
      return ndControlApi.templates.addDocument(template.id, { knowledge_base_source_id: source.id });
    },
    onSuccess: async () => {
      setShowAddModal(false);
      setSourceId("");
      setSourceQuery("");
      setSelectedFile(null);
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "templates"] });
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "template", template.id, "documents"] });
    }
  });

  const deleteDocument = useMutation({
    mutationFn: (documentLinkId: string) => ndControlApi.templates.deleteDocument(template.id, documentLinkId),
    onSuccess: async () => {
      setPendingDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "templates"] });
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "template", template.id, "documents"] });
    }
  });

  const confirmType = useMutation({
    mutationFn: (documentLinkId: string) =>
      ndControlApi.templates.updateDocument(template.id, documentLinkId, { confirm_detected_type: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "templates"] });
      await queryClient.invalidateQueries({ queryKey: ["nd-control", "template", template.id, "documents"] });
    }
  });

  async function openPreview(documentId: string, title: string) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const blob = await documentsApi.file(documentId, "inline");
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreview({ url, title });
  }

  function closePreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreview(null);
  }

  const canAddDocument = permissions.can_upload_template_documents && linkedKnowledgeBases.length > 0;
  const canAttach = Boolean(sourceId.trim() || (selectedKbId && selectedFile));

  return (
    <section className={styles.templateDetail}>
      <div className={styles.templatesHeader}>
        <div>
          <h2>{template.name}</h2>
          <p>{template.template_type_label || ND_TEMPLATE_TYPE_LABELS[template.template_type]}</p>
        </div>
        {permissions.can_upload_template_documents ? (
          <button type="button" className={styles.primaryBtn} disabled={!canAddDocument} onClick={() => setShowAddModal(true)}>
            <UploadCloud size={16} />
            Добавить документ
          </button>
        ) : null}
      </div>

      <div className={styles.tabBar}>
        <button type="button" className={`${styles.tabBtn} ${activeTab === "documents" ? styles.tabBtnActive : ""}`} onClick={() => setActiveTab("documents")}>
          Документы
        </button>
        <button type="button" className={`${styles.tabBtn} ${activeTab === "knowledge-bases" ? styles.tabBtnActive : ""}`} onClick={() => setActiveTab("knowledge-bases")}>
          Базы знаний
        </button>
      </div>

      {activeTab === "documents" ? (
        <>
          <div className={styles.toolbarFilters}>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {documents.isLoading ? (
            <p className={styles.emptyHint}>Загрузка документов…</p>
          ) : !documents.data?.items.length ? (
            <div className={styles.emptyState}>
              <FileStack size={36} />
              <p>В этом шаблоне пока нет документов</p>
            </div>
          ) : (
            <NdControlDataTable>
              <thead className={styles.tableHead}>
                <tr>
                  <th>Файл</th>
                  <th>Detected type</th>
                  <th>Статус</th>
                  <th>Confidence</th>
                  <th>Добавлен</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.data.items.map((item) => {
                  const mismatch = item.detected_template_type && item.detected_template_type !== template.template_type;
                  const statusLabel = mismatch
                    ? "Требует проверки"
                    : TEMPLATE_CLASSIFICATION_STATUS_LABELS[item.classification_status] ?? item.classification_status;
                  const statusClass = mismatch || item.classification_status === "needs_review"
                    ? styles.badgeReview
                    : item.classification_status === "failed"
                      ? styles.badgeError
                      : item.classification_status === "completed"
                        ? styles.badgeOk
                        : styles.badgeNeutral;
                  return (
                    <tr key={item.id}>
                      <td>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => openPreview(item.document_id, item.document_title || item.original_filename || "Документ")}
                        >
                          {item.original_filename || item.document_title || "Документ"}
                        </button>
                      </td>
                      <td>
                        <span className={mismatch ? styles.badgeReview : styles.badgeNeutral}>
                          {item.detected_template_type_label ?? "—"}
                        </span>
                      </td>
                      <td><span className={statusClass}>{statusLabel}</span></td>
                      <td>{confidence(item.classification_confidence)}</td>
                      <td>{formatDate(item.created_at)}</td>
                      <td className={styles.actionsCell}>
                        <button type="button" className={styles.iconBtn} onClick={() => openPreview(item.document_id, item.document_title || item.original_filename || "Документ")} aria-label="Просмотр документа">
                          <Eye size={16} />
                        </button>
                        {mismatch && permissions.can_upload_template_documents ? (
                          <button type="button" className={styles.secondaryBtn} disabled={confirmType.isPending} onClick={() => confirmType.mutate(item.id)}>
                            <CheckCircle2 size={16} />
                            Подтвердить тип
                          </button>
                        ) : null}
                        {permissions.can_manage_templates ? (
                          <button type="button" className={styles.iconBtn} onClick={() => setPendingDeleteId(item.id)} aria-label="Удалить из шаблона">
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </NdControlDataTable>
          )}
        </>
      ) : (
        <div className={styles.templateForm}>
          <div className={styles.templatesHeader}>
            <div>
              <h3 className={styles.templatePanelTitle}>Привязанные базы знаний</h3>
              <p>Обычные пользователи видят список без редактирования.</p>
            </div>
          </div>
          <div className={styles.kbGrid}>
            {linkedKnowledgeBases.length ? linkedKnowledgeBases.map((kb) => (
              <div key={kb.id} className={styles.kbCard}>
                <strong>{kb.name}</strong>
                <p>{kb.description ?? "—"}</p>
              </div>
            )) : <p className={styles.emptyHint}>Базы знаний не привязаны.</p>}
          </div>
          {permissions.can_manage_templates ? (
            <KnowledgeBaseEditor
              allKnowledgeBases={knowledgeBases.data ?? []}
              linkedKbIds={linkedKbIds}
              isPending={setKnowledgeBases.isPending}
              onSave={(ids) => setKnowledgeBases.mutate(ids)}
            />
          ) : null}
        </div>
      )}

      {showAddModal ? (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modalCardWide} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Добавить документ в шаблон</h2>
              <button type="button" className={styles.iconBtn} onClick={() => setShowAddModal(false)} aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>
            <div className={styles.templateFormGrid}>
              <label>
                <span>База знаний шаблона</span>
                <select value={selectedKbId} onChange={(event) => setSelectedKbId(event.target.value)}>
                  <option value="">Выберите БЗ</option>
                  {linkedKnowledgeBases.map((kb) => (
                    <option key={kb.id} value={kb.id}>{kb.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Поиск существующего source</span>
                <input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Название или файл" />
              </label>
              <label className={styles.templateFormWide}>
                <span>Выбрать проиндексированный source</span>
                <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                  <option value="">Не выбран</option>
                  {existingSources.data?.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.document_title || source.original_filename || source.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.templateFormWide}>
                <span>Или загрузить файл в выбранную БЗ</span>
                <input ref={fileInputRef} type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowAddModal(false)}>Отмена</button>
              <button type="button" className={styles.primaryBtn} disabled={!canAttach || uploadAndAttach.isPending} onClick={() => uploadAndAttach.mutate()}>
                <Plus size={16} />
                Добавить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteId ? (
        <div className={styles.modalOverlay} onClick={() => setPendingDeleteId(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h2>Удалить документ из шаблона?</h2>
            <p className={styles.modalText}>Файл останется в базе знаний, удалится только связь с шаблоном.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setPendingDeleteId(null)}>Отмена</button>
              <button type="button" className={styles.dangerBtn} disabled={deleteDocument.isPending} onClick={() => deleteDocument.mutate(pendingDeleteId)}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className={styles.modalOverlay} onClick={closePreview}>
          <div className={styles.documentPreviewPanel} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{preview.title}</h2>
              <button type="button" className={styles.iconBtn} onClick={closePreview} aria-label="Закрыть просмотр">
                <X size={16} />
              </button>
            </div>
            <iframe className={styles.documentPreviewFrame} src={preview.url} title={preview.title} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function KnowledgeBaseEditor({
  allKnowledgeBases,
  linkedKbIds,
  isPending,
  onSave
}: {
  allKnowledgeBases: KnowledgeBaseListItem[];
  linkedKbIds: string[];
  isPending: boolean;
  onSave: (ids: string[]) => void;
}) {
  const [draftIds, setDraftIds] = useState(linkedKbIds);

  return (
    <div className={styles.templateFormGrid}>
      <label className={styles.templateFormWide}>
        <span>Редактирование привязанных БЗ</span>
        <select multiple value={draftIds} onChange={(event) => setDraftIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
          {allKnowledgeBases.map((kb) => (
            <option key={kb.id} value={kb.id}>{kb.name}</option>
          ))}
        </select>
      </label>
      <div className={styles.actionsCell}>
        <button type="button" className={styles.primaryBtn} disabled={isPending} onClick={() => onSave(draftIds)}>
          Сохранить БЗ
        </button>
      </div>
    </div>
  );
}
