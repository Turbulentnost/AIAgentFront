import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { agentBuilderApi } from "@/api/endpoints";
import WorkflowGraphView from "@/components/WorkflowGraphView";
import SandboxTrace from "@/components/SandboxTrace";
import type {
  AgentBuilderSession,
  AgentBuilderSessionDetail,
  AgentType,
  SandboxRun
} from "@/types";
import styles from "./AgentBuilder.module.css";

const AGENT_TYPE_OPTIONS: Array<{ value: AgentType; label: string; disabled?: boolean }> = [
  { value: "consultant", label: "Консультант" },
  { value: "action", label: "Действие", disabled: true }
];

function agentTypeLabel(value: string | null | undefined): string {
  if (value === "consultant") return "Консультант";
  if (value === "action") return "Действие";
  return "—";
}

function resolveProposedAgentType(detail: AgentBuilderSessionDetail | undefined): AgentType | null {
  const fromProposal = detail?.agent_type_proposal?.proposed_agent_type;
  if (fromProposal === "consultant" || fromProposal === "action") return fromProposal;
  if (detail?.agent_type === "consultant" || detail?.agent_type === "action") return detail.agent_type;
  if (detail?.current_stage === "classify_agent_type") return "consultant";
  return null;
}

const stepClass: Record<string, string> = {
  pending: styles.stepPending,
  running: styles.stepRunning,
  completed: styles.stepCompleted,
  failed: styles.stepFailed,
  skipped: styles.stepPending
};

export default function AgentBuilder() {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>("consultant");
  const [testQuery, setTestQuery] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["agent-builder", "sessions"],
    queryFn: agentBuilderApi.listSessions
  });

  const sessionQuery = useQuery({
    queryKey: ["agent-builder", "session", selectedSessionId],
    queryFn: () => agentBuilderApi.getSession(selectedSessionId!),
    enabled: Boolean(selectedSessionId)
  });

  const detail: AgentBuilderSessionDetail | undefined = sessionQuery.data;

  useEffect(() => {
    if (!detail?.id) return;
    setChat(buildChatFromDetail(detail));
  }, [detail?.id, detail?.updated_at, detail?.collected_requirements]);

  const proposedAgentType = resolveProposedAgentType(detail);

  useEffect(() => {
    const nextType = detail?.agent_type ?? detail?.agent_type_proposal?.proposed_agent_type ?? proposedAgentType;
    if (nextType === "consultant" || nextType === "action") {
      setSelectedAgentType(nextType);
    }
  }, [detail?.id, detail?.agent_type, detail?.agent_type_proposal?.proposed_agent_type, proposedAgentType]);

  const createMutation = useMutation({
    mutationFn: () => agentBuilderApi.createSession({ goal: goal.trim() }),
    onSuccess: async (session) => {
      setSelectedSessionId(session.id);
      setGoal("");
      setChat([]);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["agent-builder", "sessions"] });
    },
    onError: (err) => setError(extractError(err))
  });

  const startMutation = useMutation({
    mutationFn: (sessionId: string) => agentBuilderApi.startSession(sessionId),
    onSuccess: (data) => {
      setError(null);
      applyDetailMessages(data);
      queryClient.setQueryData(["agent-builder", "session", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["agent-builder"] });
    },
    onError: (err) => setError(extractError(err))
  });

  const messageMutation = useMutation({
    mutationFn: ({ sessionId, text }: { sessionId: string; text: string }) =>
      agentBuilderApi.sendMessage(sessionId, { message: text }),
    onMutate: ({ text }) => {
      setChat((prev) => [...prev, { role: "user", text }]);
    },
    onSuccess: (data) => {
      setMessage("");
      setError(null);
      setChat(buildChatFromDetail(data));
      queryClient.setQueryData(["agent-builder", "session", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["agent-builder"] });
    },
    onError: (err) => setError(extractError(err))
  });

  const approveMutation = useMutation({
    mutationFn: (sessionId: string) => agentBuilderApi.approveBlueprint(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-builder"] }),
    onError: (err) => setError(extractError(err))
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => agentBuilderApi.deleteSession(sessionId),
    onSuccess: async (_data, sessionId) => {
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setChat([]);
      }
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["agent-builder"] });
    },
    onError: (err) => setError(extractError(err))
  });

  const regenerateMutation = useMutation({
    mutationFn: (sessionId: string) => agentBuilderApi.regenerate(sessionId),
    onSuccess: (data) => {
      setChat([]);
      applyDetailMessages(data);
      queryClient.invalidateQueries({ queryKey: ["agent-builder"] });
    },
    onError: (err) => setError(extractError(err))
  });

  const previewMutation = useMutation({
    mutationFn: (sessionId: string) => agentBuilderApi.runPreview(sessionId),
    onSuccess: (data) => {
      setError(null);
      setChat(buildChatFromDetail(data));
      queryClient.setQueryData(["agent-builder", "session", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["agent-builder"] });
    },
    onError: (err) => setError(extractError(err))
  });

  const sandboxQuery = useQuery({
    queryKey: ["agent-builder", "sandbox", selectedSessionId],
    queryFn: () => agentBuilderApi.getLatestSandboxRun(selectedSessionId!),
    enabled: Boolean(selectedSessionId) && Boolean(detail?.blueprint),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "pending" ? 1500 : false;
    }
  });

  const sandboxRun: SandboxRun | null = sandboxQuery.data ?? null;
  const sandboxRunning = sandboxRun?.status === "running" || sandboxRun?.status === "pending";

  const startSandboxMutation = useMutation({
    mutationFn: ({ sessionId, testQuery }: { sessionId: string; testQuery: string }) =>
      agentBuilderApi.startSandboxRun(sessionId, { test_query: testQuery || null }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(["agent-builder", "sandbox", data.session_id], data);
      queryClient.invalidateQueries({ queryKey: ["agent-builder", "sandbox", data.session_id] });
    },
    onError: (err) => setError(extractError(err))
  });

  const isThinking =
    startMutation.isPending ||
    messageMutation.isPending ||
    regenerateMutation.isPending ||
    previewMutation.isPending;

  const canApprove = useMemo(() => {
    const status = detail?.blueprint?.status;
    const previewOk = detail?.preview_result?.success === true && Boolean(detail.preview_result.output_text);
    const sandboxOk = sandboxRun?.status === "succeeded";
    return (previewOk || sandboxOk) && (status === "generated" || status === "needs_user_review");
  }, [detail?.blueprint?.status, detail?.preview_result, sandboxRun?.status]);

  const needsClarification = detail?.status === "needs_clarification";
  const typeConfirmed = Boolean(detail?.agent_type) || Boolean(detail?.agent_type_proposal?.confirmed);
  const showAgentTypePanel = Boolean(
    selectedSessionId &&
      (detail?.agent_type ||
        detail?.agent_type_proposal?.proposed_agent_type ||
        detail?.current_stage === "classify_agent_type")
  );
  const showTypeConfirmation =
    showAgentTypePanel && needsClarification && !typeConfirmed;
  const requirementsComplete = detail?.requirements_validation?.valid === true;
  const showRequiredElements =
    needsClarification &&
    typeConfirmed &&
    !requirementsComplete &&
    (detail?.required_elements?.length ?? 0) > 0;
  const showClarifyingQuestions =
    needsClarification && !isThinking && !showTypeConfirmation && (detail?.clarifying_questions?.length ?? 0) > 0;
  const hasBlueprint = Boolean(detail?.blueprint);
  const inputDisabled =
    !selectedSessionId || isThinking || detail?.status === "needs_user_review" || detail?.status === "approved";

  function applyDetailMessages(data: AgentBuilderSessionDetail) {
    setChat(buildChatFromDetail(data));
  }

  function handleCreateSession(event: FormEvent) {
    event.preventDefault();
    if (!goal.trim()) {
      setError("Опишите задачу агента");
      return;
    }
    createMutation.mutate();
  }

  function handleStartDesign() {
    if (!selectedSessionId) return;
    startMutation.mutate(selectedSessionId);
  }

  function handleStartSandbox() {
    if (!selectedSessionId) return;
    const query = testQuery.trim() || detail?.goal || "";
    startSandboxMutation.mutate({ sessionId: selectedSessionId, testQuery: query });
  }

  function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedSessionId || !message.trim()) return;
    messageMutation.mutate({ sessionId: selectedSessionId, text: message.trim() });
  }

  function handleConfirmAgentType() {
    if (!selectedSessionId || selectedAgentType !== "consultant") return;
    messageMutation.mutate({ sessionId: selectedSessionId, text: "Подтверждаю тип Консультант" });
  }

  const recordedAgentType = detail?.agent_type ?? (typeConfirmed ? selectedAgentType : proposedAgentType);
  const typeReasoning =
    detail?.agent_type_proposal?.reasoning ??
    (detail?.current_stage === "classify_agent_type"
      ? chat.filter((item) => item.role === "assistant").at(-1)?.text
      : null);
  const typeHintText = typeConfirmed
    ? `Тип агента зафиксирован: «${agentTypeLabel(recordedAgentType)}».`
    : proposedAgentType
      ? `Система определила тип агента как «${agentTypeLabel(proposedAgentType)}». Подтвердите выбор в списке или уточните в чате.`
      : "Выберите тип агента для продолжения проектирования.";

  function handleDeleteSession(sessionId: string, event: MouseEvent) {
    event.stopPropagation();
    if (!window.confirm("Удалить эту сессию проектирования?")) return;
    deleteMutation.mutate(sessionId);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Конструктор агентов</h1>
        <p>Спроектируйте структуру нового агента: цель, план, инструменты и blueprint.</p>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.layout}>
        <section className={styles.panel}>
          <h2>Сессии</h2>
          <div className={styles.sessionList}>
            {(sessionsQuery.data ?? []).map((session: AgentBuilderSession) => (
              <div
                key={session.id}
                className={`${styles.sessionItem} ${selectedSessionId === session.id ? styles.sessionItemActive : ""}`}
              >
                <button
                  type="button"
                  className={styles.sessionItemMain}
                  onClick={() => {
                    setSelectedSessionId(session.id);
                    setError(null);
                  }}
                >
                  {session.goal.slice(0, 80)}
                  <small>{session.status}</small>
                </button>
                <button
                  type="button"
                  className={styles.sessionDeleteBtn}
                  title="Удалить сессию"
                  disabled={deleteMutation.isPending}
                  onClick={(event) => handleDeleteSession(session.id, event)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateSession}>
            <h2>Новая сессия</h2>
            <textarea
              className={styles.goalInput}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Опишите бизнес-задачу будущего агента..."
            />
            <div className={styles.actions}>
              <button className={styles.primaryBtn} type="submit" disabled={createMutation.isPending}>
                Создать сессию
              </button>
              <button
                className={styles.secondaryBtn}
                type="button"
                disabled={!selectedSessionId || isThinking}
                onClick={handleStartDesign}
              >
                {startMutation.isPending ? "Модель думает..." : "Начать проектирование"}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.actions}>
            <span className={styles.statusPill}>{detail?.status ?? "нет сессии"}</span>
            {detail?.current_stage ? <span className={styles.statusPill}>{detail.current_stage}</span> : null}
          </div>

          {showAgentTypePanel ? (
            <div className={styles.typePanel}>
              <h2>Тип агента</h2>
              <p className={styles.typeHint}>{typeHintText}</p>
              <label className={styles.typeSelectLabel} htmlFor="agent-type-select">
                Записанный тип
              </label>
              <select
                id="agent-type-select"
                className={styles.typeSelect}
                value={typeConfirmed ? (detail?.agent_type ?? selectedAgentType) : selectedAgentType}
                disabled={typeConfirmed || isThinking}
                onChange={(event) => setSelectedAgentType(event.target.value as AgentType)}
              >
                {AGENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                    {option.disabled ? " (пока недоступен)" : ""}
                  </option>
                ))}
              </select>
              {detail?.agent_type_proposal?.confidence != null ? (
                <p className={styles.typeMeta}>
                  Уверенность классификации: {Math.round(detail.agent_type_proposal.confidence * 100)}%
                </p>
              ) : null}
              {typeReasoning ? (
                <div className={styles.typeExplanation}>
                  <strong>Пояснение</strong>
                  <p>{typeReasoning}</p>
                </div>
              ) : null}
              {showTypeConfirmation ? (
                <div className={styles.actions}>
                  <button
                    className={styles.primaryBtn}
                    type="button"
                    disabled={isThinking || selectedAgentType !== "consultant"}
                    onClick={handleConfirmAgentType}
                  >
                    Подтвердить тип
                  </button>
                  {selectedAgentType === "action" ? (
                    <p className={styles.typeWarning}>
                      Тип «Действие» пока не поддерживается. Выберите «Консультант» для продолжения.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className={styles.typeMeta}>Тип подтверждён и сохранён в сессии.</p>
              )}
            </div>
          ) : null}

          {detail?.design_stages?.length ? (
            <div className={styles.designStages}>
              <h2>Этапы проектирования</h2>
              {detail.design_stages.map((stage) => (
                <div
                  key={stage.id}
                  className={`${styles.designStageItem} ${
                    stage.status === "running"
                      ? styles.designStageRunning
                      : stage.status === "completed"
                        ? styles.designStageCompleted
                        : ""
                  }`}
                >
                  <span className={styles.designStageDot} />
                  <span>{stage.label}</span>
                </div>
              ))}
            </div>
          ) : null}

          {hasBlueprint ? (
            <div className={styles.previewResult}>
              <strong>Пробный запуск (Sandbox)</strong>
              <p className={styles.previewMeta}>
                Агент реально выполнит шаги blueprint. Для получения данных с внешних сайтов держите вкладку открытой —
                страницы откроются в вашем браузере.
              </p>
              <textarea
                className={styles.messageInput}
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder={detail?.goal ?? "Тестовый запрос для агента"}
                disabled={sandboxRunning || startSandboxMutation.isPending}
              />
              <button
                className={styles.secondaryBtn}
                type="button"
                disabled={!selectedSessionId || sandboxRunning || startSandboxMutation.isPending}
                onClick={handleStartSandbox}
              >
                {sandboxRunning || startSandboxMutation.isPending
                  ? "Выполняется пробный запуск…"
                  : sandboxRun
                    ? "Запустить заново"
                    : "Запустить пробный запуск"}
              </button>
              {sandboxRun ? <SandboxTrace run={sandboxRun} /> : null}
            </div>
          ) : null}

          {showRequiredElements ? (
            <div className={styles.requiredList}>
              <h2>Обязательные элементы</h2>
              {detail.required_elements.map((element) => (
                <div
                  key={element.key}
                  className={`${styles.requiredItem} ${
                    element.status === "filled" || element.value
                      ? styles.requiredItemFilled
                      : styles.requiredItemPending
                  }`}
                >
                  <strong>{element.label}</strong>
                  {element.question ? <div>{element.question}</div> : null}
                  {element.value ? <div>Значение: {element.value}</div> : null}
                </div>
              ))}
              {detail.requirements_validation && !detail.requirements_validation.valid ? (
                <div className={styles.validationWarning}>
                  Не заполнено: {(detail.requirements_validation.missing ?? []).join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={styles.chatLog}>
            {!chat.length ? <div className={styles.messageBubble}>Выберите сессию и начните проектирование.</div> : null}
            {chat.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`${styles.messageBubble} ${item.role === "assistant" ? styles.assistant : styles.user}`}>
                {item.text}
              </div>
            ))}
            {isThinking ? <div className={`${styles.messageBubble} ${styles.assistant}`}>Модель формирует ответ...</div> : null}
            {showClarifyingQuestions ? (
              <div className={styles.messageBubble}>
                <strong>Уточнения:</strong>
                <ul>
                  {detail!.clarifying_questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSendMessage}>
            <textarea
              className={styles.messageInput}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                inputDisabled && hasBlueprint
                  ? "Проектирование завершено — проверьте blueprint справа"
                  : "Ответьте на уточняющие вопросы конструктора..."
              }
              disabled={inputDisabled}
            />
            <div className={styles.actions}>
              <button className={styles.primaryBtn} type="submit" disabled={inputDisabled}>
                {messageMutation.isPending ? "Модель думает..." : "Отправить"}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.panel}>
          <h2>План и blueprint</h2>

          <div className={styles.stepList}>
            {detail?.plan?.steps?.length ? (
              detail.plan.steps.map((step) => (
                <div key={step.id} className={`${styles.stepItem} ${stepClass[step.status] ?? styles.stepPending}`}>
                  <strong>{step.title}</strong>
                  <div>{step.description}</div>
                  <small>{step.status}</small>
                </div>
              ))
            ) : (
              <div className={styles.stepItem}>План появится после запуска проектирования.</div>
            )}
          </div>

          <h2>Промежуточные этапы</h2>
          <div className={styles.attemptList}>
            {(detail?.attempts ?? []).slice(0, 8).map((attempt) => (
              <div key={attempt.id} className={styles.attemptItem}>
                #{attempt.attempt_number}: {attempt.result_summary || attempt.goal || "—"}
                <div>{attempt.success ? "выполнено" : "ошибка"}</div>
              </div>
            ))}
          </div>

          {detail?.blueprint ? (
            <div className={styles.blueprintSection}>
              <h3>{detail.blueprint.name}</h3>
              <p>{detail.blueprint.description}</p>
              <h3>Инструменты</h3>
              <div className={styles.tagList}>
                {(detail.blueprint.tools ?? []).map((tool) => (
                  <span key={tool} className={styles.tag}>{tool}</span>
                ))}
              </div>
              <h3>Workflow</h3>
              <WorkflowGraphView
                nodes={detail.blueprint.workflow_graph?.nodes}
                edges={detail.blueprint.workflow_graph?.edges}
              />
              {detail.validation_result ? (
                <p>{detail.validation_result.valid ? "Blueprint валиден" : detail.validation_result.errors.join(", ")}</p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.actions}>
            {hasBlueprint && !detail?.preview_result?.success ? (
              <button
                className={styles.secondaryBtn}
                type="button"
                disabled={!selectedSessionId || previewMutation.isPending}
                onClick={() => selectedSessionId && previewMutation.mutate(selectedSessionId)}
              >
                {previewMutation.isPending ? "Пробный запуск..." : "Запустить пробный запуск"}
              </button>
            ) : null}
            <button
              className={styles.secondaryBtn}
              type="button"
              disabled={!selectedSessionId || regenerateMutation.isPending}
              onClick={() => selectedSessionId && regenerateMutation.mutate(selectedSessionId)}
            >
              Пересобрать
            </button>
            <button
              className={styles.primaryBtn}
              type="button"
              disabled={!selectedSessionId || !canApprove || approveMutation.isPending}
              onClick={() => selectedSessionId && approveMutation.mutate(selectedSessionId)}
              title={
                !canApprove
                  ? "Сначала дождитесь успешного пробного запуска (Sandbox)"
                  : undefined
              }
            >
              Зафиксировать структуру
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function buildChatFromDetail(
  detail: AgentBuilderSessionDetail
): Array<{ role: "user" | "assistant"; text: string }> {
  const conversation = detail.collected_requirements?.conversation;
  if (Array.isArray(conversation) && conversation.length) {
    return conversation
      .filter(
        (item): item is { role: string; content: string } =>
          typeof item === "object" &&
          item !== null &&
          "role" in item &&
          "content" in item &&
          typeof (item as { content: unknown }).content === "string"
      )
      .map((item) => ({
        role: item.role === "user" ? "user" : "assistant",
        text: item.content
      }));
  }

  const attempts = [...(detail.attempts ?? [])].reverse();
  const history: Array<{ role: "user" | "assistant"; text: string }> = [];
  for (const attempt of attempts) {
    if (attempt.goal && attempt.goal !== detail.goal && attempt.goal !== "Сессия создана") {
      history.push({ role: "user", text: attempt.goal });
    }
    if (attempt.result_summary) {
      history.push({ role: "assistant", text: attempt.result_summary });
    }
  }
  if (history.length) return history;

  if (detail.assistant_messages?.length) {
    return detail.assistant_messages.map((text) => ({ role: "assistant" as const, text }));
  }
  return [];
}

function extractError(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.code === "ECONNABORTED") {
      return "Превышено время ожидания. Генерация агента может занимать несколько минут — попробуйте ещё раз.";
    }
    const data = error.response?.data as { detail?: string | Array<{ msg?: string }> } | string | undefined;
    if (typeof data === "string") return data;
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((item) => item.msg).filter(Boolean).join("; ") || "Не удалось выполнить операцию";
    }
    if (error.message) return error.message;
  }
  return "Не удалось выполнить операцию";
}
