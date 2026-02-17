import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import { useMobileNav } from "../../hooks/useMobileNav";
import { Sidebar } from "./Sidebar";

export function Layout() {
  const { isOpen, open, close } = useMobileNav();

  return (
    <div className="min-h-screen bg-background">
      {/* 모바일 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 border-b bg-card px-4 h-[var(--mobile-header-height)] md:hidden">
        <button
          type="button"
          onClick={open}
          className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2"
          aria-label="메뉴 열기"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold">Anki Splitter</h1>
      </header>

      <Sidebar isOpen={isOpen} onClose={close} />

      <main className="pl-0 md:pl-64">
        <div className="container mx-auto p-4 pt-[calc(var(--mobile-header-height)+0.5rem)] md:p-6 md:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
