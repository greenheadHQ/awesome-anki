declare module "@locator/runtime" {
  export interface LocatorTargetConfig {
    label: string;
    url: string;
  }

  export interface LocatorSetupOptions {
    targets: Record<string, LocatorTargetConfig>;
    showIntro?: boolean;
  }

  export default function setupLocatorUI(options: LocatorSetupOptions): void;
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
  export interface ReactGrabApi {
    setToolbarState(state: { enabled: boolean }): void;
    setEnabled(enabled: boolean): void;
  }

  export function getGlobalApi(): ReactGrabApi | undefined;
  export function init(options?: { enabled?: boolean }): ReactGrabApi;
}
