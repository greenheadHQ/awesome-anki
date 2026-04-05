import { useState } from "react";

export function useSplitAnalysisState() {
  const [pendingAnalyses, setPendingAnalyses] = useState<Set<string>>(new Set());
  const [errorAnalyses, setErrorAnalyses] = useState<Map<string, string>>(new Map());

  const addPending = (key: string) => {
    setPendingAnalyses((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const removePending = (key: string) => {
    setPendingAnalyses((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const setError = (key: string, message: string) => {
    setErrorAnalyses((prev) => {
      const next = new Map(prev);
      next.set(key, message);
      return next;
    });
  };

  const clearError = (key: string) => {
    setErrorAnalyses((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  return {
    pendingAnalyses,
    errorAnalyses,
    addPending,
    removePending,
    setError,
    clearError,
  };
}
