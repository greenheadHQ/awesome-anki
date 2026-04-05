import { ChevronDown, ChevronUp } from "lucide-react";

import type { AllValidationResult } from "../../lib/api";
import { ClinicStatusIcon } from "./ClinicStatusIcon";
import { ValidationDetails } from "./ValidationDetails";

interface ValidationSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  typeKey: string;
  icon: React.ElementType;
  label: string;
  result: AllValidationResult["results"][keyof AllValidationResult["results"]] | undefined;
}

/** 검증 결과 섹션 (접기/펼치기) */
export function ValidationSection({
  isExpanded,
  onToggle,
  typeKey,
  icon: Icon,
  label,
  result,
}: ValidationSectionProps) {
  if (!result) return null;

  return (
    <div key={typeKey} className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="font-medium text-sm">{label}</span>
          <ClinicStatusIcon status={result.status} />
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isExpanded && (
        <div className="p-3 border-t bg-muted/30 text-sm">
          <p className="mb-2">{result.message}</p>
          <ValidationDetails typeKey={typeKey} result={result} />
        </div>
      )}
    </div>
  );
}
