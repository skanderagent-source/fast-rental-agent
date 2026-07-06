import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './providers/AuthProvider';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: 'admin' }) {
  const { loading, profile } = useAuth();

  if (loading) return <LoadingSpinner label="Chargement..." />;
  if (!profile) return <Navigate to="/agent-login" replace />;
  if (role === 'admin' && profile.role !== 'admin') {
    return <div className="empty"><div>Accès refusé</div></div>;
  }
  return <>{children}</>;
}
