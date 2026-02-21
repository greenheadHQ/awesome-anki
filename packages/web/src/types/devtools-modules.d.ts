declare module "@locator/runtime" {
  export interface LocatorTarget {
    url: string;
    label: string;
  }

  export interface LocatorSetupOptions {
    adapter?: unknown;
    targets?: Record<string, LocatorTarget | string>;
    projectPath?: string;
    showIntro?: boolean;
  }

  export default function setupLocatorUI(options?: LocatorSetupOptions): void;
}

declare module "react-scan" {
  export interface ScanOptions {
    enabled?: boolean;
    showToolbar?: boolean;
  }

  export function scan(options?: ScanOptions): void;
  export function setOptions(options?: ScanOptions): void;
}

declare module "react-grab" {
  export interface ReactGrabToolbarState {
    edge: "top" | "bottom" | "left" | "right";
    ratio: number;
    collapsed: boolean;
    enabled: boolean;
  }

  export interface ReactGrabApi {
    setToolbarState(state: Partial<ReactGrabToolbarState>): void;
    setEnabled(enabled: boolean): void;
  }

  export function getGlobalApi(): ReactGrabApi | null;
  export function init(options?: { enabled?: boolean }): ReactGrabApi;
}
