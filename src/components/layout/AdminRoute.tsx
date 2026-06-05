import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { ROUTES } from '@/config/routes';

/**
 * Route wrapper requiring an authenticated ADMIN user.
 * Composes ProtectedRoute (auth) with a server-checked admin-role gate so
 * non-admins never render admin pages. Previously admin routes used plain
 * ProtectedRoute (auth only), letting any logged-in user load admin chunks
 * (incl. the hardcoded cost/margin table). See QA C-CRED-3.
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminGate>{children}</AdminGate>
    </ProtectedRoute>
  );
}

function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <>{children}</>;
}
