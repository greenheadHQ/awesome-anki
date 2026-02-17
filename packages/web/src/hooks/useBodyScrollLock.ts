/**
 * useBodyScrollLock - 범용 body 스크롤 잠금 훅
 * 참조 카운팅 방식: 여러 곳에서 동시에 lock/unlock해도 안전
 */

import { useCallback, useEffect, useRef } from "react";

let lockCount = 0;

function lockBody() {
  lockCount++;
  if (lockCount === 1) {
    document.body.style.overflow = "hidden";
  }
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = "";
  }
}

export function useBodyScrollLock(locked: boolean) {
  const isLocked = useRef(false);

  const lock = useCallback(() => {
    if (!isLocked.current) {
      isLocked.current = true;
      lockBody();
    }
  }, []);

  const unlock = useCallback(() => {
    if (isLocked.current) {
      isLocked.current = false;
      unlockBody();
    }
  }, []);

  useEffect(() => {
    if (locked) {
      lock();
    } else {
      unlock();
    }
  }, [locked, lock, unlock]);

  // 컴포넌트 언마운트 시 자동 해제
  useEffect(() => {
    return () => {
      if (isLocked.current) {
        isLocked.current = false;
        unlockBody();
      }
    };
  }, []);

  return { lock, unlock };
}
