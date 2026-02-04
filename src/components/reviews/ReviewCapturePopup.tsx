/**
 * Review Capture Popup
 * 
 * A modal to capture customer reviews after a positive experience.
 * Integrates with the popup coordination system.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePopupCoordination, POPUP_STORAGE } from '@/stores/popup-coordination-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ReviewCapturePopupProps {
  isOpen: boolean;
  onClose: () => void;
  tripDestination?: string;
  archetype?: string;
}

export function ReviewCapturePopup({ 
  isOpen, 
  onClose,
  tripDestination,
  archetype 
}: ReviewCapturePopupProps) {
  const { user } = useAuth();
  const { closePopup } = usePopupCoordination();
  
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [photoConsent, setPhotoConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Pre-fill from user if available
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!reviewText.trim()) {
      toast.error('Please write a review');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('customer_reviews').insert({
        user_id: user?.id || null,
        name: name.trim(),
        email: email.trim() || null,
        rating,
        review_text: reviewText.trim(),
        trip_destination: tripDestination || null,
        archetype: archetype || null,
        photo_consent: photoConsent,
      });

      if (error) throw error;

      setIsSubmitted(true);
      
      // Mark review as submitted in local storage
      localStorage.setItem(POPUP_STORAGE.REVIEW_SUBMITTED, 'true');
      
      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 2500);

    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    closePopup('review_capture');
    onClose();
    
    // Reset form after close animation
    setTimeout(() => {
      setRating(0);
      setReviewText('');
      setPhotoConsent(false);
      setIsSubmitted(false);
    }, 300);
  };

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing!'];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <DialogHeader className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <DialogTitle className="text-xl font-serif">
                    Share Your Experience
                  </DialogTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your feedback helps other travelers and helps us improve.
                </p>
              </DialogHeader>

              <div className="space-y-5">
                {/* Star Rating */}
                <div className="text-center">
                  <p className="text-sm font-medium mb-3">How was your experience?</p>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={cn(
                            "h-8 w-8 transition-colors",
                            (hoveredRating || rating) >= star
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 h-5">
                    {ratingLabels[hoveredRating || rating] || ''}
                  </p>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="review-name">Your name *</Label>
                  <Input
                    id="review-name"
                    placeholder="How should we credit you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* Email (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="review-email">
                    Email <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="review-email"
                    type="email"
                    placeholder="In case we'd like to feature your review"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* Review Text */}
                <div className="space-y-2">
                  <Label htmlFor="review-text">Your review *</Label>
                  <Textarea
                    id="review-text"
                    placeholder="What made your trip special? How did Voyance help?"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Photo consent */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="photo-consent"
                    checked={photoConsent}
                    onCheckedChange={(checked) => setPhotoConsent(checked === true)}
                  />
                  <Label 
                    htmlFor="photo-consent" 
                    className="text-sm text-muted-foreground leading-tight cursor-pointer"
                  >
                    I'm happy for Voyance to use my review and name on their website and marketing materials.
                  </Label>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Maybe Later
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || rating === 0}
                    className="flex-1 gap-2"
                  >
                    {isSubmitting ? (
                      <>Submitting...</>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Review
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </motion.div>
              <h3 className="text-xl font-serif font-semibold mb-2">
                Thank You!
              </h3>
              <p className="text-muted-foreground">
                Your review means the world to us. Safe travels!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </DialogContent>
    </Dialog>
  );
}

export default ReviewCapturePopup;
