import { Menu } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="md:pl-64" inert={sidebarOpen || undefined}>
        {/* Mobile header — z-40: drawer backdrop과 같은 레이어 */}
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b bg-card px-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 text-lg font-bold">Anki Splitter</span>
        </header>

        <div className="container mx-auto pt-14 p-3 md:pt-5 md:px-6 md:pb-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
