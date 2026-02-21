import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorFallback } from "./components/ErrorFallback";
import { Layout } from "./components/layout/Layout";
import { RouteError } from "./components/RouteError";
import { BackupManager } from "./pages/BackupManager";
import { CardBrowser } from "./pages/CardBrowser";
import { Dashboard } from "./pages/Dashboard";
import { Help } from "./pages/Help";
import { PromptManager } from "./pages/PromptManager";
import { SplitHistory } from "./pages/SplitHistory";
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
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />} errorElement={<RouteError />}>
              <Route
                index
                element={<Dashboard />}
                errorElement={<RouteError />}
              />
              <Route
                path="split"
                element={<SplitWorkspace />}
                errorElement={<RouteError />}
              />
              <Route
                path="browse"
                element={<CardBrowser />}
                errorElement={<RouteError />}
              />
              <Route
                path="backups"
                element={<BackupManager />}
                errorElement={<RouteError />}
              />
              <Route
                path="prompts"
                element={<PromptManager />}
                errorElement={<RouteError />}
              />
              <Route
                path="history"
                element={<SplitHistory />}
                errorElement={<RouteError />}
              />
              <Route
                path="help"
                element={<Help />}
                errorElement={<RouteError />}
              />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" richColors duration={4000} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
