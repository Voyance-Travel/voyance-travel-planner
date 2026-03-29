import { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { logClientError } from '@/utils/logClientError';

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

  componentDidCatch(error: Error, errorInfo: unknown): void {
    console.error('[ErrorBoundary] Caught error:', error.message, error.stack);
    console.error('[ErrorBoundary] Component stack:', errorInfo);

    // Persist to client_errors table so render crashes are visible in backend logs
    const componentStack = typeof errorInfo === 'object' && errorInfo !== null
      ? (errorInfo as any).componentStack
      : undefined;

    logClientError(
      error.message,
      error.stack,
      'ErrorBoundary',
      {
        source: 'error_boundary',
        componentStack: componentStack?.slice(0, 3000),
        route: window.location.pathname + window.location.search,
      }
    );
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
          <div className="flex min-h-[60vh] items-center justify-center bg-background px-6">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-9 w-9 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-serif font-normal text-foreground mb-3">
                Small detour.
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Something didn't load quite right. A quick refresh usually does the trick.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  Refresh page
                </button>
                <button
                  onClick={() => { window.location.href = '/'; }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-foreground rounded-lg hover:bg-muted transition-colors font-medium"
                >
                  Go home
                </button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
