import { useState } from 'react';
import {
  HashRouter,
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ApiSettingsModal } from './components/features/settings/ApiSettingsModal';
import { NotificationDropdown } from './components/features/notifications/NotificationDropdown';
import { ThemeProvider } from './components/theme/theme-provider';

// Pages
import Dashboard from './features/Dashboard';
import UploadPage from './features/UploadPage';
import ResultsExplorer from './features/ResultsExplorer';
import StudentProfile from './features/StudentProfile';
import Analytics from './features/Analytics';
import ExportPage from './features/ExportPage';

const isBlobEnvironment = window.location.protocol === 'blob:';

const AppContent = () => {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);

  return (
    <Layout
      onSettingsClick={() => setSettingsOpen(true)}
      onNotificationClick={() => setNotifOpen(true)}
    >
      <ApiSettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
      <NotificationDropdown isOpen={isNotifOpen} onClose={() => setNotifOpen(false)} />

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/results" element={<ResultsExplorer />} />
        <Route path="/profile" element={<StudentProfile />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/export" element={<ExportPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const RouterComponent = isBlobEnvironment ? MemoryRouter : HashRouter;
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <RouterComponent>
        <AppContent />
      </RouterComponent>
    </ThemeProvider>
  );
}
