import { AuthProvider } from './providers/AuthProvider';
import { QueryProvider } from './providers/QueryProvider';
import { ToastProvider } from '../components/common/ToastProvider';
import { AppRoutes } from './routes';

export function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
