import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import { BottomSheet } from "./bottom-sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface CompactSelectorItem {
  key: string;
  label: string;
  description?: string;
}

interface CompactSelectorProps {
  icon: React.ReactNode;
  label: string;
  items: CompactSelectorItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  disabled?: boolean;
  className?: string;
  sheetTitle?: string;
}

function CompactSelector({
  icon,
  label,
  items,
  selectedKey,
  onSelect,
  disabled,
  className,
  sheetTitle,
}: CompactSelectorProps) {
  const isMobile = useIsMobile("lg");
  const [open, setOpen] = useState(false);

  const selectedItem = items.find((i) => i.key === selectedKey);
  const displayLabel = selectedItem?.label || label;

  const handleSelect = (key: string) => {
    onSelect(key);
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-md border bg-background text-sm",
        "hover:bg-accent transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "min-w-0 flex-1",
        className,
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="truncate flex-1 text-left">{displayLabel}</span>
      <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
    </button>
  );

  const itemList = (
    <div className="divide-y">
      {items.map((item) => (
        <button
          type="button"
          key={item.key}
          onClick={() => handleSelect(item.key)}
          className={cn(
            "w-full text-left px-3 py-3 text-sm transition-colors",
            "hover:bg-accent",
            item.key === selectedKey && "bg-primary/10 font-medium",
          )}
        >
          <div>{item.label}</div>
          {item.description && (
            <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
          )}
        </button>
      ))}
    </div>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <BottomSheet open={open} onOpenChange={setOpen} title={sheetTitle || label}>
          {itemList}
        </BottomSheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0 max-h-80 overflow-y-auto">
        {itemList}
      </PopoverContent>
    </Popover>
  );
}

export { CompactSelector };
export type { CompactSelectorItem };
