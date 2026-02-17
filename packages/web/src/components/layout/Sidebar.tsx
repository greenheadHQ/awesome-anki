import {
  FileText,
  FolderOpen,
  HelpCircle,
  History,
  LayoutDashboard,
  Scissors,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
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

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* 반투명 배경 오버레이 (모바일 only) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onClose();
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 border-r bg-card",
          "transition-transform duration-200 ease-in-out",
          "md:z-40 md:translate-x-0 md:transition-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b px-6">
            <h1 className="text-xl font-bold">Anki Splitter</h1>
            {/* 모바일 닫기 버튼 */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 md:hidden"
              aria-label="메뉴 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-tour={item.tourId}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
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
            <p className="text-xs text-muted-foreground">
              Anki Card Splitter v1.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
