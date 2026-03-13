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

  componentDidCatch(error: Error, errorInfo: unknown): void {
    console.error('[ErrorBoundary] Caught error:', error.message, error.stack);
    console.error('[ErrorBoundary] Component stack:', errorInfo);
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
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M3 7v4a1 1 0 0 0 1 1h3" />
                  <path d="M7 7v10" />
                  <path d="M10 8.5V7h4v1.5" />
                  <path d="M10 8.5a2.5 2.5 0 0 0 5 0" />
                  <path d="M14 7v10" />
                  <path d="M17 7v4a1 1 0 0 1-1 1h-3" />
                  <circle cx="12" cy="20" r="1" />
                  <path d="M12 17v2" />
                </svg>
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 21h5v-5" />
                  </svg>
                  Refresh page
                </button>
                <button
                  onClick={() => window.location.href = '/'}
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
