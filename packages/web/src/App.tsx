import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { BackupManager } from "./pages/BackupManager";
import { CardBrowser } from "./pages/CardBrowser";
import { Dashboard } from "./pages/Dashboard";
import { Help } from "./pages/Help";
import { PromptManager } from "./pages/PromptManager";
import { SplitWorkspace } from "./pages/SplitWorkspace";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="split" element={<SplitWorkspace />} />
            <Route path="browse" element={<CardBrowser />} />
            <Route path="backups" element={<BackupManager />} />
            <Route path="prompts" element={<PromptManager />} />
            <Route path="help" element={<Help />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
