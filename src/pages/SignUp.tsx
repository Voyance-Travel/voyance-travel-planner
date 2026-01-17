import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Compass, Eye, EyeOff } from 'lucide-react';
import AuthLayout from '@/components/layout/AuthLayout';
import Head from '@/components/common/Head';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await signup(email, password, name);
      navigate(ROUTES.QUIZ);
    } catch (error) {
      console.error('Signup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Head
        title="Sign Up | Voyance"
        description="Create your Voyance account and start planning personalized travel experiences."
      />
      
      <div className="min-h-screen pt-16 grid grid-cols-1 lg:grid-cols-2">
        {/* Left side - Image */}
        <div className="relative hidden lg:block">
          <HeroImageWithFallback
            src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200"
            alt="Road trip through mountains"
            fallbackSources={[
              'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200',
            ]}
            overlayGradient="from-primary/30 via-transparent to-secondary/30"
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="text-center text-white p-8"
            >
              <Compass className="w-16 h-16 mx-auto mb-6 text-white/80" />
              <h2 className="text-4xl font-display font-light mb-4">
                Start Your Journey
              </h2>
              <p className="text-lg text-white/90 max-w-md">
                Create an account to unlock personalized travel planning powered by AI.
              </p>
            </motion.div>
          </div>
        </div>
        
        {/* Right side - Form */}
        <div className="flex items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">
                Create Account
              </h1>
              <p className="text-muted-foreground">
                Already have an account?{' '}
                <Link to={ROUTES.SIGNIN} className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
            
            <p className="mt-6 text-center text-sm text-muted-foreground">
              By signing up, you agree to our{' '}
              <Link to={ROUTES.TERMS} className="text-primary hover:underline">Terms</Link>
              {' '}and{' '}
              <Link to={ROUTES.PRIVACY} className="text-primary hover:underline">Privacy Policy</Link>
            </p>
            
            <div className="mt-8 p-4 bg-muted/50 rounded-lg text-center text-sm text-muted-foreground">
              <strong>Prototype:</strong> Any email/password will work for demo purposes.
            </div>
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
