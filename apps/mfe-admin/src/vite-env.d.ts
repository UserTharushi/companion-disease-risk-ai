/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PET_SERVICE_URL?: string;
  readonly VITE_CLINIC_SERVICE_URL?: string;
  readonly VITE_AI_SERVICE_URL?: string;
  readonly VITE_AGENT_SERVICE_URL?: string;
  readonly VITE_API_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
