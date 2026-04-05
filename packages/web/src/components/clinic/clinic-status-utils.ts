import type { ValidationStatus } from "../../lib/api";

export const STATUS_LABELS: Record<ValidationStatus, string> = {
  valid: "검증 통과",
  warning: "검토 필요",
  error: "문제 발견",
  unknown: "검증 불가",
};

export function getSimilarityBadgeClass(similarity: number): string {
  if (similarity >= 90) return "bg-red-100 text-red-700";
  if (similarity >= 70) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

export function getStatusBg(status: ValidationStatus): string {
  switch (status) {
    case "valid":
      return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
    case "warning":
      return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800";
    case "error":
      return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
    default:
      return "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700";
  }
}

/** 카드 목록의 왼쪽 3px 색상 바 */
export function getStatusBorderColor(status: ValidationStatus | null): string {
  switch (status) {
    case "valid":
      return "border-l-green-500";
    case "warning":
      return "border-l-yellow-500";
    case "error":
      return "border-l-red-500";
    default:
      return "border-l-gray-300";
  }
}
