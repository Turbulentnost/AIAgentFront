import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Database, FileText, Info, Search, X } from "lucide-react";
import { FormCheckbox } from "@/components/form-controls";
import formStyles from "@/components/form-controls/form-controls.module.css";
import type { KnowledgeBaseListItem, KnowledgeBaseStatus } from "@/types";
import styles from "./CreateDepartmentModal.module.css";

const kbStatusLabels: Partial<Record<KnowledgeBaseStatus, string>> = {
  draft: "Предварительная",
  processing: "Индексация",
  needs_review: "Требует проверки",
  ready: "Готова",
  updating: "Индексация",
  error: "Ошибка",
  archived: "Архив"
};

const kbIconOptions = [
  { Icon: Database, tone: "purple" as const },
  { Icon: FileText, tone: "blue" as const },
  { Icon: BookOpen, tone: "green" as const }
];

function getKbStatusPresentation(kb: KnowledgeBaseListItem) {
  if (kb.indexing_active || kb.status === "processing" || kb.status === "updating") {
    return { label: "Индексация", tone: "indexing" as const };
  }
  if (kb.status === "ready") {
    return { label: "Готова", tone: "ready" as const };
  }
  if (kb.status === "draft") {
    return { label: "Предварительная", tone: "draft" as const };
  }
  return {
    label: kbStatusLabels[kb.status] ?? kb.status,
    tone: kb.status === "needs_review" ? ("draft" as const) : ("neutral" as const)
  };
}

function formatDocCount(count: number) {
  return `${new Intl.NumberFormat("ru-RU").format(count)} док.`;
}

type CreateDepartmentModalProps = {
  open: boolean;
  name: string;
  selectedKbIds: string[];
  knowledgeBases: KnowledgeBaseListItem[];
  isSubmitting: boolean;
  onNameChange: (value: string) => void;
  onSelectedKbIdsChange: (ids: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function CreateDepartmentModal({
  open,
  name,
  selectedKbIds,
  knowledgeBases,
  isSubmitting,
  onNameChange,
  onSelectedKbIdsChange,
  onClose,
  onSubmit
}: CreateDepartmentModalProps) {
  const [kbSearch, setKbSearch] = useState("");

  useEffect(() => {
    if (!open) setKbSearch("");
  }, [open]);

  const filteredKbs = useMemo(() => {
    const query = kbSearch.trim().toLowerCase();
    const list = knowledgeBases.filter((kb) => {
      if (!query) return true;
      const haystack = `${kb.name} ${kb.description ?? ""} ${kb.topic ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
    return [...list].sort((a, b) => {
      const aSelected = selectedKbIds.includes(a.id);
      const bSelected = selectedKbIds.includes(b.id);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
    });
  }, [kbSearch, knowledgeBases, selectedKbIds]);

  const toggleKb = (kbId: string) => {
    if (selectedKbIds.includes(kbId)) {
      onSelectedKbIdsChange(selectedKbIds.filter((id) => id !== kbId));
      return;
    }
    onSelectedKbIdsChange([...selectedKbIds, kbId]);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || selectedKbIds.length === 0 || isSubmitting) return;
    onSubmit();
  };

  if (!open) return null;

  const canSubmit = Boolean(name.trim()) && selectedKbIds.length > 0 && !isSubmitting;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <form className={styles.modal} onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2>Создать отдел</h2>
            <p>Быстро добавьте отдел агента и привяжите базы знаний с нормативными документами.</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.summaryBlock} aria-label="Данные отдела">
            <label className={styles.field} htmlFor="create-dept-name">
              <span className={styles.fieldLabel}>
                <span className={styles.fieldLabelText}>Название отдела</span>
                <span className={styles.required} aria-hidden="true">
                  *
                </span>
              </span>
              <div className={styles.fieldControl}>
                <input
                  id="create-dept-name"
                  className={formStyles.control}
                  value={name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder="Например: Отдел качества"
                  autoFocus
                  required
                />
              </div>
            </label>

            <div className={styles.infoCallout}>
              <Info size={18} strokeWidth={2.1} aria-hidden="true" />
              <p>
                Введите название и выберите базы знаний справа. Можно отметить несколько карточек — документы
                подтянутся из всех выбранных баз.
              </p>
            </div>

            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Выбрано баз</span>
              <span className={styles.summaryValue}>{selectedKbIds.length}</span>
            </div>
          </section>

          <section className={`${styles.summaryBlock} ${styles.widgetPanel}`} aria-label="Выбор баз знаний">
            <div className={styles.widgetHead}>
              <div className={styles.widgetHeadText}>
                <h3 className={styles.summaryBlockTitle}>Базы знаний</h3>
                <p>Нажмите на карточку, чтобы прикрепить или открепить базу</p>
              </div>
              <span className={styles.statusBadge}>
                {selectedKbIds.length} / {knowledgeBases.length}
              </span>
            </div>

            <label className={styles.field} htmlFor="create-dept-kb-search">
              <span className={styles.fieldLabel}>
                <span className={styles.fieldLabelText}>Поиск баз знаний</span>
              </span>
              <div className={`${formStyles.selectField} ${styles.fieldControl}`}>
                <Search className={formStyles.selectSearch} size={16} strokeWidth={2} aria-hidden="true" />
                <input
                  id="create-dept-kb-search"
                  className={formStyles.control}
                  type="search"
                  value={kbSearch}
                  placeholder="Поиск по названию или тематике"
                  onChange={(event) => setKbSearch(event.target.value)}
                />
              </div>
            </label>

            {filteredKbs.length ? (
              <ul className={styles.widgetGrid}>
                {filteredKbs.map((kb, index) => {
                  const selected = selectedKbIds.includes(kb.id);
                  const { Icon, tone } = kbIconOptions[index % kbIconOptions.length];
                  const status = getKbStatusPresentation(kb);
                  return (
                    <li key={kb.id}>
                      <div
                        className={`${styles.kbWidget} ${selected ? styles.kbWidgetSelected : ""}`}
                        tabIndex={0}
                        onClick={() => toggleKb(kb.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleKb(kb.id);
                          }
                        }}
                      >
                        <span className={styles.kbWidgetAside}>
                          <span className={`${styles.kbWidgetIcon} ${styles[`kbWidgetIcon_${tone}`]}`}>
                            <Icon size={18} strokeWidth={2} aria-hidden="true" />
                          </span>
                          <span
                            className={styles.kbWidgetCheckboxWrap}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <FormCheckbox
                              checked={selected}
                              onChange={(checked) => {
                                if (checked !== selected) toggleKb(kb.id);
                              }}
                              aria-label={`Выбрать базу знаний ${kb.name}`}
                              className={styles.kbWidgetCheckbox}
                            />
                          </span>
                        </span>
                        <span className={styles.kbWidgetBody}>
                          <span className={styles.kbWidgetTop}>
                            <strong>{kb.name}</strong>
                            <span className={`${styles.kbStatus} ${styles[`kbStatus_${status.tone}`]}`}>
                              {status.label}
                            </span>
                          </span>
                          <span className={styles.kbWidgetMeta}>{formatDocCount(kb.sources_count)}</span>
                          <span className={styles.kbWidgetDesc}>
                            {kb.description || kb.topic || "Описание не задано"}
                          </span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className={styles.widgetEmpty}>
                {knowledgeBases.length
                  ? "Ничего не найдено по вашему запросу."
                  : "Нет доступных баз знаний для прикрепления."}
              </div>
            )}

            {!selectedKbIds.length ? (
              <p className={styles.widgetHint} role="status">
                Выберите хотя бы одну базу знаний.
              </p>
            ) : null}
          </section>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.navBackButton} onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className={styles.navNextButton} disabled={!canSubmit}>
            {isSubmitting ? "Создаём…" : "Создать отдел"}
          </button>
        </footer>
      </form>
    </div>
  );
}
