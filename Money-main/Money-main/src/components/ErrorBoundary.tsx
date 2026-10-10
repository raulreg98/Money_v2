import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return <DefaultErrorFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

export function DefaultErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh] px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
        <h2 className="text-white font-semibold text-lg">Ha ocurrido un error</h2>
        <p className="text-slate-400 text-sm">
          Se ha producido un error inesperado. Puedes intentar recargar la página.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm py-2.5 rounded-lg transition-colors"
          >
            Recargar
          </button>
          <button
            onClick={onReset}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
        <details className="mt-2">
          <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400">
            Detalles técnicos
          </summary>
          <pre className="mt-2 text-xs text-red-400/80 bg-slate-950 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
      </div>
    </div>
  );
}
