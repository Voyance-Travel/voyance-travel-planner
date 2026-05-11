import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { consumeReturnPath } from '@/utils/authReturnPath';
import { consumePendingInviteToken } from '@/utils/inviteTokenPersistence';

/**
 * OAuth callback landing page.
 *
 * The Lovable / Supabase OAuth broker redirects back to `${origin}/auth/callback`
 * after the provider exchange. By the time we get here the session is usually
 * already set (broker writes it before redirecting), so we just wait briefly
 * for `useAuth()` to reflect it, then send the user to their saved return path.
 *
 * Without this page, React Router falls through to NotFound — which is exactly
 * the "Wrong turn. This page doesn't exist…" screen users were seeing right
 * after Google sign-in.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const settledRef = useRef(false);

  useEffect(() => {
    if (settledRef.current) return;

    // Happy path: session is already available.
    if (user) {
      settledRef.current = true;
      const inviteToken = consumePendingInviteToken();
      const returnPath = consumeReturnPath('/profile');
      const dest = inviteToken ? `/invite/${inviteToken}` : returnPath;
      navigate(dest, { replace: true });
      return;
    }

    // Fail-safe: if we never get a session, don't strand the user on a spinner.
    const timeout = window.setTimeout(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      toast.error('Sign-in did not complete. Please try again.');
      navigate('/signin?error=oauth_failed', { replace: true });
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [user, isLoading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center px-8"
      >
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <h1 className="text-xl font-serif text-foreground mb-1">Signing you in…</h1>
        <p className="text-sm text-muted-foreground">Just a moment.</p>
      </motion.div>
    </div>
  );
};

export default AuthCallback;
