import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';

import Head from '@/components/common/Head';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import AuthLayout from '@/components/layout/AuthLayout';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

export default function ForgotPassword() {
  return (
    <AuthLayout>
      <Head
        title="Forgot Password | Voyance"
        description="Reset your Voyance account password to regain access to your personalized travel experiences."
      />

      <section className="min-h-screen pt-10 bg-background flex items-center justify-center scroll-mt-24">
        <div className="max-w-5xl w-full mx-4 grid grid-cols-1 md:grid-cols-2 bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          {/* Left: Editorial image with caption */}
          <motion.div
            className="relative h-[250px] md:h-auto overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <HeroImageWithFallback
              src="https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&q=80"
              alt="A path through mountains at golden hour"
              fallbackSources={[
                "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80"
              ]}
              overlayGradient="from-black/30 via-black/20 to-black/60"
              className="h-full"
            />
            <div className="absolute bottom-6 left-6 right-6 z-20">
              <p className="text-white/90 text-sm bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
                We'll help you get back to your journey
              </p>
            </div>
          </motion.div>

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="p-8 md:p-10 flex flex-col justify-center"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>

            <motion.h1
              className="font-serif text-2xl md:text-3xl font-semibold text-foreground mb-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Forgot Your Password?
            </motion.h1>

            <motion.p
              className="text-sm text-muted-foreground mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Enter your email address and we'll send you a link to reset your password.
            </motion.p>

            <ForgotPasswordForm />

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link to="/signin" className="font-medium text-primary hover:text-primary/80 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </AuthLayout>
  );
}
