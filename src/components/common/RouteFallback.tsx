// Lightweight fallback shown while a lazy-loaded route chunk is downloading.
// Intentionally minimal: a single centered branded spinner, no layout shift.
export default function RouteFallback() {
  return (
    <div
      className="min-h-[60vh] w-full flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
    </div>
  );
}
