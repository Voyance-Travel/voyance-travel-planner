import { motion } from 'framer-motion';
import { useSearchParams, Link } from 'react-router-dom';
import { SignInForm } from '@/components/auth/SignInForm';
import Head from '@/components/common/Head';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import AuthLayout from '@/components/layout/AuthLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Compass, Sparkles } from 'lucide-react';

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const { isLoading: authLoading } = useAuth();
  const nextPath = searchParams.get('next') || '/profile';
  const isRedirectedFromProtected = nextPath && nextPath.startsWith('/');

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
        {/* Left: Editorial image - full height */}
        <motion.div
          className="relative hidden lg:flex lg:w-1/2 xl:w-3/5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <HeroImageWithFallback
            src={heroImage.src}
            alt={heroImage.alt}
            fallbackSources={heroImage.fallbacks}
            overlayGradient="from-black/30 via-black/20 to-black/60"
            className="h-full object-cover"
          />
          
          {/* Floating elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white/40 rounded-full"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${30 + i * 10}%`,
                }}
                animate={{
                  y: [0, -20, 0],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3 + i * 0.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>
          
          {/* Editorial overlay content */}
          <div className="absolute inset-0 flex flex-col justify-between p-12">
            {/* Top: Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Link to="/" className="inline-flex items-center gap-2">
                <span className="text-2xl font-display font-bold text-white">
                  <span className="text-primary">V</span>oyance
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
                <p className="text-2xl md:text-3xl font-display font-light text-white leading-relaxed mb-4">
                  "The world is a book, and those who do not travel read only one page."
                </p>
                <footer className="text-white/70 text-sm">— Saint Augustine</footer>
              </motion.blockquote>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className="flex flex-wrap gap-3"
              >
                {['AI-Powered Itineraries', 'Personalized Experiences', 'Seamless Booking'].map((feature, i) => (
                  <span
                    key={feature}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm"
                  >
                    <Sparkles className="w-3 h-3" />
                    {feature}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Right: Form */}
        <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col">
          {/* Mobile logo */}
          <div className="lg:hidden p-6">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="text-xl font-display font-bold text-foreground">
                <span className="text-primary">V</span>oyance
              </span>
            </Link>
          </div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-1 flex flex-col justify-center px-8 md:px-12 lg:px-16 py-12"
          >
            {authLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary mb-4"
                />
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <>
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-8"
                >
                  <Compass className="w-7 h-7 text-primary" />
                </motion.div>
                
                {isRedirectedFromProtected ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8"
                  >
                    <h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground mb-3">
                      Sign in to continue
                    </h1>
                    <p className="text-muted-foreground">
                      You need to sign in to access{' '}
                      {nextPath === '/profile' ? 'your profile' : 'this page'}.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground mb-3">
                      Welcome back
                    </h1>
                    <p className="text-muted-foreground leading-relaxed">
                      Sign in to continue your personalized travel planning journey
                    </p>
                  </motion.div>
                )}
                
                <SignInForm />
                
                {/* Bottom decorative */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-12 pt-8 border-t border-border"
                >
                  <p className="text-xs text-muted-foreground text-center">
                    By signing in, you agree to our{' '}
                    <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </p>
                </motion.div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
