import {
  FileText,
  FolderOpen,
  HelpCircle,
  History,
  LayoutDashboard,
  Scissors,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/split", icon: Scissors, label: "Split" },
  { to: "/browse", icon: FolderOpen, label: "Browse" },
  { to: "/backups", icon: History, label: "Backups" },
  { to: "/prompts", icon: FileText, label: "Prompts" },
  { to: "/help", icon: HelpCircle, label: "Help" },
];

function NavContent({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b px-3 md:h-16 md:px-6">
        <h1 className="typo-h3">Anki Splitter</h1>
        {onNavClick && (
          <button
            type="button"
            onClick={onNavClick}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted md:hidden"
            aria-label="메뉴 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="typo-caption text-muted-foreground">
          Anki Card Splitter v1.0
        </p>
      </div>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  onAnimationStateChange,
}: {
  open: boolean;
  onClose: () => void;
  onAnimationStateChange?: (animating: boolean) => void;
}) {
  const location = useLocation();
  const animationTimerRef = useRef<number | null>(null);
  const isInitialRenderRef = useRef(true);

  useEffect(() => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      onAnimationStateChange?.(false);
      return;
    }

    // CSS 전환(duration-200) 대비 약간 여유를 둬서 플래그 해제 타이밍을 안정화한다.
    const transitionMs = open ? 220 : 200;
    onAnimationStateChange?.(true);
    animationTimerRef.current = window.setTimeout(() => {
      onAnimationStateChange?.(false);
      animationTimerRef.current = null;
    }, transitionMs);
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [open, onAnimationStateChange]);

  // 라우트 변경 시 Drawer 닫기 (이미 닫혀 있으면 무시)
  // biome-ignore lint/correctness/useExhaustiveDependencies: location.pathname을 트리거로 사용 (open/onClose는 의도적 생략)
  useEffect(() => {
    if (open) onClose();
  }, [location.pathname]);

  // Body scroll lock — 모바일 Drawer 열릴 때 배경 스크롤 방지
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ESC 키로 Drawer 닫기
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-64 border-r bg-card md:flex">
        <NavContent />
      </aside>

      {/* Mobile drawer */}
      {/* Backdrop — z-40: mobile header와 같은 레이어 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        style={{ touchAction: "none" }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer — z-50: backdrop 위 */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="내비게이션 메뉴"
        className={cn(
          "fixed left-0 top-0 z-50 h-dvh w-64 border-r bg-card transition-transform duration-200 ease-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ overscrollBehavior: "contain" }}
      >
        <NavContent onNavClick={onClose} />
      </aside>
    </>
  );
}
