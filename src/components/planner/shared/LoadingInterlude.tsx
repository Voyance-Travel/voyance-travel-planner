import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

type LoadingInterludeProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
};

export default function LoadingInterlude({
  visible,
  title = 'Working on it…',
  subtitle = 'Pulling the best options together.',
}: LoadingInterludeProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-interlude"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="h-full w-full flex items-center justify-center p-6">
            <motion.div
              initial={{ y: 10, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card shadow-lg"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-foreground leading-tight">{title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full w-1/3 bg-primary"
                      initial={{ x: '-40%' }}
                      animate={{ x: '340%' }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Tip: images and results are saved, so the next steps should feel faster.
                  </p>
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-10 rounded-lg bg-muted" />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
