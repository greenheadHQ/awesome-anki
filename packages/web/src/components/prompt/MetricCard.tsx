import { cn } from "../../lib/utils";

export interface MetricCardProps {
  label: string;
  value: number | string;
  color?: "green" | "yellow" | "red";
}

export function MetricCard({ label, value, color }: MetricCardProps) {
  return (
    <div
      className={cn(
        "p-3 rounded text-center",
        color === "green" && "bg-green-50",
        color === "yellow" && "bg-yellow-50",
        color === "red" && "bg-red-50",
        !color && "bg-muted",
      )}
    >
      <div
        className={cn(
          "text-lg font-bold",
          color === "green" && "text-green-700",
          color === "yellow" && "text-yellow-700",
          color === "red" && "text-red-700",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
