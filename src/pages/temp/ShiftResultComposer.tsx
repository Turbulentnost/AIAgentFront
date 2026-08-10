import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Loader2, Sparkles } from "lucide-react";
import { agentsApi } from "@/api/endpoints";
import styles from "./ShiftResultComposer.module.css";

export type ShiftResultComposerContext = {
  taskType: string;
  problem: string;
  solution: string;
  nomenclature: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  context: ShiftResultComposerContext;
  disabled?: boolean;
  invalid?: boolean;
  rows?: number;
  compact?: boolean;
  placeholder?: string;
};

const PAUSE_MS = 650;

function ghostSuffixFor(draft: string, suggestion: string): string | null {
  if (!suggestion) return null;
  if (!draft) return suggestion;
  if (!suggestion.startsWith(draft)) return null;
  const suffix = suggestion.slice(draft.length);
  return suffix || null;
}

export default function ShiftResultComposer({
  value,
  onChange,
  onBlur,
  context,
  disabled = false,
  invalid = false,
  rows = 5,
  compact = false,
  placeholder = "Что сделали: звонок, дата, подтверждение, номер документа…",
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const disabledRef = useRef(disabled);
  const draftSnapshotRef = useRef("");
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const focusedRef = useRef(false);
  const [draft, setDraft] = useState(value);
  const [assistActive, setAssistActive] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [ghostVisible, setGhostVisible] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  const ghostSuffix = useMemo(() => {
    if (!assistActive || !ghostVisible || !suggestion) return null;
    return ghostSuffixFor(draft, suggestion);
  }, [assistActive, draft, ghostVisible, suggestion]);

  const clearAssist = useCallback(() => {
    setAssistActive(false);
    setSuggestion(null);
    setGhostVisible(false);
    setSuggestError(null);
    draftSnapshotRef.current = "";
  }, []);

  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled) clearAssist();
  }, [clearAssist, disabled]);

  const restoreFocus = useCallback(() => {
    const textarea = textareaRef.current;
    const selection = selectionRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    if (selection) {
      textarea.setSelectionRange(selection.start, selection.end);
    }
  }, []);

  const rememberSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    selectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }, []);

  const requestSuggestion = useCallback(
    async (draft: string) => {
      if (disabledRef.current) return;
      setSuggestLoading(true);
      setSuggestError(null);
      rememberSelection();

      try {
        const response = await agentsApi.suggestShiftAssignmentResult({
          taskType: context.taskType,
          problem: context.problem,
          solution: context.solution,
          nomenclature: context.nomenclature,
          draft,
        });
        const nextSuggestion = response.suggestion.trim();
        if (disabledRef.current) return;
        if (!nextSuggestion) {
          setSuggestError("LM Studio не вернула текст подсказки.");
          return;
        }
        if (draft && !nextSuggestion.startsWith(draft)) {
          setSuggestError("Подсказка не совпала с вашим текстом. Попробуйте ещё раз.");
          return;
        }
        draftSnapshotRef.current = draft;
        setSuggestion(nextSuggestion);
        setAssistActive(true);
        setGhostVisible(true);
      } catch (err) {
        if (!disabledRef.current) {
          setSuggestError(err instanceof Error ? err.message : "Не удалось получить подсказку");
        }
      } finally {
        setSuggestLoading(false);
        restoreFocus();
      }
    },
    [context.nomenclature, context.problem, context.solution, context.taskType, rememberSelection, restoreFocus],
  );

  useEffect(() => {
    if (!assistActive || suggestLoading || disabled || !suggestion) {
      if (!suggestion) setGhostVisible(false);
      return undefined;
    }

    const suffix = ghostSuffixFor(draft, suggestion);
    if (!suffix) {
      setGhostVisible(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setGhostVisible(true), PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [assistActive, disabled, draft, suggestLoading, suggestion]);

  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return;
    const next = suggestion.trim();
    setDraft(next);
    onChange(next);
    clearAssist();
  }, [clearAssist, onChange, suggestion]);

  const syncMirrorScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return;
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
  }, []);

  const handleChange = (next: string) => {
    setDraft(next);
    onChange(next);
    if (!assistActive || !suggestion) return;
    setGhostVisible(false);
    if (!suggestion.startsWith(next)) {
      clearAssist();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Tab" && ghostSuffix && !event.shiftKey) {
      event.preventDefault();
      acceptSuggestion();
      return;
    }
    if (event.key === "Escape" && assistActive) {
      event.preventDefault();
      clearAssist();
    }
  };

  const handleAiButtonMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    rememberSelection();
  };

  const handleSuggest = async () => {
    if (disabled || suggestLoading) return;

    if (assistActive) {
      clearAssist();
      restoreFocus();
      return;
    }

    await requestSuggestion(draft);
  };

  const showGhost = Boolean(ghostSuffix);

  return (
    <div className={styles.composer}>
      <div className={styles.textareaWrap}>
        {showGhost ? (
          <div
            ref={mirrorRef}
            className={`${styles.mirror} ${compact ? styles.mirrorCompact : ""}`}
            aria-hidden
          >
            <span className={styles.committed}>{draft}</span>
            <span className={styles.ghost}>{ghostSuffix}</span>
            <span className={styles.tabHint}> · Tab ↹</span>
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          className={`${styles.textarea} ${compact ? styles.textareaCompact : ""} ${
            showGhost ? styles.textareaWithGhost : ""
          } ${invalid ? styles.textareaInvalid : ""}`}
          value={draft}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          onFocus={() => {
            focusedRef.current = true;
          }}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={(event) => {
            focusedRef.current = false;
            onBlur?.(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          onScroll={syncMirrorScroll}
        />
        <button
          type="button"
          className={`${styles.aiBtn} ${suggestLoading ? styles.aiBtnActive : ""} ${
            assistActive ? styles.aiBtnOn : ""
          }`}
          onMouseDown={handleAiButtonMouseDown}
          onClick={() => void handleSuggest()}
          disabled={disabled || suggestLoading}
          title={
            assistActive
              ? "Выключить подсказку LM Studio"
              : "Подсказка формулировки от LM Studio"
          }
          aria-label={
            assistActive
              ? "Выключить подсказку LM Studio"
              : "Подсказка формулировки от LM Studio"
          }
          aria-pressed={assistActive}
        >
          {suggestLoading ? (
            <Loader2 size={16} strokeWidth={2.2} className={styles.aiSpinner} aria-hidden />
          ) : (
            <Sparkles size={16} strokeWidth={2.2} aria-hidden />
          )}
        </button>
      </div>
      {suggestError ? <p className={styles.suggestError}>{suggestError}</p> : null}
    </div>
  );
}
