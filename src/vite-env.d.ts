/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_SERVER?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_API_PROXY?: string;
  readonly VITE_ONEC_API_SERVER?: string;
  readonly VITE_ONEC_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface AveonDesktopBridge {
  platform?: string;
}

interface Window {
  aveonDesktop?: AveonDesktopBridge;
}
