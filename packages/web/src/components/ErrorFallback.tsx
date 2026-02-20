import type { FallbackProps } from "react-error-boundary";

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message =
    error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-red-600">
          예기치 않은 오류가 발생했습니다
        </h2>
        <p className="mb-4 text-sm text-gray-600">{message}</p>
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
