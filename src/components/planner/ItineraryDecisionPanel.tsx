import { motion } from 'framer-motion';
import { Save, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItineraryDecisionPanelProps {
  totalPrice: number;
  onBook: () => void;
  onSave: () => void;
  className?: string;
}

export default function ItineraryDecisionPanel({
  totalPrice = 0,
  onBook,
  onSave,
  className
}: ItineraryDecisionPanelProps) {
  return (
    <motion.div
      className={cn('bg-card rounded-xl shadow-md overflow-hidden', className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    >
      <div className="bg-gradient-to-r from-primary to-accent p-4 text-primary-foreground">
        <h2 className="text-xl font-semibold">Finalize Your Trip</h2>
      </div>

      <div className="p-5">
        {/* Price Summary */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground font-medium">Total Price:</span>
            <span className="text-2xl font-bold text-foreground">
              ${totalPrice.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            All taxes and fees included
          </div>
        </div>

        {/* Book Now Button */}
        <motion.button
          className="w-full py-4 mb-3 rounded-xl font-medium flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg"
          onClick={onBook}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          Book This Trip Now
        </motion.button>

        {/* Save Button with Warning */}
        <motion.button
          className="w-full py-4 rounded-xl font-medium border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center"
          onClick={onSave}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          <Save size={18} className="mr-2" />
          Save & Return Later
        </motion.button>
        
        {/* Save Warning */}
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
          <Info size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Saving preserves your search criteria only. Hotel and flight prices may change when you return.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
