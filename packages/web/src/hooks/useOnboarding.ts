import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'anki-splitter-onboarding-completed';

export function useOnboarding() {
  const [isCompleted, setIsCompleted] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  const [shouldRun, setShouldRun] = useState(false);

  // 첫 방문 시 자동 실행
  useEffect(() => {
    if (!isCompleted) {
      // 약간의 딜레이 후 시작 (페이지 로딩 완료 대기)
      const timer = setTimeout(() => {
        setShouldRun(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isCompleted]);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsCompleted(true);
    setShouldRun(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsCompleted(false);
  }, []);

  const startOnboarding = useCallback(() => {
    // 완료 상태를 리셋하고 다시 시작
    localStorage.removeItem(STORAGE_KEY);
    setIsCompleted(false);
    setShouldRun(true);
  }, []);

  const stopOnboarding = useCallback(() => {
    setShouldRun(false);
  }, []);

  return {
    isCompleted,
    shouldRun,
    completeOnboarding,
    resetOnboarding,
    startOnboarding,
    stopOnboarding,
  };
}
