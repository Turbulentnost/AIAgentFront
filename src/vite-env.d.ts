/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_SERVER?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_API_PROXY?: string;
  readonly VITE_POCHTA_API_URL?: string;
  readonly VITE_POCHTA_API_PROXY?: string;
  readonly VITE_STANDALONE_INCOMING_MAIL?: string;
  readonly VITE_INCOMING_MAIL_PUBLIC?: string;
  readonly VITE_ONEC_API_SERVER?: string;
  readonly VITE_ONEC_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
