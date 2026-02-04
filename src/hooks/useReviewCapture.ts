/**
 * Hook to manage review capture popup state and triggers
 */

import { useState, useCallback } from 'react';
import { usePopupCoordination, POPUP_STORAGE } from '@/stores/popup-coordination-store';

interface ReviewContext {
  tripDestination?: string;
  archetype?: string;
}

export function useReviewCapture() {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<ReviewContext>({});
  const { requestPopup } = usePopupCoordination();

  const hasSubmittedReview = useCallback(() => {
    return localStorage.getItem(POPUP_STORAGE.REVIEW_SUBMITTED) === 'true';
  }, []);

  const triggerReviewPopup = useCallback((reviewContext?: ReviewContext) => {
    // Don't show if already submitted
    if (hasSubmittedReview()) {
      return false;
    }

    // Request through popup coordination system
    const allowed = requestPopup('review_capture');
    
    if (allowed) {
      setContext(reviewContext || {});
      setIsOpen(true);
      return true;
    }
    
    return false;
  }, [requestPopup, hasSubmittedReview]);

  const closeReviewPopup = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Trigger after positive action (e.g., after viewing itinerary, completing trip)
  const triggerAfterPositiveAction = useCallback((reviewContext?: ReviewContext) => {
    // Add a delay to not interrupt the positive moment
    setTimeout(() => {
      triggerReviewPopup(reviewContext);
    }, 3000);
  }, [triggerReviewPopup]);

  return {
    isOpen,
    context,
    triggerReviewPopup,
    closeReviewPopup,
    triggerAfterPositiveAction,
    hasSubmittedReview,
  };
}
