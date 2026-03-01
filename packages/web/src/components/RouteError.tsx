import { Link, useRouteError } from "react-router-dom";

export function RouteError() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : "페이지를 로드하는 중 오류가 발생했습니다.";

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-orange-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-orange-600">페이지 오류</h2>
        <p className="mb-4 text-sm text-gray-600">{message}</p>
        <Link
          to="/"
          className="inline-block rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
