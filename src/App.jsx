import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import ParticleBackground from './components/ParticleBackground';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import InvitePage from './pages/InvitePage';
import DashboardPage from './pages/DashboardPage';
import ScansPage from './pages/ScansPage';
import NewScanPage from './pages/NewScanPage';
import ScanDetailPage from './pages/ScanDetailPage';
import FindingsPage from './pages/FindingsPage';
import SettingsPage from './pages/SettingsPage';
import TeamPage from './pages/TeamPage';
import AuditLogPage from './pages/AuditLogPage';
import SuperAdminPage from './pages/SuperAdminPage';

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={<LoginPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/invite/:token" element={<InvitePage darkMode={darkMode} setDarkMode={setDarkMode} />} />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300 relative">
              <ParticleBackground />
              <Header darkMode={darkMode} setDarkMode={setDarkMode} />
              <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/scans" element={<ScansPage />} />
                  <Route path="/scans/new" element={<NewScanPage />} />
                  <Route path="/scans/:scanId" element={<ScanDetailPage />} />
                  <Route path="/findings" element={<FindingsPage />} />
                  <Route path="/settings" element={<SettingsPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
                  <Route path="/settings/team" element={
                    <ProtectedRoute requireAdmin>
                      <TeamPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <ProtectedRoute requireSuperAdmin>
                      <SuperAdminPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/audit-log" element={
                    <ProtectedRoute requireAdmin>
                      <AuditLogPage />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
