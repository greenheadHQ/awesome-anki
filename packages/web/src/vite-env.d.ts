/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCATOR_TARGET?: "cursor" | "vscode";
  readonly VITE_DISABLE_LOCATOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
