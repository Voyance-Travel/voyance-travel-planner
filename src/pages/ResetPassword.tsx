import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { logPasswordResetComplete } from '@/services/authAuditAPI';

// Validation schema
const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  // Extract URL parameters
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
  });

  const newPassword = watch('newPassword');

  // Check for valid session from password reset flow
  useEffect(() => {
    // Supabase handles the token verification automatically
    // when user clicks the reset link, they get a session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // No valid session - redirect to forgot password
        navigate('/forgot-password', { 
          state: { 
            message: 'Invalid or expired reset link. Please request a new password reset.' 
          }
        });
      }
    });
  }, [navigate]);

  const onSubmit = async (data: ResetPasswordForm) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitMessage('');

    try {
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // Log the password reset completion
      if (updateData.user) {
        await logPasswordResetComplete();
      }

      setSubmitStatus('success');
      setSubmitMessage('Your password has been reset successfully.');
      
      // Sign out so user logs in with new password
      await supabase.auth.signOut();
      
      // Redirect to signin after 3 seconds
      setTimeout(() => {
        navigate('/signin', {
          state: { 
            message: 'Password reset successful! Please sign in with your new password.' 
          }
        });
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setSubmitStatus('error');
      setSubmitMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const strengthLevels = [
      { label: 'Very Weak', color: 'bg-destructive' },
      { label: 'Weak', color: 'bg-orange-500' },
      { label: 'Fair', color: 'bg-yellow-500' },
      { label: 'Good', color: 'bg-primary' },
      { label: 'Strong', color: 'bg-accent' },
    ];

    return {
      score,
      label: strengthLevels[Math.min(score, 4)].label,
      color: strengthLevels[Math.min(score, 4)].color,
    };
  };

  const passwordStrength = getPasswordStrength(newPassword || '');

  // Success state
  if (submitStatus === 'success') {
    return (
      <>
        <Head title="Password Reset Successful | Voyance" />
        <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full text-center"
          >
            <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-foreground mb-3">
              Password Reset Successful!
            </h2>
            <p className="text-muted-foreground mb-6">
              {submitMessage}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Redirecting to sign in page in 3 seconds...
            </p>
            <Link to="/signin">
              <Button variant="outline" className="gap-2">
                Sign in now
              </Button>
            </Link>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head title="Reset Password | Voyance" />
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
              Reset Your Password
            </h1>
            <p className="text-muted-foreground">
              {email ? `Enter a new password for ${email}` : 'Please enter your new password below'}
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            {/* New Password Field */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  {...register('newPassword')}
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  )}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-1.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium min-w-[70px]">
                      {passwordStrength.label}
                    </span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    <li className={newPassword.length >= 8 ? 'text-accent' : ''}>
                      {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(newPassword) ? 'text-accent' : ''}>
                      {/[A-Z]/.test(newPassword) ? '✓' : '○'} One uppercase letter
                    </li>
                    <li className={/[a-z]/.test(newPassword) ? 'text-accent' : ''}>
                      {/[a-z]/.test(newPassword) ? '✓' : '○'} One lowercase letter
                    </li>
                    <li className={/[0-9]/.test(newPassword) ? 'text-accent' : ''}>
                      {/[0-9]/.test(newPassword) ? '✓' : '○'} One number
                    </li>
                  </ul>
                </div>
              )}
              
              {errors.newPassword && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-sm text-destructive flex items-center gap-1"
                >
                  <AlertCircle className="w-4 h-4" />
                  {errors.newPassword.message}
                </motion.p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  {...register('confirmPassword')}
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  )}
                </button>
              </div>
              
              {errors.confirmPassword && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-sm text-destructive flex items-center gap-1"
                >
                  <AlertCircle className="w-4 h-4" />
                  {errors.confirmPassword.message}
                </motion.p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>

            {/* Error Message */}
            {submitStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-lg bg-destructive/10 border border-destructive/20 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-destructive">
                      Password Reset Failed
                    </h3>
                    <p className="mt-1 text-sm text-destructive/80">
                      {submitMessage}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Back to Sign In Link */}
            <div className="text-center">
              <Link
                to="/signin"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to sign in
              </Link>
            </div>
          </motion.form>
        </div>
      </div>
    </>
  );
}
