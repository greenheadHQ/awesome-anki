import { cn } from "@/lib/utils";

const PROVIDER_STYLES: Record<
  string,
  { label: string; bg: string; text: string; ring: string }
> = {
  gemini: {
    label: "G",
    bg: "bg-blue-50",
    text: "text-blue-700",
    ring: "ring-blue-200/60",
  },
  openai: {
    label: "O",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200/60",
  },
};

const FALLBACK_STYLE = {
  label: "?",
  bg: "bg-muted",
  text: "text-muted-foreground",
  ring: "ring-border",
};

export function ModelBadge({
  provider,
  model,
  className,
}: {
  provider: string;
  model?: string;
  className?: string;
}) {
  const style = PROVIDER_STYLES[provider] ?? FALLBACK_STYLE;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        style.bg,
        style.text,
        style.ring,
        className,
      )}
    >
      <span className="font-semibold">[{style.label}]</span>
      {model && (
        <span className="font-mono truncate max-w-[180px]">{model}</span>
      )}
    </span>
  );
}

/**
 * 비용을 읽기 좋은 문자열로 변환
 * e.g. $0.0023 → "$0.0023", $0 → "$0.00"
 */
export function formatCostUsd(usd: number): string {
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
