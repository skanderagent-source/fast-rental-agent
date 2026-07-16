import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryState = {
  hasError: boolean;
};

type AppErrorBoundaryProps = {
  children: ReactNode;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('UI render error', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty" style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>
          <div>Une erreur est survenue. Recharge la page.</div>
        </div>
      );
    }
    return this.props.children;
  }
}
