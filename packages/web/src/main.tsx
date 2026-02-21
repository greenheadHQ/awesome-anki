import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

type LocatorTarget = "cursor" | "vscode";
type DevtoolsState = {
  locator?: boolean;
  reactScan?: boolean;
  reactGrab?: boolean;
};

const globals = globalThis as typeof globalThis & {
  __awesomeAnkiDevtools__?: DevtoolsState;
};

const devtoolsState = globals.__awesomeAnkiDevtools__ ?? {};
globals.__awesomeAnkiDevtools__ = devtoolsState;

const isTrue = (value: string | undefined): boolean =>
  value?.toLowerCase() === "true";

const getLocatorTarget = (): LocatorTarget =>
  import.meta.env.VITE_LOCATOR_TARGET === "vscode" ? "vscode" : "cursor";

const locatorToken = (name: string): string => `\${${name}}`;

const buildLocatorUrl = (editor: LocatorTarget): string =>
  `${editor}://file/${locatorToken("projectPath")}${locatorToken(
    "filePath",
  )}:${locatorToken("line")}:${locatorToken("column")}`;

const buildLocatorTargets = (primaryTarget: LocatorTarget) => {
  const cursor = {
    label: "Cursor",
    url: buildLocatorUrl("cursor"),
  };
  const vscode = {
    label: "VS Code",
    url: buildLocatorUrl("vscode"),
  };

  return primaryTarget === "vscode" ? { vscode, cursor } : { cursor, vscode };
};

const initLocator = async (): Promise<void> => {
  if (devtoolsState.locator || isTrue(import.meta.env.VITE_DISABLE_LOCATOR)) {
    return;
  }

  try {
    const { default: setupLocatorUI } = await import("@locator/runtime");
    setupLocatorUI({
      targets: buildLocatorTargets(getLocatorTarget()),
    });
    devtoolsState.locator = true;
  } catch (error) {
    console.warn("[devtools] Locator initialization failed.", error);
  }
};

const initReactScan = async (): Promise<void> => {
  if (
    devtoolsState.reactScan ||
    isTrue(import.meta.env.VITE_DISABLE_REACT_SCAN)
  ) {
    return;
  }

  try {
    const { scan } = await import("react-scan");
    scan({
      enabled: true,
      showToolbar: true,
    });
    devtoolsState.reactScan = true;
  } catch (error) {
    console.warn("[devtools] React Scan initialization failed.", error);
  }
};

const initReactGrab = async (): Promise<void> => {
  if (
    devtoolsState.reactGrab ||
    isTrue(import.meta.env.VITE_DISABLE_REACT_GRAB)
  ) {
    return;
  }

  try {
    await import("react-grab");
    devtoolsState.reactGrab = true;
  } catch (error) {
    console.warn("[devtools] React Grab initialization failed.", error);
  }
};

const initDevTools = async (): Promise<void> => {
  if (!import.meta.env.DEV) {
    return;
  }

  await Promise.all([initLocator(), initReactScan(), initReactGrab()]);
};

void initDevTools();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
