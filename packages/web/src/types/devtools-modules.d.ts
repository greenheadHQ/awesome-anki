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
