import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './providers/AuthProvider';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

// Route guards improve UX only. The VPS API remains the authorization source of truth.
export function ProtectedRoute({ children, role }: { children: ReactNode; role?: 'admin' }) {
  const { loading, profile } = useAuth();

  if (loading) return <LoadingSpinner label="Chargement..." />;
  if (!profile) return <Navigate to="/agent-login" replace />;
  if (role === 'admin' && profile.role !== 'admin') {
    return <Navigate to="/app/search" replace />;
  }
  return <>{children}</>;
}
