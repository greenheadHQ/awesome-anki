/**
 * View Transition API 래퍼 — 미지원 브라우저에서는 즉시 콜백 실행
 */
export function startViewTransition(callback: () => void): void {
  if (document.startViewTransition) {
    document.startViewTransition(callback);
  } else {
    callback();
  }
}
