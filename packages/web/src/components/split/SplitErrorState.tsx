import { AlertTriangle } from "lucide-react";

import { Button } from "../ui/button";

interface SplitErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function SplitErrorState({ message, onRetry }: SplitErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-destructive">
      <AlertTriangle className="w-8 h-8 mb-3" />
      <span className="font-medium mb-2">분할 분석 실패</span>
      <p className="text-xs text-muted-foreground text-center max-w-xs bg-muted p-2 rounded">
        {message}
      </p>
      <Button onClick={onRetry} variant="outline" size="sm" className="mt-3">
        다시 시도
      </Button>
    </div>
  );
}
