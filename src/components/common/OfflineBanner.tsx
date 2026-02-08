/**
 * Offline Banner
 * Shows connectivity status and offline mode indicator
 */

import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, CloudOff } from 'lucide-react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { cn } from '@/lib/utils';

export function OfflineBanner() {
  const { isOnline, wasOffline } = useOfflineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className={cn(
            "fixed top-0 left-0 right-0 z-[100]",
            "bg-amber-600 text-white px-4 py-2",
            "flex items-center justify-center gap-2 text-sm font-medium",
            "shadow-lg"
          )}
        >
          <WifiOff className="w-4 h-4" />
          <span>You're offline. Viewing cached trip data</span>
          <CloudOff className="w-4 h-4 opacity-60" />
        </motion.div>
      )}

      {wasOffline && isOnline && (
        <motion.div
          key="reconnected"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className={cn(
            "fixed top-0 left-0 right-0 z-[100]",
            "bg-emerald-600 text-white px-4 py-2",
            "flex items-center justify-center gap-2 text-sm font-medium",
            "shadow-lg"
          )}
        >
          <Wifi className="w-4 h-4" />
          <span>Back online. Syncing your data</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
