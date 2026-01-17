import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { SignInForm } from '@/components/auth/SignInForm';
import Head from '@/components/common/Head';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import AuthLayout from '@/components/layout/AuthLayout';
import { useAuth } from '@/contexts/AuthContext';

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const { isLoading: authLoading } = useAuth();
  const nextPath = searchParams.get('next') || '/profile';
  const isRedirectedFromProtected = nextPath && nextPath.startsWith('/');

  const heroImage = {
    src: 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg',
    alt: 'Aerial view of the Amalfi Coast at golden hour',
    fallbacks: [
      'https://images.pexels.com/photos/2265876/pexels-photo-2265876.jpeg',
      'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg',
    ],
  };

  return (
    <AuthLayout>
      <Head
        title="Sign In | Voyance"
        description="Sign in to your Voyance account to continue planning your personalized travel experiences."
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white lg:bg-transparent">
          {/* Left: Editorial image */}
          <motion.div
            className="relative hidden lg:block h-full min-h-[600px] overflow-hidden rounded-l-2xl"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2 }}
          >
            <HeroImageWithFallback
              src={heroImage.src}
              alt={heroImage.alt}
              fallbackSources={heroImage.fallbacks}
              overlayGradient="from-black/10 via-transparent to-black/40"
              className="h-full object-cover"
            />
            <div className="absolute bottom-8 left-8 max-w-md">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="text-white text-lg font-light"
              >
                "The journey of a thousand miles begins with a single sign-in"
              </motion.div>
            </div>
          </motion.div>

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full max-w-md mx-auto px-8 py-16 lg:py-24 flex flex-col justify-center"
          >
            {authLoading ? (
              <div className="flex items-center justify-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-600" />
              </div>
            ) : isRedirectedFromProtected ? (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mb-8"
                >
                  <h1 className="text-2xl font-display font-medium text-slate-900 mb-2">
                    Sign in to continue
                  </h1>
                  <p className="text-slate-600">
                    You need to sign in to access{' '}
                    {nextPath === '/profile' ? 'your profile' : 'this page'}.
                  </p>
                </motion.div>
                <SignInForm />
              </>
            ) : (
              <>
                <motion.div
                  className="space-y-3 mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h1 className="text-3xl font-display font-medium text-slate-900">
                    Welcome back to Voyance
                  </h1>
                  <p className="text-slate-600 leading-relaxed">
                    Sign in to continue your personalized travel planning
                  </p>
                </motion.div>
                <SignInForm />
              </>
            )}
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
