import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { knowledgeBasesApi, ndControlApi } from "@/api/endpoints";
import { FormSearchInput } from "@/components/form-controls";
import formStyles from "@/components/form-controls/form-controls.module.css";
import type {
  NdConfidentialityLevel,
  NdControlDepartment,
  NdDocumentCard,
  NdDocumentCardStatus,
  NdDocumentCardUpdate,
  NdDocumentType,
  NdQmsLevel
} from "@/types";
import styles from "./NdControlAgent.module.css";

const documentTypeOptions: { value: NdDocumentType; label: string }[] = [
  { value: "policy", label: "Политика" },
  { value: "regulation", label: "Положение" },
  { value: "procedure", label: "Регламент" },
  { value: "sto", label: "СТО" },
  { value: "instruction", label: "Инструкция" }
];

const qmsLevelOptions: { value: NdQmsLevel; label: string }[] = [
  { value: "strategic", label: "Стратегический" },
  { value: "organizational", label: "Организационный" },
  { value: "process", label: "Процессный" },
  { value: "technical", label: "Технический" },
  { value: "operational", label: "Операционный" }
];

const statusOptions: { value: NdDocumentCardStatus; label: string }[] = [
  { value: "draft", label: "Черновик" },
  { value: "active", label: "Действующий" },
  { value: "superseded", label: "Заменён" },
  { value: "archived", label: "Архив" }
];

const confidentialityOptions: { value: NdConfidentialityLevel; label: string }[] = [
  { value: "public", label: "Общедоступный" },
  { value: "restricted", label: "ДСП" },
  { value: "confidential", label: "Конфиденциально" }
];

const documentTypeLabels = Object.fromEntries(documentTypeOptions.map((o) => [o.value, o.label])) as Record<
  NdDocumentType,
  string
>;
const qmsLevelLabels = Object.fromEntries(qmsLevelOptions.map((o) => [o.value, o.label])) as Record<NdQmsLevel, string>;
const statusLabels = Object.fromEntries(statusOptions.map((o) => [o.value, o.label])) as Record<NdDocumentCardStatus, string>;

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(values: string[] | null | undefined): string {
  return (values ?? []).join("\n");
}

function cardToForm(card: NdDocumentCard): NdDocumentCardUpdate {
  return {
    document_code: card.document_code,
    document_name: card.document_name,
    document_type: card.document_type,
    qms_level: card.qms_level,
    version: card.version,
    status: card.status,
    approval_date: card.approval_date,
    effective_date: card.effective_date,
    process_owner: card.process_owner,
    author: card.author,
    reviewer: card.reviewer,
    approver: card.approver,
    owner_department: card.owner_department,
    scope: card.scope,
    related_processes: card.related_processes,
    related_departments: card.related_departments,
    related_documents: card.related_documents,
    normative_references: card.normative_references,
    record_forms: card.record_forms,
    retention_period: card.retention_period,
    original_storage_location: card.original_storage_location,
    electronic_storage_location: card.electronic_storage_location,
    has_process_diagram: card.has_process_diagram,
    has_acknowledgement_sheet: card.has_acknowledgement_sheet,
    acknowledgement_targets: card.acknowledgement_targets,
    confidentiality_level: card.confidentiality_level,
    attachments: card.attachments,
    archived_versions: card.archived_versions
  };
}

export default function NdControlAgent() {
  const location = useLocation();
  const enteredFromLaunch = (location.state as { from?: string } | null)?.from === "agent-launch";
  const queryClient = useQueryClient();
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [cardSearch, setCardSearch] = useState("");
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDescription, setNewDeptDescription] = useState("");
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [editingCard, setEditingCard] = useState<NdDocumentCard | null>(null);
  const [cardForm, setCardForm] = useState<NdDocumentCardUpdate>({});

  const permissions = useQuery({
    queryKey: ["nd-control", "permissions"],
    queryFn: ndControlApi.permissions
  });
  const departments = useQuery({
    queryKey: ["nd-control", "departments"],
    queryFn: ndControlApi.listDepartments
  });
  const knowledgeBases = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: () => knowledgeBasesApi.list()
  });

  const accessibleKbs = useMemo(
    () => (knowledgeBases.data ?? []).filter((kb) => kb.can_access),
    [knowledgeBases.data]
  );

  useEffect(() => {
    if (!selectedDeptId && departments.data?.length) {
      setSelectedDeptId(departments.data[0].id);
    }
  }, [departments.data, selectedDeptId]);

  const cards = useQuery({
    queryKey: ["nd-control", "document-cards", selectedDeptId, cardSearch],
    queryFn: () =>
      ndControlApi.listDocumentCards({
        department_id: selectedDeptId ?? undefined,
        query: cardSearch || undefined,
        page: 1,
        size: 100
      }),
    enabled: Boolean(selectedDeptId)
  });

  const createDepartment = useMutation({
    mutationFn: () =>
      ndControlApi.createDepartment({
        name: newDeptName.trim(),
        description: newDeptDescription.trim() || null,
        knowledge_base_ids: selectedKbIds
      }),
    onSuccess: async (dept) => {
      setShowCreateDept(false);
      setNewDeptName("");
      setNewDeptDescription("");
      setSelectedKbIds([]);
      setSelectedDeptId(dept.id);
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  const updateCard = useMutation({
    mutationFn: () => ndControlApi.updateDocumentCard(editingCard!.id, cardForm),
    onSuccess: async () => {
      setEditingCard(null);
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  const openCardEditor = (card: NdDocumentCard) => {
    setEditingCard(card);
    setCardForm(cardToForm(card));
  };

  const handleCreateDepartment = (event: FormEvent) => {
    event.preventDefault();
    if (!newDeptName.trim() || selectedKbIds.length === 0) return;
    createDepartment.mutate();
  };

  const handleSaveCard = (event: FormEvent) => {
    event.preventDefault();
    if (!editingCard) return;
    updateCard.mutate();
  };

  const canManage = permissions.data?.can_manage_departments ?? false;

  if (permissions.isLoading) {
    return <div className={styles.empty}>Загрузка…</div>;
  }

  if (permissions.data && !permissions.data.can_access_agent) {
    return <div className={styles.empty}>Нет доступа к агенту контроля НД.</div>;
  }

  return (
    <div className={`${styles.page} ${enteredFromLaunch ? styles.pageEnter : ""}`}>
      <header className={styles.header}>
        <div>
          <h1>Агент контроля НД и внесения изменений</h1>
          <p>
            Реестр нормативных документов по отделам агента. Для каждого файла в привязанных базах знаний
            создаётся карточка документа.
          </p>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            <h2 className={styles.sidebarTitle}>Отделы агента</h2>
            {canManage ? (
              <button
                type="button"
                className={styles.addBtn}
                title="Создать отдел"
                onClick={() => setShowCreateDept(true)}
              >
                <Plus size={16} />
              </button>
            ) : null}
          </div>
          {departments.isLoading ? (
            <div className={styles.empty}>Загрузка отделов…</div>
          ) : !departments.data?.length ? (
            <div className={styles.empty}>
              {canManage ? "Создайте первый отдел и привяжите базу знаний." : "Отделы ещё не созданы."}
            </div>
          ) : (
            <div className={styles.deptList}>
              {departments.data.map((dept) => (
                <DeptButton
                  key={dept.id}
                  dept={dept}
                  active={dept.id === selectedDeptId}
                  onSelect={() => setSelectedDeptId(dept.id)}
                />
              ))}
            </div>
          )}
        </aside>

        <section className={styles.main}>
          <div className={styles.toolbar}>
            <FormSearchInput
              value={cardSearch}
              onChange={setCardSearch}
              placeholder="Поиск по коду или наименованию"
            />
          </div>
          {cards.isLoading ? (
            <div className={styles.empty}>Загрузка карточек…</div>
          ) : !selectedDeptId ? (
            <div className={styles.empty}>Выберите отдел слева.</div>
          ) : !cards.data?.items.length ? (
            <div className={styles.empty}>Карточки документов пока не созданы для этого отдела.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Код</th>
                    <th>Наименование</th>
                    <th>Вид</th>
                    <th>Уровень СМК</th>
                    <th>Статус</th>
                    <th>Версия</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.data.items.map((card) => (
                    <tr key={card.id}>
                      <td>
                        <button type="button" className={styles.rowBtn} onClick={() => openCardEditor(card)}>
                          {card.document_code || "—"}
                        </button>
                      </td>
                      <td>{card.document_name || "—"}</td>
                      <td>{card.document_type ? documentTypeLabels[card.document_type] : "—"}</td>
                      <td>{card.qms_level ? qmsLevelLabels[card.qms_level] : "—"}</td>
                      <td>{statusLabels[card.status]}</td>
                      <td>{card.version || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showCreateDept ? (
        <div className={styles.modalBackdrop} onClick={() => setShowCreateDept(false)}>
          <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleCreateDepartment}>
            <h2>Новый отдел агента</h2>
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label htmlFor="dept-name">Название отдела</label>
                <input
                  id="dept-name"
                  className={formStyles.control}
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  required
                />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label htmlFor="dept-desc">Описание</label>
                <textarea
                  id="dept-desc"
                  className={formStyles.control}
                  rows={2}
                  value={newDeptDescription}
                  onChange={(e) => setNewDeptDescription(e.target.value)}
                />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label>Базы знаний (минимум одна)</label>
                <div className={styles.kbList}>
                  {accessibleKbs.map((kb) => (
                    <label key={kb.id} className={styles.kbOption}>
                      <input
                        type="checkbox"
                        checked={selectedKbIds.includes(kb.id)}
                        onChange={(e) => {
                          setSelectedKbIds((current) =>
                            e.target.checked ? [...current, kb.id] : current.filter((id) => id !== kb.id)
                          );
                        }}
                      />
                      <span>
                        {kb.name}
                        <span className={styles.deptMeta}> · {kb.sources_count} источников</span>
                      </span>
                    </label>
                  ))}
                  {!accessibleKbs.length ? (
                    <span className={styles.deptMeta}>Нет доступных баз знаний.</span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowCreateDept(false)}>
                Отмена
              </button>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={createDepartment.isPending || !newDeptName.trim() || selectedKbIds.length === 0}
              >
                {createDepartment.isPending ? "Создаём…" : "Создать"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingCard ? (
        <div className={styles.modalBackdrop} onClick={() => setEditingCard(null)}>
          <form
            className={`${styles.modal} ${styles.modalWide}`}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveCard}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>Карточка документа</h2>
              <button type="button" className={styles.addBtn} onClick={() => setEditingCard(null)} aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>

            <p className={styles.sectionTitle}>Основное</p>
            <div className={styles.formGrid}>
              <TextField label="Код документа" value={cardForm.document_code ?? ""} onChange={(v) => setCardForm((f) => ({ ...f, document_code: v }))} />
              <TextField label="Наименование" value={cardForm.document_name ?? ""} onChange={(v) => setCardForm((f) => ({ ...f, document_name: v }))} />
              <SelectField
                label="Вид документа"
                value={cardForm.document_type ?? ""}
                options={documentTypeOptions}
                onChange={(v) => setCardForm((f) => ({ ...f, document_type: (v || null) as NdDocumentType | null }))}
              />
              <SelectField
                label="Уровень в СМК"
                value={cardForm.qms_level ?? ""}
                options={qmsLevelOptions}
                onChange={(v) => setCardForm((f) => ({ ...f, qms_level: (v || null) as NdQmsLevel | null }))}
              />
              <TextField label="Версия" value={cardForm.version ?? ""} onChange={(v) => setCardForm((f) => ({ ...f, version: v }))} />
              <SelectField
                label="Статус"
                value={cardForm.status ?? "draft"}
                options={statusOptions}
                onChange={(v) => setCardForm((f) => ({ ...f, status: v as NdDocumentCardStatus }))}
              />
              <TextField
                label="Дата утверждения"
                type="date"
                value={cardForm.approval_date ?? ""}
                onChange={(v) => setCardForm((f) => ({ ...f, approval_date: v || null }))}
              />
              <TextField
                label="Дата введения"
                type="date"
                value={cardForm.effective_date ?? ""}
                onChange={(v) => setCardForm((f) => ({ ...f, effective_date: v || null }))}
              />
            </div>

            <p className={styles.sectionTitle}>Участники</p>
            <div className={styles.formGrid}>
              <TextField label="Владелец процесса" value={cardForm.process_owner ?? ""} onChange={(v) => setCardForm((f) => ({ ...f, process_owner: v }))} />
              <TextField label="Разработчик" value={cardForm.author ?? ""} onChange={(v) => setCardForm((f) => ({ ...f, author: v }))} />
              <TextField label="Проверивший" value={cardForm.reviewer ?? ""} onChange={(v) => setCardForm((f) => ({ ...f, reviewer: v }))} />
              <TextField label="Утвердивший" value={cardForm.approver ?? ""} onChange={(v) => setCardForm((f) => ({ ...f, approver: v }))} />
              <TextField label="Подразделение-владелец" value={cardForm.owner_department ?? ""} onChange={(v) => setCardForm((f) => ({ ...f, owner_department: v }))} />
              <SelectField
                label="Конфиденциальность"
                value={cardForm.confidentiality_level ?? ""}
                options={confidentialityOptions}
                onChange={(v) =>
                  setCardForm((f) => ({ ...f, confidentiality_level: (v || null) as NdConfidentialityLevel | null }))
                }
              />
              <div className={styles.formGridFull}>
                <TextAreaField
                  label="Область применения"
                  value={cardForm.scope ?? ""}
                  onChange={(v) => setCardForm((f) => ({ ...f, scope: v }))}
                />
              </div>
            </div>

            <p className={styles.sectionTitle}>Связи</p>
            <div className={styles.formGrid}>
              <TextAreaField
                label="Связанные процессы (по строке)"
                value={joinLines(cardForm.related_processes)}
                onChange={(v) => setCardForm((f) => ({ ...f, related_processes: parseLines(v) }))}
              />
              <TextAreaField
                label="Связанные подразделения"
                value={joinLines(cardForm.related_departments)}
                onChange={(v) => setCardForm((f) => ({ ...f, related_departments: parseLines(v) }))}
              />
              <TextAreaField
                label="Связанные документы"
                value={joinLines(cardForm.related_documents)}
                onChange={(v) => setCardForm((f) => ({ ...f, related_documents: parseLines(v) }))}
              />
              <TextAreaField
                label="Нормативные ссылки"
                value={joinLines(cardForm.normative_references)}
                onChange={(v) => setCardForm((f) => ({ ...f, normative_references: parseLines(v) }))}
              />
              <TextAreaField
                label="Формы записей"
                value={joinLines(cardForm.record_forms)}
                onChange={(v) => setCardForm((f) => ({ ...f, record_forms: parseLines(v) }))}
              />
              <TextAreaField
                label="Ознакомление (должности)"
                value={joinLines(cardForm.acknowledgement_targets)}
                onChange={(v) => setCardForm((f) => ({ ...f, acknowledgement_targets: parseLines(v) }))}
              />
            </div>

            <p className={styles.sectionTitle}>Хранение</p>
            <div className={styles.formGrid}>
              <TextField label="Срок хранения" value={cardForm.retention_period ?? ""} onChange={(v) => setCardForm((f) => ({ ...f, retention_period: v }))} />
              <TextField
                label="Место хранения оригинала"
                value={cardForm.original_storage_location ?? ""}
                onChange={(v) => setCardForm((f) => ({ ...f, original_storage_location: v }))}
              />
              <TextField
                label="Электронная версия"
                value={cardForm.electronic_storage_location ?? ""}
                onChange={(v) => setCardForm((f) => ({ ...f, electronic_storage_location: v }))}
              />
              <TextAreaField
                label="Файлы"
                value={joinLines(cardForm.attachments)}
                onChange={(v) => setCardForm((f) => ({ ...f, attachments: parseLines(v) }))}
              />
              <TextAreaField
                label="Архивные версии"
                value={joinLines(cardForm.archived_versions)}
                onChange={(v) => setCardForm((f) => ({ ...f, archived_versions: parseLines(v) }))}
              />
              <label className={styles.kbOption}>
                <input
                  type="checkbox"
                  checked={Boolean(cardForm.has_process_diagram)}
                  onChange={(e) => setCardForm((f) => ({ ...f, has_process_diagram: e.target.checked }))}
                />
                Есть блок-схема процесса
              </label>
              <label className={styles.kbOption}>
                <input
                  type="checkbox"
                  checked={Boolean(cardForm.has_acknowledgement_sheet)}
                  onChange={(e) => setCardForm((f) => ({ ...f, has_acknowledgement_sheet: e.target.checked }))}
                />
                Есть лист ознакомления
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setEditingCard(null)}>
                Отмена
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={updateCard.isPending}>
                {updateCard.isPending ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function DeptButton({
  dept,
  active,
  onSelect
}: {
  dept: NdControlDepartment;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.deptItem} ${active ? styles.deptItemActive : ""}`}
      onClick={onSelect}
    >
      <span className={styles.deptName}>{dept.name}</span>
      <span className={styles.deptMeta}>
        {dept.knowledge_bases_count} баз · {dept.cards_count} карточек
      </span>
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <input className={formStyles.control} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <textarea className={formStyles.control} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: { value: T; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <select className={formStyles.control} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
