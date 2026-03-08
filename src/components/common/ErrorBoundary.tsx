import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: unknown): void {
    // Can log to error reporting service here
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const isGenerationRoute = typeof window !== 'undefined' && (
        window.location.pathname.toLowerCase().includes('/itinerary') ||
        window.location.search.toLowerCase().includes('generate=true')
      );

      if (isGenerationRoute) {
        console.log('[ErrorBoundary] Suppressing fallback UI on itinerary generation route');
        return this.props.fallback ?? null;
      }

      return (
        this.props.fallback || (
          <div className="p-6 bg-destructive/10 rounded-lg border border-destructive/20 text-center">
            <h2 className="text-xl font-medium text-destructive mb-2">
              Something went wrong
            </h2>
            <p className="text-destructive/80 mb-4">
              We encountered an error while trying to display this component.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
            >
              Refresh Page
            </button>
            {this.state.error && (
              <details className="mt-4 text-left bg-card p-3 rounded border border-border">
                <summary className="cursor-pointer text-foreground font-medium">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs text-muted-foreground overflow-auto p-2 bg-muted rounded">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        )
      );
    }

    return this.props.children;
  }
}
