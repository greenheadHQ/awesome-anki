import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

// NOTE: core의 REJECTION_REASONS는 런타임 import 시 브라우저 번들 경계를 넘기 때문에
// web 패키지에서 동일 스키마를 로컬 상수로 유지한다.
const REJECTION_REASONS = [
  { id: "too-granular", label: "분할이 너무 세분화" },
  { id: "context-missing", label: "맥락 태그 부적절" },
  { id: "char-exceeded", label: "글자수 초과" },
  { id: "cloze-inappropriate", label: "Cloze 위치/내용 부적절" },
  { id: "quality-low", label: "전반적 품질 미달" },
  { id: "other", label: "기타" },
] as const;

export function RejectPopover({
  canReject,
  onReject,
}: {
  canReject: boolean;
  onReject: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState("");

  const handleReject = (reason: string) => {
    setOpen(false);
    setShowOther(false);
    setOtherText("");
    onReject(reason);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setShowOther(false);
          setOtherText("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          disabled={!canReject}
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          <X className="w-4 h-4 mr-1" />
          분할 반려
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-0">
        <div className="py-1">
          {REJECTION_REASONS.filter((r) => r.id !== "other").map((reason) => (
            <button
              key={reason.id}
              type="button"
              onClick={() => handleReject(reason.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              {reason.label}
            </button>
          ))}
          <div className="border-t">
            {showOther ? (
              <div className="p-2">
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="반려 사유를 입력하세요..."
                  className="w-full text-sm border rounded p-2 resize-none"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && otherText.trim()) {
                      e.preventDefault();
                      handleReject(otherText.trim());
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (otherText.trim()) handleReject(otherText.trim());
                  }}
                  disabled={!otherText.trim()}
                  className="mt-1 w-full"
                >
                  전송
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowOther(true)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                기타...
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
