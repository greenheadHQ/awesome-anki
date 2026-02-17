/**
 * useMobileNav - 모바일 Drawer 상태 관리 훅
 * - 라우트 전환 시 자동 닫기
 * - ESC 키로 닫기
 * - md 이상 전환 시 자동 닫기 (body overflow 잔류 방지)
 * - useBodyScrollLock 연동
 */

import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useBodyScrollLock } from "./useBodyScrollLock";

export function useMobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // body 스크롤 잠금 연동
  useBodyScrollLock(isOpen);

  // 라우트 전환 시 자동 닫기
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  // md 이상 전환 시 자동 닫기
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsOpen(false);
      }
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return { isOpen, open, close };
}
