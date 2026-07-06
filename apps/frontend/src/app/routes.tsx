import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { ForcePasswordChangePage } from '../features/auth/ForcePasswordChangePage';
import { PasswordRecoveryPage } from '../features/auth/PasswordRecoveryPage';
import { SearchPanel } from '../features/agent/SearchPanel';
import { DemandesPanel } from '../features/agent/DemandesPanel';
import { MapPanel } from '../features/agent/MapPanel';
import { UserDashboard } from '../features/dashboard/UserDashboard';
import { AdminPanel } from '../features/admin/AdminPanel';
import { AddListingPage, EditListingPage } from '../features/admin/AddListingPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/agent-login" replace />} />
      <Route path="/agent-login" element={<LoginPage />} />
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
        <Route path="map" element={<MapPanel />} />
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="admin" element={<ProtectedRoute role="admin"><AdminPanel /></ProtectedRoute>} />
        <Route path="admin/listings/new" element={<ProtectedRoute role="admin"><AddListingPage /></ProtectedRoute>} />
        <Route path="admin/listings/:id/edit" element={<ProtectedRoute role="admin"><EditListingPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/agent-login" replace />} />
    </Routes>
  );
}
