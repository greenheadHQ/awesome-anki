import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { CardBrowser } from './pages/CardBrowser';
import { SplitWorkspace } from './pages/SplitWorkspace';
import { BackupManager } from './pages/BackupManager';
import { PromptManager } from './pages/PromptManager';
import { Help } from './pages/Help';

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
