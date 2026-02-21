import {
  FileText,
  FolderOpen,
  HelpCircle,
  History,
  LayoutDashboard,
  Scissors,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";

const navItems = [
  {
    to: "/",
    icon: LayoutDashboard,
    label: "Dashboard",
    tourId: "nav-dashboard",
  },
  { to: "/split", icon: Scissors, label: "Split", tourId: "nav-split" },
  { to: "/browse", icon: FolderOpen, label: "Browse", tourId: "nav-browse" },
  { to: "/backups", icon: History, label: "Backups", tourId: "nav-backups" },
  { to: "/prompts", icon: FileText, label: "Prompts", tourId: "nav-prompts" },
  { to: "/help", icon: HelpCircle, label: "Help", tourId: "nav-help" },
];

function NavContent({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-6">
        <h1 className="text-xl font-bold">Anki Splitter</h1>
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
            data-tour={item.tourId}
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
        <p className="text-xs text-muted-foreground">Anki Card Splitter v1.0</p>
      </div>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const location = useLocation();

  // 라우트 변경 시 Drawer 닫기 (이미 닫혀 있으면 무시)
  useEffect(() => {
    if (open) onClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {open && (
        <>
          {/* Backdrop — z-40: mobile header와 같은 레이어 */}
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            style={{ touchAction: "none" }}
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer — z-50: backdrop 위 */}
          <aside
            className="fixed left-0 top-0 z-50 h-dvh w-64 border-r bg-card md:hidden"
            style={{ overscrollBehavior: "contain" }}
          >
            <NavContent onNavClick={onClose} />
          </aside>
        </>
      )}
    </>
  );
}
