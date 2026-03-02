import { useEffect, useState } from "react";

/**
 * 미디어 쿼리 매칭 상태를 반환하는 훅
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

const BREAKPOINTS = {
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
} as const;

/**
 * 모바일 여부를 반환하는 훅. breakpoint 미만이면 true.
 */
export function useIsMobile(breakpoint: "md" | "lg" | "xl" = "md"): boolean {
  const isDesktop = useMediaQuery(BREAKPOINTS[breakpoint]);
  return !isDesktop;
}
