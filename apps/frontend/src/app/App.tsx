import { AuthProvider } from './providers/AuthProvider';
import { QueryProvider } from './providers/QueryProvider';
import { ToastProvider } from '../components/common/ToastProvider';
import { AppErrorBoundary } from '../components/common/AppErrorBoundary';
import { InstallPrompt } from '../components/common/InstallPrompt';
import { AppRoutes } from './routes';

export function App() {
  return (
    <AppErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
            <InstallPrompt />
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </AppErrorBoundary>
  );
}
