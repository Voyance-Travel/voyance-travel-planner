import { motion } from 'framer-motion';
import { Check, Lock, Bookmark, Calendar, Plane, Hotel, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BookingOptionsProps {
  tripSummary: {
    destination: string;
    dates: string;
    travelers: number;
    flightTotal: number;
    hotelTotal: number;
    grandTotal: number;
  };
  priceLockExpiry?: Date;
  onBook: () => void;
  onSave: () => void;
  onBuildItinerary: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export default function BookingOptions({
  tripSummary,
  priceLockExpiry,
  onBook,
  onSave,
  onBuildItinerary,
  onBack,
  isLoading,
}: BookingOptionsProps) {
  const timeRemaining = priceLockExpiry 
    ? Math.max(0, Math.floor((priceLockExpiry.getTime() - Date.now()) / 60000))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-medium text-slate-900 mb-2">
          Your trip is ready!
        </h1>
        <p className="text-slate-600">
          Review your selections and choose how to proceed
        </p>
      </div>

      {/* Trip Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Trip Summary</h2>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Dates</p>
              <p className="font-medium text-slate-900">{tripSummary.dates}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Plane className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Destination</p>
              <p className="font-medium text-slate-900">{tripSummary.destination}</p>
            </div>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 flex items-center gap-2">
              <Plane className="w-4 h-4" /> Flights ({tripSummary.travelers} travelers)
            </span>
            <span className="font-medium">${tripSummary.flightTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 flex items-center gap-2">
              <Hotel className="w-4 h-4" /> Hotel
            </span>
            <span className="font-medium">${tripSummary.hotelTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold pt-2 border-t border-slate-100">
            <span>Total</span>
            <span className="text-primary">${tripSummary.grandTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Price Lock Warning */}
        {priceLockExpiry && timeRemaining > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Price expires in {timeRemaining} minutes</p>
              <p className="text-xs text-amber-600">Flight prices may change. Book now to lock in this rate.</p>
            </div>
          </div>
        )}
      </div>

      {/* Action Options */}
      <div className="space-y-4 mb-8">
        {/* Option 1: Book Now */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onBook}
          disabled={isLoading}
          className="w-full p-6 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-left"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Book & Lock Price</h3>
                <p className="text-primary-foreground/80 text-sm">
                  Secure your flights and hotel now. Build your itinerary anytime.
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold">${tripSummary.grandTotal.toLocaleString()}</span>
          </div>
        </motion.button>

        {/* Option 2: Save for Later */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onSave}
          disabled={isLoading}
          className="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-300 transition-colors text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-slate-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-1">Save Trip</h3>
              <p className="text-slate-600 text-sm">
                Save your selections. Note: prices may change when you return.
              </p>
            </div>
            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Free</span>
          </div>
        </motion.button>

        {/* Option 3: Build Itinerary First */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onBuildItinerary}
          disabled={isLoading}
          className="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-300 transition-colors text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-slate-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-1">Build Itinerary First</h3>
              <p className="text-slate-600 text-sm">
                See your day-by-day plan before booking. You can still book after.
              </p>
            </div>
            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Preview</span>
          </div>
        </motion.button>
      </div>

      {/* Info Notice */}
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3 mb-8">
        <AlertCircle className="w-5 h-5 text-slate-500 mt-0.5" />
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-700 mb-1">Flexible booking</p>
          <p>Most hotels offer free cancellation up to 24-48 hours before check-in. Flight policies vary by airline.</p>
        </div>
      </div>

      {/* Back Button */}
      <div className="flex justify-start">
        <Button variant="outline" onClick={onBack} className="h-12 px-6">
          Back to Hotels
        </Button>
      </div>
    </motion.div>
  );
}
