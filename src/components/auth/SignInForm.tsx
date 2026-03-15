import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { consumeReturnPath, saveReturnPath } from '@/utils/authReturnPath';
import { savePendingInviteToken, consumePendingInviteToken, extractInviteTokenFromPath } from '@/utils/inviteTokenPersistence';

const signInSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

type SignInFormData = z.infer<typeof signInSchema>;

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  
  const stateFrom = (location.state as { from?: string | { pathname?: string; search?: string } })?.from;
  const queryNext = searchParams.get('next') || searchParams.get('redirect');
  const nextPath = typeof stateFrom === 'string' 
    ? stateFrom 
    : (stateFrom ? (stateFrom.pathname || '') + (stateFrom.search || '') : null)
      || queryNext 
      || null;

  // Extract invite token from URL param or redirect path
  const urlInviteToken = searchParams.get('inviteToken') || extractInviteTokenFromPath(nextPath);

  // Persist redirect intent and invite token on mount
  useEffect(() => {
    if (nextPath && nextPath.startsWith('/')) {
      saveReturnPath(nextPath);
    }
    if (urlInviteToken) {
      savePendingInviteToken(urlInviteToken);
    }
  }, [nextPath, urlInviteToken]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: SignInFormData) => {
    setServerError('');
    setIsLoading(true);
    
    try {
      await login(data.email, data.password);
      
      // Prioritize invite token recovery over generic return path
      const pendingToken = consumePendingInviteToken();
      if (pendingToken) {
        navigate(`/invite/${pendingToken}`, { replace: true });
      } else {
        navigate(nextPath || consumeReturnPath(ROUTES.PROFILE.VIEW));
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in. Please try again.';
      setServerError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Build link to signup preserving invite context
  const signUpLink = (() => {
    const params = new URLSearchParams();
    if (nextPath) params.set('redirect', nextPath);
    if (urlInviteToken) params.set('inviteToken', urlInviteToken);
    const qs = params.toString();
    return qs ? `${ROUTES.SIGNUP}?${qs}` : ROUTES.SIGNUP;
  })();

  return (
    <div className="space-y-6">
      <SocialLoginButtons mode="signin" />
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-gradient-to-br from-slate-50 to-white text-slate-500">
            or continue with email
          </span>
        </div>
      </div>

      <motion.form 
        onSubmit={handleSubmit(onSubmit)} 
        className="space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {serverError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 text-sm text-red-600 bg-red-50 rounded-lg"
          >
            {serverError}
          </motion.div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-700">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              className={`pl-10 h-12 bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400 ${errors.email ? 'border-red-400' : ''}`}
            />
          </div>
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-700">Password</Label>
            <Link 
              to="/forgot-password" 
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              {...register('password')}
              className={`pl-10 pr-10 h-12 bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400 ${errors.password ? 'border-red-400' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>

        <p className="text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link 
            to={signUpLink} 
            className="font-medium text-slate-900 hover:underline"
          >
            Create one
          </Link>
        </p>
      </motion.form>
    </div>
  );
}
