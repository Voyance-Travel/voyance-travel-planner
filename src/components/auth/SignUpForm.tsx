import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Check, X } from 'lucide-react';
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

const signUpSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-orange-500' };
  if (score <= 3) return { score: 3, label: 'Good', color: 'bg-yellow-500' };
  if (score <= 4) return { score: 4, label: 'Strong', color: 'bg-green-500' };
  return { score: 5, label: 'Very Strong', color: 'bg-emerald-500' };
}

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup } = useAuth();
  const queryRedirect = searchParams.get('redirect') || searchParams.get('next');

  // Extract invite token from URL param or redirect path
  const urlInviteToken = searchParams.get('inviteToken') || extractInviteTokenFromPath(queryRedirect);

  // Persist redirect intent and invite token on mount
  useEffect(() => {
    if (queryRedirect && queryRedirect.startsWith('/')) {
      saveReturnPath(queryRedirect);
    }
    if (urlInviteToken) {
      savePendingInviteToken(urlInviteToken);
    }
  }, [queryRedirect, urlInviteToken]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  const password = watch('password', '');
  const passwordStrength = getPasswordStrength(password);
  
  const passwordRequirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /\d/.test(password), text: 'One number' },
  ];

  const onSubmit = async (data: SignUpFormData) => {
    setServerError('');
    setIsLoading(true);
    
    try {
      const result = await signup(data.email, data.password, { firstName: data.firstName.trim(), lastName: data.lastName.trim() });
      
      // Email confirmation required — show friendly message instead of navigating
      if (result.needsEmailConfirmation) {
        setEmailConfirmationSent(true);
        return;
      }

      // Prioritize invite token recovery over generic return path
      const pendingToken = consumePendingInviteToken();
      if (pendingToken) {
        navigate(`/invite/${pendingToken}`, { replace: true });
      } else {
        navigate(queryRedirect || consumeReturnPath('/'));
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setServerError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Build link to signin preserving invite context
  const signInLink = (() => {
    const params = new URLSearchParams();
    if (queryRedirect) params.set('redirect', queryRedirect);
    if (urlInviteToken) params.set('inviteToken', urlInviteToken);
    const qs = params.toString();
    return qs ? `${ROUTES.SIGNIN}?${qs}` : ROUTES.SIGNIN;
  })();

  if (emailConfirmationSent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 py-8"
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <Mail className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Check your email</h3>
        <p className="text-sm text-slate-600 max-w-sm mx-auto">
          We've sent a confirmation link to your email.
          {urlInviteToken
            ? " After confirming, you'll be redirected to join the trip."
            : ' Please confirm your account to get started.'}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <SocialLoginButtons mode="signup" />
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-gradient-to-bl from-white via-rose-50/30 to-amber-50/30 text-slate-500">
            or sign up with email
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
            {serverError.includes('already exists') && (
              <a href="/signin" className="block mt-1 font-medium text-primary underline underline-offset-2">
                Go to Sign In →
              </a>
            )}
          </motion.div>
        )}
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-slate-700">First Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="firstName"
                type="text"
                placeholder="First"
                {...register('firstName')}
                className={`pl-10 h-12 bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400 ${errors.firstName ? 'border-red-400' : ''}`}
              />
            </div>
            {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-slate-700">Last Name</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="Last"
              {...register('lastName')}
              className={`h-12 bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400 ${errors.lastName ? 'border-red-400' : ''}`}
            />
            {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
          </div>
        </div>
        
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
          <Label htmlFor="password" className="text-slate-700">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password"
              {...register('password')}
              className={`pl-10 pr-10 h-12 bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400 ${errors.password ? 'border-red-400' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          
          {password && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 pt-2"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    className={`h-full transition-colors duration-300 ${passwordStrength.color}`}
                  />
                </div>
                <span className="text-xs text-slate-500">{passwordStrength.label}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-1">
                {passwordRequirements.map((req, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    {req.met ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-slate-300" />
                    )}
                    <span className={req.met ? 'text-slate-600' : 'text-slate-400'}>
                      {req.text}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating account...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Create account
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link 
            to={signInLink} 
            className="font-medium text-slate-900 hover:underline"
          >
            Sign in
          </Link>
        </p>
        
        <p className="text-center text-xs text-slate-400 pt-4">
          By creating an account, you agree to our{' '}
          <Link to={ROUTES.TERMS} className="underline hover:text-slate-600">Terms</Link>
          {' '}and{' '}
          <Link to={ROUTES.PRIVACY} className="underline hover:text-slate-600">Privacy Policy</Link>
        </p>
      </motion.form>
    </div>
  );
}
