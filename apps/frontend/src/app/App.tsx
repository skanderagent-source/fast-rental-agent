import { AuthProvider } from './providers/AuthProvider';
import { QueryProvider } from './providers/QueryProvider';
import { ToastProvider } from '../components/common/ToastProvider';
import { AppErrorBoundary } from '../components/common/AppErrorBoundary';
import { AppRoutes } from './routes';

export function App() {
  return (
    <AppErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </AppErrorBoundary>
  );
}
