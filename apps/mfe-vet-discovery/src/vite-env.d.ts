/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLINIC_SERVICE_URL?: string;
  readonly VITE_PET_SERVICE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
