import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Database, FileText, Plus, Search, X } from "lucide-react";
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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setKbSearch("");
      setSuggestionsOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [suggestionsOpen]);

  const selectedKbs = useMemo(
    () =>
      selectedKbIds
        .map((id) => knowledgeBases.find((kb) => kb.id === id))
        .filter((kb): kb is KnowledgeBaseListItem => Boolean(kb)),
    [knowledgeBases, selectedKbIds]
  );

  const addableKbs = useMemo(() => {
    const query = kbSearch.trim().toLowerCase();
    return knowledgeBases.filter((kb) => {
      if (selectedKbIds.includes(kb.id)) return false;
      if (!query) return true;
      const haystack = `${kb.name} ${kb.description ?? ""} ${kb.topic ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [kbSearch, knowledgeBases, selectedKbIds]);

  const addKb = (kbId: string) => {
    if (selectedKbIds.includes(kbId)) return;
    onSelectedKbIdsChange([...selectedKbIds, kbId]);
    setKbSearch("");
    setSuggestionsOpen(false);
  };

  const removeKb = (kbId: string) => {
    onSelectedKbIdsChange(selectedKbIds.filter((id) => id !== kbId));
  };

  const handleAddFromSearch = () => {
    const first = addableKbs[0];
    if (first) addKb(first.id);
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
          <h2>Создать отдел</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label htmlFor="create-dept-name">Название отдела</label>
            <input
              id="create-dept-name"
              className={formStyles.control}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Введите название отдела"
              autoFocus
              required
            />
          </div>

          <div className={styles.field}>
            <div className={styles.kbHead}>
              <label htmlFor="create-dept-kb-search">Базы знаний</label>
              <span className={styles.kbHint}>Можно прикрепить несколько баз знаний</span>
            </div>

            <div className={styles.kbPicker} ref={pickerRef}>
              <div className={styles.kbSearchRow}>
                <div className={`${formStyles.selectField} ${styles.kbSearchField}`}>
                  <Search className={formStyles.selectSearch} size={16} strokeWidth={2} aria-hidden="true" />
                  <input
                    id="create-dept-kb-search"
                    className={formStyles.control}
                    type="search"
                    value={kbSearch}
                    placeholder="Добавить базу знаний"
                    onChange={(event) => {
                      setKbSearch(event.target.value);
                      setSuggestionsOpen(true);
                    }}
                    onFocus={() => setSuggestionsOpen(true)}
                  />
                </div>
                <button
                  type="button"
                  className={styles.kbAddBtn}
                  aria-label="Добавить базу знаний"
                  disabled={!addableKbs.length}
                  onClick={handleAddFromSearch}
                >
                  <Plus size={18} strokeWidth={2.2} />
                </button>
              </div>

              {suggestionsOpen && addableKbs.length ? (
                <ul className={styles.kbSuggestions} role="listbox">
                  {addableKbs.slice(0, 6).map((kb) => (
                    <li key={kb.id}>
                      <button type="button" role="option" onClick={() => addKb(kb.id)}>
                        <span className={styles.suggestionTitle}>{kb.name}</span>
                        <span className={styles.suggestionMeta}>
                          {formatDocCount(kb.sources_count)} · {getKbStatusPresentation(kb).label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {selectedKbs.length ? (
              <ul className={styles.kbSelectedList}>
                {selectedKbs.map((kb, index) => {
                  const { Icon, tone } = kbIconOptions[index % kbIconOptions.length];
                  const status = getKbStatusPresentation(kb);
                  return (
                    <li key={kb.id} className={styles.kbSelectedCard}>
                      <span className={`${styles.kbIcon} ${styles[`kbIcon_${tone}`]}`}>
                        <Icon size={18} strokeWidth={2} aria-hidden="true" />
                      </span>
                      <div className={styles.kbSelectedBody}>
                        <div className={styles.kbSelectedTop}>
                          <strong>{kb.name}</strong>
                          <span className={`${styles.kbStatus} ${styles[`kbStatus_${status.tone}`]}`}>
                            {status.label}
                          </span>
                        </div>
                        <p>{kb.description || kb.topic || "Описание не задано"}</p>
                        <span className={styles.kbDocCount}>{formatDocCount(kb.sources_count)}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.kbRemoveBtn}
                        aria-label={`Убрать ${kb.name}`}
                        onClick={() => removeKb(kb.id)}
                      >
                        <X size={16} strokeWidth={2} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.kbEmpty}>
                {knowledgeBases.length ? "Выберите хотя бы одну базу знаний." : "Нет доступных баз знаний."}
              </p>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
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
