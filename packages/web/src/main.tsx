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

const isTrue = (value: string | undefined): boolean => value?.toLowerCase() === "true";

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

// ────────────────────────────────────────────────────────────────────────────
// Dev-only dynamic imports: 반드시 문자열 리터럴을 사용할 것!
//
// [히스토리 — 같은 실수를 반복하지 않기 위한 기록]
//
// 1. 최초 구현(82ec7e7)에서 `await import("@locator/runtime")` 형태의
//    문자열 리터럴 dynamic import로 정상 동작했음.
//
// 2. PR #30(824cf45)에서 CodeRabbit(AI 코드리뷰 봇)이 dynamic import에
//    `/* @vite-ignore */`를 추가하라고 제안 → 이를 수용하면서 아래처럼 변경:
//
//      const mod = "@locator/runtime";
//      await import(/* @vite-ignore */ mod);
//
//    이 패턴은 세 라이브러리 모두 조용히 로딩 실패하게 만들었고,
//    catch 블록의 console.warn만 출력되어 장기간 발견되지 않았음.
//
// [왜 깨지는가]
//
//   Vite dev 서버는 ESM import를 가로채서 node_modules 모듈을 resolve/serve한다.
//   `@vite-ignore`는 Vite에게 "이 import는 건드리지 마"라고 지시하므로,
//   bare specifier("@locator/runtime" 등)가 브라우저에 그대로 전달된다.
//   브라우저는 bare specifier를 해석할 수 없어 TypeError로 실패한다.
//
// [규칙]
//
//   - 문자열 리터럴 사용: await import("react-scan")          ✅
//   - 변수 + @vite-ignore: await import(/* @vite-ignore */ x) ❌
//   - 프로덕션 안전성: initDevTools() 내 import.meta.env.DEV 가드로
//     빌드 시 dead code elimination 됨. devDependencies만 참조하므로 무해함.
// ────────────────────────────────────────────────────────────────────────────

const initLocator = async (): Promise<void> => {
  if (devtoolsState.locator || isTrue(import.meta.env.VITE_DISABLE_LOCATOR)) {
    return;
  }

  try {
    const { default: setupLocatorUI } = await import("@locator/runtime");
    setupLocatorUI({
      targets: buildLocatorTargets(getLocatorTarget()),
      showIntro: false,
    });
    devtoolsState.locator = true;
  } catch (error) {
    console.warn("[devtools] Locator initialization failed.", error);
  }
};

const initReactScan = async (): Promise<void> => {
  if (devtoolsState.reactScan || isTrue(import.meta.env.VITE_DISABLE_REACT_SCAN)) {
    return;
  }

  try {
    const { scan, setOptions } = await import("react-scan");
    scan({
      enabled: false,
      showToolbar: true,
    });
    setOptions({
      enabled: false,
      showToolbar: true,
    });
    devtoolsState.reactScan = true;
  } catch (error) {
    console.warn("[devtools] React Scan initialization failed.", error);
  }
};

const initReactGrab = async (): Promise<void> => {
  if (devtoolsState.reactGrab || isTrue(import.meta.env.VITE_DISABLE_REACT_GRAB)) {
    return;
  }

  try {
    const reactGrabModule = await import("react-grab");
    const reactGrabApi =
      reactGrabModule.getGlobalApi() ??
      reactGrabModule.init({
        enabled: false,
      });
    reactGrabApi.setToolbarState({ enabled: true });
    reactGrabApi.setEnabled(false);
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
