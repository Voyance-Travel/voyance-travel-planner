import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { saveReturnPath } from '@/utils/authReturnPath';

interface ProtectedRouteProps {
  children: ReactNode;
  requireQuiz?: boolean;
}

/**
 * Route wrapper that requires authentication
 * Optionally requires quiz completion
 */
export default function ProtectedRoute({
  children,
  requireQuiz = false,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Redirect to sign in if not authenticated
  if (!isAuthenticated) {
    const fullPath = location.pathname + location.search + location.hash;
    saveReturnPath(fullPath);
    return <Navigate to={ROUTES.SIGNIN} state={{ from: fullPath }} replace />;
  }

  // Redirect to quiz if required and not completed
  if (requireQuiz && !user?.quizCompleted) {
    return <Navigate to={ROUTES.QUIZ} replace />;
  }

  return <>{children}</>;
}
