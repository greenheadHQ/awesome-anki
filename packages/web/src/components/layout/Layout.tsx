import { Menu } from "lucide-react";
import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarAnimating, setIsSidebarAnimating] = useState(false);

  const handleOpenSidebar = useCallback(() => {
    if (sidebarOpen || isSidebarAnimating) return;
    setSidebarOpen(true);
  }, [isSidebarAnimating, sidebarOpen]);

  const handleCloseSidebar = useCallback(() => {
    if (!sidebarOpen) return;
    setSidebarOpen(false);
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        open={sidebarOpen}
        onClose={handleCloseSidebar}
        onAnimationStateChange={setIsSidebarAnimating}
      />

      <main className="md:pl-64" inert={sidebarOpen || undefined}>
        {/* Mobile header — z-30: drawer backdrop(z-40)보다 낮아 드로어 열 때 어두워짐 */}
        <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b bg-card px-3 md:hidden">
          <span className="typo-h3">Anki Splitter</span>
          <button
            type="button"
            onClick={handleOpenSidebar}
            disabled={isSidebarAnimating || sidebarOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <div className="container mx-auto px-3 pt-16 pb-3 md:pt-5 md:px-6 md:pb-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
