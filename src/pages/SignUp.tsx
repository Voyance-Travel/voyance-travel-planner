import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { SignUpForm } from '@/components/auth/SignUpForm';
import Head from '@/components/common/Head';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import AuthLayout from '@/components/layout/AuthLayout';

export default function SignUp() {
  return (
    <AuthLayout>
      <Head
        title="Create Account | Voyance"
        description="Join Voyance and start planning your personalized travel experiences."
      />
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* Right side - Travel inspiration (reversed from signin) */}
        <div className="relative hidden lg:block order-2">
          <HeroImageWithFallback
            src="https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg"
            alt="Mountain peaks with winding roads at sunset"
            fallbackSources={[
              'https://images.pexels.com/photos/2265876/pexels-photo-2265876.jpeg',
              'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg',
            ]}
            overlayGradient="from-rose-900/50 via-transparent to-amber-900/50"
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="text-center text-white p-8"
            >
              <MapPin className="w-16 h-16 mx-auto mb-6 text-white/80" />
              <h2 className="text-4xl font-display font-light mb-4">
                Begin your adventure
              </h2>
              <p className="text-lg text-white/90 max-w-md">
                Join thousands of travelers discovering extraordinary destinations
              </p>
            </motion.div>
          </div>
        </div>

        {/* Left side - Sign up form */}
        <div className="flex items-center justify-center p-8 lg:p-16 bg-gradient-to-bl from-white via-rose-50/30 to-amber-50/30 order-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            <div className="mb-10">
              <h1 className="text-4xl font-display font-medium text-slate-900 mb-3">
                Start your journey
              </h1>
              <p className="text-lg text-slate-600">
                Create your account to explore the world with Voyance.
              </p>
            </div>
            <SignUpForm />
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
