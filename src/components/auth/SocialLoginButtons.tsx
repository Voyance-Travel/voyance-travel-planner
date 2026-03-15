import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable/index';
import { supabase } from '@/integrations/supabase/client';
import { saveReturnPath } from '@/utils/authReturnPath';
import { savePendingInviteToken, extractInviteTokenFromPath } from '@/utils/inviteTokenPersistence';
import { toast } from 'sonner';

const isCustomDomain = () =>
  !window.location.hostname.includes('lovable.app') &&
  !window.location.hostname.includes('lovableproject.com');

interface SocialLoginButtonsProps {
  mode?: 'signin' | 'signup';
}

export function SocialLoginButtons({ mode = 'signin' }: SocialLoginButtonsProps) {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingApple, setIsLoadingApple] = useState(false);
  const [searchParams] = useSearchParams();

  const redirectPath = searchParams.get('redirect') || searchParams.get('next');
  const inviteToken = searchParams.get('inviteToken') || extractInviteTokenFromPath(redirectPath);

  const persistAuthReturnPath = () => {
    if (redirectPath && redirectPath.startsWith('/')) {
      saveReturnPath(redirectPath);
    } else {
      // No explicit redirect param — save the current path so the user returns here
      // after OAuth (saveReturnPath already filters out /signin, /signup, etc.)
      saveReturnPath(window.location.pathname);
    }
    if (inviteToken) {
      savePendingInviteToken(inviteToken);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoadingApple(true);
    persistAuthReturnPath();
    try {
      if (isCustomDomain()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: window.location.origin,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      } else {
        const result = await lovable.auth.signInWithOAuth('apple', {
          redirect_uri: window.location.origin,
        });
        if (result.redirected) return;
        if (result.error) throw result.error;
      }
    } catch (error) {
      toast.error('Failed to sign in with Apple');
      console.error('Apple login error:', error);
    } finally {
      setIsLoadingApple(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoadingGoogle(true);
    persistAuthReturnPath();
    try {
      if (isCustomDomain()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      } else {
        const result = await lovable.auth.signInWithOAuth('google', {
          redirect_uri: window.location.origin,
        });
        if (result.redirected) return;
        if (result.error) throw result.error;
      }
    } catch (error) {
      toast.error('Failed to sign in with Google');
      console.error('Google login error:', error);
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const actionText = mode === 'signup' ? 'Sign up' : 'Continue';
  const anyLoading = isLoadingGoogle || isLoadingApple;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="space-y-3"
    >
      {/* Apple Button — Apple requires equal or greater prominence */}
      <Button
        type="button"
        variant="outline"
        onClick={handleAppleLogin}
        disabled={anyLoading}
        className="w-full h-12 bg-black hover:bg-gray-900 text-white border-black dark:bg-white dark:hover:bg-gray-100 dark:text-black dark:border-white font-medium"
      >
        {isLoadingApple ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-transparent dark:border-black/50 dark:border-t-transparent" />
            Connecting...
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {actionText} with Apple
          </span>
        )}
      </Button>

      {/* Google Button */}
      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleLogin}
        disabled={anyLoading}
        className="w-full h-12 bg-background hover:bg-muted border-border text-foreground font-medium"
      >
        {isLoadingGoogle ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground border-t-transparent" />
            Connecting...
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {actionText} with Google
          </span>
        )}
      </Button>
    </motion.div>
  );
}
