import { agentsApi } from "@/api/endpoints";
import { readAccessToken } from "@/auth/authStorage";

type WechatUtilityMessage = {
  event?: string;
  message?: string;
  error?: string;
  clients?: number;
  group?: string;
  sender?: string;
  type?: string;
  text?: string;
  time?: string;
  file?: { name?: string; mimeType?: string; size?: number; base64?: string } | null;
  auth?: Record<string, unknown>;
  [key: string]: unknown;
};

let liveSocket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let keepAlive = false;

function closeLiveSocket(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (!liveSocket) return;
  liveSocket.onopen = null;
  liveSocket.onmessage = null;
  liveSocket.onerror = null;
  liveSocket.onclose = null;
  liveSocket.close();
  liveSocket = null;
}

function resolveBackendStreamUrl(platformToken: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const path = `/api/v1/agents/document-analysis/wechat-utility-stream?token=${encodeURIComponent(platformToken)}`;
  if (import.meta.env.DEV) {
    return `${protocol}//${window.location.host}${path}`;
  }
  return `${protocol}//${window.location.hostname}:5252${path}`;
}

function sanitizeForConsole(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForConsole(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key.toLowerCase() === "base64" && typeof nested === "string") {
        out.base64Length = nested.length;
        out.base64Preview = nested.slice(0, 80);
        continue;
      }
      out[key] = sanitizeForConsole(nested);
    }
    return out;
  }
  return value;
}

function logIncomingMessage(raw: string, event: MessageEvent): void {
  console.log("[WeChat] websocket frame", {
    type: event.type,
    origin: event.origin,
    dataType: Object.prototype.toString.call(event.data),
    bytes: raw.length,
  });
  console.log("[WeChat] raw", raw);

  let msg: WechatUtilityMessage;
  try {
    msg = JSON.parse(raw) as WechatUtilityMessage;
  } catch {
    return;
  }

  if (msg.event === "hello") {
    console.log("[WeChat] hello — канал открыт", sanitizeForConsole(msg));
    return;
  }

  if (msg.event === "media-download") {
    console.log("[WeChat media] отправляется запрос", sanitizeForConsole(msg.request));
    console.log("[WeChat media] ответ", sanitizeForConsole(msg.response));
    return;
  }

  if (msg.event === "error") {
    console.error("[WeChat] ошибка утилиты", sanitizeForConsole(msg));
    return;
  }

  console.log("[WeChat message]", sanitizeForConsole(msg));
  console.log("[WeChat message] keys", Object.keys(msg));
}

function connectLiveSocket(options?: { announce?: boolean }): void {
  const platformToken = readAccessToken();
  if (!platformToken) {
    if (options?.announce) {
      console.error("Нет токена платформы. Войдите в систему, чтобы видеть WeChat в консоли.");
    }
    return;
  }

  const socket = new WebSocket(resolveBackendStreamUrl(platformToken));
  liveSocket = socket;

  socket.onopen = () => {
    if (options?.announce) {
      console.log("[WeChat] WebSocket открыт через backend. Каждое сообщение будет в консоли.");
    }
  };

  socket.onmessage = (event) => {
    const data = event.data;
    if (typeof data === "string") {
      logIncomingMessage(data, event);
      return;
    }
    if (data instanceof Blob) {
      void data.text().then((text) => logIncomingMessage(text, event));
      return;
    }
    if (data instanceof ArrayBuffer) {
      logIncomingMessage(new TextDecoder().decode(data), event);
      return;
    }
    console.log("[WeChat] websocket unknown payload", event);
  };

  socket.onerror = () => {
    if (options?.announce) {
      console.error("WebSocket ошибка: не удалось открыть поток через backend :5252");
    }
  };

  socket.onclose = () => {
    if (liveSocket === socket) {
      liveSocket = null;
    }
    if (!keepAlive) return;
    reconnectTimer = window.setTimeout(() => {
      connectLiveSocket();
    }, 3000);
  };
}

export function startWechatLiveConsoleLogger(): void {
  keepAlive = true;
  if (liveSocket && (liveSocket.readyState === WebSocket.OPEN || liveSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  connectLiveSocket();
}

export function stopWechatLiveConsoleLogger(): void {
  keepAlive = false;
  closeLiveSocket();
}

export async function runWechatUtilityConnectionTestInConsole(): Promise<void> {
  console.clear();
  console.log("=== WeChat utility test ===");
  console.log("Консоль очищена. Каждое сообщение от утилиты будет ниже.");
  keepAlive = true;
  closeLiveSocket();

  try {
    const session = await agentsApi.openWechatUtilitySession();
    console.log("1) Утилита (backend → 192.168.5.80:8790)", session.wsUrl || "не задан");
    if (session.health) {
      console.log("2) /health", session.health);
    } else {
      console.warn("2) /health недоступен", session.healthError || "нет ответа");
    }
    if (!session.ok) {
      console.error("Backend не смог подготовить сессию утилиты", session.error || session);
    }
  } catch (caughtError) {
    console.error("Ошибка запроса к backend", caughtError);
  }

  connectLiveSocket({ announce: true });
}

export async function runWechatHistoryInConsole(): Promise<void> {
  console.clear();
  console.log("=== WeChat history ===");
  console.log("Консоль очищена. Загружаю переписку из БД…");

  try {
    const history = await agentsApi.getWechatUtilityHistory();
    const items = history.items ?? [];
    console.log(`Сообщений в БД: ${history.count ?? items.length}`);
    if (!items.length) {
      console.log("История пустая. Дождитесь новых сообщений из WeChat.");
      return;
    }

    const rows = items.map((item) => ({
      time: item.time || item.receivedAt,
      group: item.group || "личное / без группы",
      sender: item.sender || "—",
      text: item.text || "",
      type: item.type || "",
      file: item.hasFile ? `${item.file?.kind || "file"}: ${item.file?.name || ""}` : "",
    }));
    console.table(rows);
    console.log("Полные записи:", items);
  } catch (caughtError) {
    console.error("Не удалось загрузить историю из БД", caughtError);
  }
}
