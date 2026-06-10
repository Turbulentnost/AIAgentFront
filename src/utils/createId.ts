export function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // randomUUID недоступен вне secure context (например http://192.168.x.x)
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
