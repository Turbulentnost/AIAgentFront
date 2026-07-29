import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/features/eskd/api/eskd";
import type { ModelHealthStatus } from "@/features/eskd/types/eskd";
import styles from "./ModelStatusIndicator.module.css";

type ModelState = "online" | "loading" | "offline" | "idle";

function resolveVlmState(status?: ModelHealthStatus, errored?: boolean): ModelState {
  if (errored || status?.reachable === false) return "offline";
  if (status?.reachable && status.model_loaded) return "online";
  if (status?.reachable) return "loading";
  return "offline";
}

function resolveLlmState(status?: ModelHealthStatus): ModelState {
  if (!status?.required && !status?.configured) return "idle";
  if (status.reachable === false) return "offline";
  if (status.reachable) return "online";
  return "offline";
}

function stateLabel(state: ModelState): string {
  if (state === "online") return "online";
  if (state === "loading") return "загрузка";
  if (state === "idle") return "не нужен";
  return "offline";
}

function formatPing(status?: ModelHealthStatus): string {
  if (status?.reachable && typeof status.ping_ms === "number") {
    return `${status.ping_ms % 1 === 0 ? status.ping_ms : status.ping_ms.toFixed(1)} ms`;
  }
  return "—";
}

function shortModelName(model?: string): string | undefined {
  if (!model) return undefined;
  const slug = model.split("/").pop() ?? model;
  return slug.length > 20 ? `${slug.slice(0, 17)}…` : slug;
}

function formatTargetHost(status?: ModelHealthStatus): string | undefined {
  if (status?.target) return status.target;
  if (!status?.base_url) return undefined;
  try {
    const url = new URL(status.base_url);
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    return status.base_url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

function vlmGatewayTarget(vlm?: ModelHealthStatus): string | undefined {
  return vlm?.gateway_target ?? formatTargetHost(vlm);
}

function isLocalVlmInference(vlm?: ModelHealthStatus): boolean {
  if (vlm?.location === "remote") return false;
  if (vlm?.location === "local") return true;
  const backend = (vlm?.backend ?? "").toLowerCase();
  return backend === "local" || backend === "gemma";
}

function llmLocationLabel(llm?: ModelHealthStatus): string {
  if (llm?.location === "lan") return "локальная сеть";
  if (llm?.location === "local") return "локально";
  if (llm?.backend === "openrouter") return "OpenRouter";
  return "удалённо";
}

function buildVlmTitle(vlm?: ModelHealthStatus, errored?: boolean): string | undefined {
  if (errored) return "Не удалось получить статус VLM";
  const gateway = vlmGatewayTarget(vlm) ?? "host.docker.internal:8765";
  const inference = vlm?.inference_target;
  const local = isLocalVlmInference(vlm);
  const lines = local
    ? [
        "VLM (локально) — Gemma на этом же компьютере",
        `Адрес: ${gateway}`,
        "Ping: задержка бэкенда до локальной модели",
      ]
    : [
        `VLM (${vlm?.backend ?? "OpenRouter"}) — inference в облаке`,
        `Шлюз (локально): ${gateway}`,
        ...(inference ? [`Inference: ${inference}`] : []),
        "Ping: задержка до локального шлюза gemma3n_eskd_api (не до OpenRouter)",
      ];
  if (vlm?.model) lines.push(`Модель: ${vlm.model}`);
  if (vlm?.error) lines.push(`Ошибка: ${vlm.error}`);
  return lines.join("\n");
}

function buildLlmTitle(llm?: ModelHealthStatus): string | undefined {
  if (!llm) {
    return "LLM — модель для второй стадии пайплайна";
  }
  const target = formatTargetHost(llm) ?? "—";
  const loc = llmLocationLabel(llm);
  const pingHint =
    llm.location === "lan"
      ? "Ping: задержка бэкенда до LM Studio в локальной сети"
      : llm.location === "local"
        ? "Ping: задержка бэкенда до локального LLM (LM Studio)"
        : "Ping: задержка бэкенда до облачного LLM (OpenRouter)";
  const lines = [`LLM (${loc}) — ${target}`, pingHint];
  if (llm.model) lines.push(`Модель: ${llm.model}`);
  if (llm.backend) lines.push(`Бэкенд: ${llm.backend}`);
  if (llm.error) lines.push(`Ошибка: ${llm.error}`);
  return lines.join("\n");
}

function vlmKindLabel(vlm?: ModelHealthStatus): string {
  const gateway = vlmGatewayTarget(vlm);
  if (isLocalVlmInference(vlm)) {
    return gateway ? `VLM (локально · ${gateway})` : "VLM (локально)";
  }
  const backend = vlm?.backend === "openrouter" ? "OpenRouter" : (vlm?.backend ?? "облако");
  const inference = vlm?.inference_target;
  if (gateway && inference) {
    return `VLM (${backend} · gateway ${gateway})`;
  }
  if (inference) return `VLM (${backend} · ${inference})`;
  return gateway ? `VLM (${backend} · gateway ${gateway})` : `VLM (${backend})`;
}

function llmKindLabel(llm?: ModelHealthStatus): string {
  const target = formatTargetHost(llm);
  const loc = llmLocationLabel(llm);
  return target ? `LLM (${loc} · ${target})` : `LLM (${loc})`;
}

function StatusChip({
  kindLabel,
  modelName,
  state,
  ping,
  title
}: {
  kindLabel: string;
  modelName?: string;
  state: ModelState;
  ping: string;
  title?: string;
}) {
  const labelModel = shortModelName(modelName);
  return (
    <div className={styles.chip} title={title}>
      <span className={`${styles.dot} ${styles[state]}`} aria-hidden="true" />
      <span className={styles.label}>
        {kindLabel}
        {labelModel ? `: ${labelModel}` : ""} · {stateLabel(state)}
      </span>
      <span className={styles.ping}>{ping}</span>
    </div>
  );
}

export default function ModelStatusIndicator() {
  const health = useQuery({
    queryKey: ["eskd-model-health"],
    queryFn: fetchHealth,
    refetchInterval: 20_000,
    retry: 1
  });

  const vlm = health.data?.vlm ?? health.data?.model;
  const llm = health.data?.llm;
  const vlmState = resolveVlmState(vlm, health.isError);
  const llmState = resolveLlmState(llm);

  return (
    <div className={styles.root} aria-live="polite">
      <StatusChip
        kindLabel={vlmKindLabel(vlm)}
        modelName={vlm?.model}
        state={vlmState}
        ping={formatPing(vlm)}
        title={buildVlmTitle(vlm, health.isError)}
      />
      <StatusChip
        kindLabel={llmKindLabel(llm)}
        modelName={llm?.model}
        state={llmState}
        ping={formatPing(llm)}
        title={buildLlmTitle(llm)}
      />
    </div>
  );
}
