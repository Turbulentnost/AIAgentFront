import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Database, FileText, Info, X } from "lucide-react";
import { FormSearchInput } from "@/components/form-controls";
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
    if (!query) return knowledgeBases;
    return knowledgeBases.filter((kb) => {
      const haystack = `${kb.name} ${kb.description ?? ""} ${kb.topic ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [kbSearch, knowledgeBases]);

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
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.leftColumn}>
            <div className={styles.field}>
              <label htmlFor="create-dept-name">
                Название отдела <span className={styles.required}>*</span>
              </label>
              <input
                id="create-dept-name"
                className={formStyles.control}
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="тестовый отдел 1"
                autoFocus
                required
              />
            </div>

            <div className={styles.infoCallout}>
              <Info size={18} strokeWidth={2} aria-hidden="true" />
              <p>
                Введите название и выберите базы знаний справа. Можно отметить несколько карточек — документы
                подтянутся из всех выбранных баз.
              </p>
            </div>

            <div className={styles.selectedCounter}>
              <span>Выбрано баз</span>
              <strong>{selectedKbIds.length}</strong>
            </div>
          </section>

          <section className={styles.rightColumn}>
            <div className={styles.kbPanelHead}>
              <div>
                <h3>Базы знаний</h3>
                <p>Нажмите на карточку, чтобы прикрепить или открепить базу</p>
              </div>
              <span className={styles.kbCounter}>
                {selectedKbIds.length}/{knowledgeBases.length}
              </span>
            </div>

            <FormSearchInput
              className={styles.kbSearch}
              value={kbSearch}
              onChange={setKbSearch}
              placeholder="Поиск по названию или тематике"
            />

            {!knowledgeBases.length ? (
              <p className={styles.kbEmpty}>Нет доступных баз знаний.</p>
            ) : !filteredKbs.length ? (
              <p className={styles.kbEmpty}>По запросу ничего не найдено.</p>
            ) : (
              <ul className={styles.kbCardGrid}>
                {filteredKbs.map((kb, index) => {
                  const selected = selectedKbIds.includes(kb.id);
                  const { Icon, tone } = kbIconOptions[index % kbIconOptions.length];
                  const status = getKbStatusPresentation(kb);
                  return (
                    <li key={kb.id}>
                      <button
                        type="button"
                        className={`${styles.kbCard} ${selected ? styles.kbCardSelected : ""}`}
                        aria-pressed={selected}
                        onClick={() => toggleKb(kb.id)}
                      >
                        <span className={`${styles.kbCardCheck} ${selected ? styles.kbCardCheckSelected : ""}`}>
                          {selected ? <Check size={14} strokeWidth={2.8} /> : null}
                        </span>
                        <span className={`${styles.kbIcon} ${styles[`kbIcon_${tone}`]}`}>
                          <Icon size={18} strokeWidth={2} aria-hidden="true" />
                        </span>
                        <span className={styles.kbCardBody}>
                          <span className={styles.kbCardTop}>
                            <strong>{kb.name}</strong>
                            <span className={`${styles.kbStatus} ${styles[`kbStatus_${status.tone}`]}`}>
                              {status.label}
                            </span>
                          </span>
                          <span className={styles.kbDocCount}>{formatDocCount(kb.sources_count)}</span>
                          <span className={styles.kbCardDesc}>
                            {kb.description || kb.topic || "Описание не задано"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={isSubmitting}>
            Отмена
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={!canSubmit}>
            {isSubmitting ? "Создаём…" : "Создать отдел"}
          </button>
        </footer>
      </form>
    </div>
  );
}
