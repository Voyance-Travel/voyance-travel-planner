/**
 * Welcome Credits Modal
 * Shows new users their bonus credits after email verification
 * Celebrates welcome bonus + launch bonus (if available)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Gift, Rocket, X, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBonusCredits, BONUS_INFO } from '@/hooks/useBonusCredits';
import { useAuth } from '@/contexts/AuthContext';
import confetti from 'canvas-confetti';

interface WelcomeCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export function WelcomeCreditsModal({ open, onClose }: WelcomeCreditsModalProps) {
  const { user } = useAuth();
  const { claimWelcomeBonuses, hasClaimedBonus } = useBonusCredits();
  const [bonusResults, setBonusResults] = useState<{
    welcome: boolean;
    launch: boolean;
    totalCredits: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && user) {
      claimBonuses();
    }
  }, [open, user]);

  const claimBonuses = async () => {
    setIsLoading(true);
    try {
      const results = await claimWelcomeBonuses();
      
      const welcomeGranted = results.some(r => r.granted && r.bonusType === 'welcome');
      const launchGranted = results.some(r => r.granted && r.bonusType === 'launch');
      const totalCredits = results.reduce((sum, r) => sum + (r.granted ? (r.credits || 0) : 0), 0);

      setBonusResults({
        welcome: welcomeGranted,
        launch: launchGranted,
        totalCredits,
      });

      // Trigger confetti on success
      if (totalCredits > 0) {
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#22c55e', '#3b82f6'],
          });
        }, 300);
      }
    } catch (error) {
      console.error('[WelcomeCreditsModal] Error claiming bonuses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md border-accent/20 bg-gradient-to-b from-background to-background/95">
        <DialogTitle className="sr-only">Welcome Credits</DialogTitle>
        
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="h-12 w-12 text-accent" />
              </motion.div>
              <p className="mt-4 text-muted-foreground">Preparing your welcome gifts...</p>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center py-4"
            >
              {/* Hero section */}
              <div className="relative mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center"
                >
                  <Gift className="h-10 w-10 text-accent" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </motion.div>
              </div>

              {/* Main message */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-serif font-semibold mb-2"
              >
                Welcome to Voyance!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-muted-foreground mb-2"
              >
                Here are your free credits to get started.
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="text-sm text-muted-foreground mb-6"
              >
                You'll get <span className="font-semibold text-foreground">150 free credits every month</span> just for being a member.
              </motion.p>

              {/* Credit breakdown */}
              <div className="w-full space-y-3 mb-6">
                {bonusResults?.welcome && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-accent/10"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{BONUS_INFO.welcome.icon}</span>
                      <div className="text-left">
                        <p className="font-medium">{BONUS_INFO.welcome.title}</p>
                        <p className="text-sm text-muted-foreground">{BONUS_INFO.welcome.description}</p>
                      </div>
                    </div>
                    <span className="font-bold text-accent">+{BONUS_INFO.welcome.credits}</span>
                  </motion.div>
                )}

                {bonusResults?.launch && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <Rocket className="h-6 w-6 text-purple-500" />
                      <div className="text-left">
                        <p className="font-medium">{BONUS_INFO.launch.title}</p>
                        <p className="text-sm text-muted-foreground">{BONUS_INFO.launch.description}</p>
                      </div>
                    </div>
                    <span className="font-bold text-purple-500">+{BONUS_INFO.launch.credits}</span>
                  </motion.div>
                )}
              </div>

              {/* Total */}
              {bonusResults && bonusResults.totalCredits > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="w-full p-4 rounded-xl bg-gradient-to-r from-accent/20 via-accent/10 to-accent/20 border border-accent/20 mb-6"
                >
                  <p className="text-sm text-muted-foreground mb-1">Your starting balance</p>
                  <p className="text-3xl font-bold text-accent">{bonusResults.totalCredits} credits</p>
                </motion.div>
              )}

              {/* Expiration disclaimer */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-xs text-muted-foreground mb-6"
              >
                Welcome credits expire in 2 months • Launch bonus expires in 6 months
              </motion.p>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="w-full"
              >
                <Button
                  onClick={handleClose}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  size="lg"
                >
                  Start Exploring
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default WelcomeCreditsModal;
