import { AlertTriangle, CheckCircle, HelpCircle, XCircle } from "lucide-react";

import type { ValidationStatus } from "../../lib/api";
import { cn } from "../../lib/utils";

interface StatusIconProps {
  status: ValidationStatus | null;
  size?: "sm" | "md";
  "aria-label"?: string;
}

export function StatusIcon({
  status,
  size = "sm",
  "aria-label": ariaLabel,
}: StatusIconProps) {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const label = ariaLabel ?? status ?? "unknown";

  if (status === null) {
    return <HelpCircle className={cn(sizeClass, "text-gray-300")} aria-label={label} />;
  }
  switch (status) {
    case "valid":
      return <CheckCircle className={cn(sizeClass, "text-green-500")} aria-label={label} />;
    case "warning":
      return <AlertTriangle className={cn(sizeClass, "text-yellow-500")} aria-label={label} />;
    case "error":
      return <XCircle className={cn(sizeClass, "text-red-500")} aria-label={label} />;
    default:
      return <HelpCircle className={cn(sizeClass, "text-gray-400")} aria-label={label} />;
  }
}
