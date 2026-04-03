import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { SignInForm } from '@/components/auth/SignInForm';
import Head from '@/components/common/Head';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import AuthLayout from '@/components/layout/AuthLayout';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeUnsplashUrl } from '@/utils/unsplash';
import { Compass } from 'lucide-react';

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const nextPath = searchParams.get('next') || '/profile';
  const isRedirectedFromProtected = nextPath && nextPath.startsWith('/');

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(nextPath || '/profile', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, nextPath]);

  const heroImage = {
    src: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80',
    alt: 'Travelers on a boat crossing a pristine alpine lake at sunrise',
    fallbacks: [
      'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1920&q=80',
      'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1920&q=80',
    ],
  };

  return (
    <AuthLayout>
      <Head
        title="Sign In | Voyance"
        description="Sign in to your Voyance account to continue planning your personalized travel experiences."
      />
      <div className="min-h-screen flex">
        {/* Left: Editorial image */}
        <motion.div
          className="relative hidden lg:flex lg:w-1/2 xl:w-3/5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <HeroImageWithFallback
            src={heroImage.src}
            alt={heroImage.alt}
            fallbackSources={heroImage.fallbacks}
            overlayGradient="from-black/40 via-black/20 to-black/60"
            className="h-full object-cover"
          />
          
          {/* Editorial overlay content */}
          <div className="absolute inset-0 flex flex-col justify-between p-10 lg:p-12">
            {/* Top: Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Link to="/" className="inline-flex items-center gap-2 group">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Compass className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-display font-bold text-white">
                  Voyance
                </span>
              </Link>
            </motion.div>
            
            {/* Bottom: Quote and features */}
            <div className="max-w-lg">
              <motion.blockquote
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="mb-8"
              >
                <p className="text-3xl lg:text-4xl font-display font-light text-white leading-snug mb-4">
                  "Travel isn't always pretty. It isn't always comfortable. But that's okay. The journey changes you."
                </p>
                <footer className="text-white/70 text-sm font-medium">- Anthony Bourdain</footer>
              </motion.blockquote>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className="flex flex-wrap gap-3"
              >
                {[
                  'AI-Powered Itineraries',
                  'Personalized Experiences',
                  'Seamless Booking',
                ].map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium"
                  >
                    {feature}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Right: Form */}
        <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col bg-background">
          {/* Mobile logo */}
          <div className="lg:hidden p-6 border-b border-border">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Compass className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-display font-bold text-foreground">
                Voyance
              </span>
            </Link>
          </div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-1 flex flex-col justify-center px-4 sm:px-8 md:px-12 lg:px-14 xl:px-16 py-12"
          >
            <>
                {/* Welcome header */}
                <div className="mb-8">
                  
                  {isRedirectedFromProtected ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <h1 className="text-3xl font-display font-bold text-foreground mb-2">
                        Sign in to continue
                      </h1>
                      <p className="text-muted-foreground text-lg">
                        You need to sign in to access{' '}
                        {nextPath === '/profile' ? 'your profile' : 'this page'}.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <h1 className="text-3xl font-display font-bold text-foreground mb-2">
                        Welcome back
                      </h1>
                      <p className="text-muted-foreground text-lg">
                        Sign in to continue your travel planning journey
                      </p>
                    </motion.div>
                  )}
                </div>
                
                <SignInForm />
                
                {/* Bottom legal */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-10 pt-8 border-t border-border"
                >
                  <p className="text-xs text-muted-foreground text-center">
                    By signing in, you agree to our{' '}
                    <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </p>
                </motion.div>
              </>
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
