import { AlertTriangle, Check, Loader2 } from "lucide-react";

import type { CardAnalysisStatus } from "./types";

export function CardStatusIcon({ status }: { status: CardAnalysisStatus }) {
  switch (status) {
    case "pending":
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />;
    case "cached":
      return <Check className="w-3.5 h-3.5 text-green-600" />;
    case "error":
      return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    default:
      return null;
  }
}
