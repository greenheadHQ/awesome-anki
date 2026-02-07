import {
  FileText,
  FolderOpen,
  HelpCircle,
  History,
  LayoutDashboard,
  Scissors,
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

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-xl font-bold">Anki Splitter</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-tour={item.tourId}
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
          <p className="text-xs text-muted-foreground">
            Anki Card Splitter v1.0
          </p>
        </div>
      </div>
    </aside>
  );
}
