import { motion } from 'framer-motion';
import { Lock, Save, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItineraryDecisionPanelProps {
  isExpired: boolean;
  totalPrice: number;
  onBook: () => void;
  onSave: () => void;
  className?: string;
}

export default function ItineraryDecisionPanel({
  isExpired = false,
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

        {/* Price Lock Expired Warning */}
        {isExpired && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-5 flex items-start">
            <AlertTriangle size={20} className="text-destructive mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive text-sm">
                Price Lock Has Expired
              </h3>
              <p className="text-destructive/80 text-xs mt-1">
                The guaranteed prices for this trip have expired. If you proceed, prices may have changed.
              </p>
            </div>
          </div>
        )}

        {/* Book Now Button */}
        <motion.button
          className={cn(
            'w-full py-4 mb-3 rounded-xl font-medium flex items-center justify-center',
            isExpired
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg'
          )}
          onClick={isExpired ? undefined : onBook}
          disabled={isExpired}
          whileHover={isExpired ? {} : { scale: 1.02 }}
          whileTap={isExpired ? {} : { scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          <Lock size={18} className="mr-2" />
          Book This Trip Now
        </motion.button>

        {/* Secondary Actions */}
        {isExpired ? (
          <button
            className="w-full py-4 rounded-xl font-medium bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
            onClick={() => window.location.reload()}
          >
            <Clock size={18} className="mr-2 inline-block" />
            Refresh Pricing
          </button>
        ) : (
          <>
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
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Prices may change when you return to this saved trip
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
