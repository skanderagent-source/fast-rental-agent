import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { ForcePasswordChangePage } from '../features/auth/ForcePasswordChangePage';
import { PasswordRecoveryPage } from '../features/auth/PasswordRecoveryPage';
import { SearchPanel } from '../features/agent/SearchPanel';
import { DemandesPanel } from '../features/agent/DemandesPanel';
import { UserDashboard } from '../features/dashboard/UserDashboard';
import { AdminPanel } from '../features/admin/AdminPanel';
import { AddListingPage, EditListingPage } from '../features/admin/AddListingPage';
import { useAuth } from './providers/AuthProvider';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

const MapPanel = lazy(() =>
  import('../features/agent/MapPanel').then((module) => ({ default: module.MapPanel })),
);

function EntryRoute({ showLogin = false }: { showLogin?: boolean }) {
  const { loading, profile } = useAuth();
  if (loading) return <LoadingSpinner label="Chargement de la session…" />;
  if (profile) return <Navigate to="/app/search" replace />;
  return showLogin ? <LoginPage /> : <Navigate to="/agent-login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EntryRoute />} />
      <Route path="/agent-login" element={<EntryRoute showLogin />} />
      <Route path="/auth/reset-password" element={<PasswordRecoveryPage />} />
      <Route path="/auth/force-password-change" element={<ForcePasswordChangePage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="search" replace />} />
        <Route path="search" element={<SearchPanel />} />
        <Route path="demandes" element={<DemandesPanel />} />
        <Route
          path="map"
          element={
            <Suspense fallback={<LoadingSpinner label="Chargement de la carte…" />}>
              <MapPanel />
            </Suspense>
          }
        />
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="admin" element={<ProtectedRoute role="admin"><AdminPanel /></ProtectedRoute>} />
        <Route path="admin/listings/new" element={<ProtectedRoute role="admin"><AddListingPage /></ProtectedRoute>} />
        <Route path="admin/listings/:id/edit" element={<ProtectedRoute role="admin"><EditListingPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<EntryRoute />} />
    </Routes>
  );
}
