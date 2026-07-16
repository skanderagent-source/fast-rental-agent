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
import { useAuth } from './providers/AuthProvider';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

const MapPanel = lazy(() =>
  import('../features/agent/MapPanel').then((module) => ({ default: module.MapPanel })),
);
const AdminPanel = lazy(() =>
  import('../features/admin/AdminPanel').then((module) => ({ default: module.AdminPanel })),
);
const AddListingPage = lazy(() =>
  import('../features/admin/AddListingPage').then((module) => ({ default: module.AddListingPage })),
);
const EditListingPage = lazy(() =>
  import('../features/admin/AddListingPage').then((module) => ({ default: module.EditListingPage })),
);

function EntryRoute({ showLogin = false }: { showLogin?: boolean }) {
  const { loading, profile } = useAuth();
  if (loading) return <LoadingSpinner label="Chargement de la session…" />;
  if (profile) return <Navigate to="/app/search" replace />;
  return showLogin ? <LoginPage /> : <Navigate to="/agent-login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute role="admin">
      <Suspense fallback={<LoadingSpinner label="Chargement de l’administration…" />}>
        {children}
      </Suspense>
    </ProtectedRoute>
  );
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
        <Route path="admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="admin/listings/new" element={<AdminRoute><AddListingPage /></AdminRoute>} />
        <Route path="admin/listings/:id/edit" element={<AdminRoute><EditListingPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<EntryRoute />} />
    </Routes>
  );
}
