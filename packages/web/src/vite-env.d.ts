/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCATOR_TARGET?: "cursor" | "vscode";
  readonly VITE_DISABLE_LOCATOR?: string;
  readonly VITE_DISABLE_REACT_SCAN?: string;
  readonly VITE_DISABLE_REACT_GRAB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
