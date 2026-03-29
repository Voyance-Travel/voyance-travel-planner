import { Component, ReactNode } from 'react';
import { logClientError, extractFailingComponent } from '@/utils/logClientError';

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

    const componentStack = typeof errorInfo === 'object' && errorInfo !== null
      ? (errorInfo as any).componentStack
      : undefined;

    const failingComponent = extractFailingComponent(componentStack);

    logClientError(
      error.message,
      error.stack,
      failingComponent || 'ErrorBoundary',
      {
        source: 'error_boundary',
        failing_component: failingComponent,
        componentStack: componentStack?.slice(0, 3000),
        route: window.location.pathname + window.location.search,
        error_type: error.message?.includes('toLowerCase') ? 'toLowerCase_crash' : 'render_crash',
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
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
