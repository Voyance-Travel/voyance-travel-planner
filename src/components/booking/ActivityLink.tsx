/**
 * ActivityLink Component
 * 
 * Uses AI-powered search (Perplexity) to find the official booking URL for activities.
 * Displays a loading state while looking up, then shows the direct booking link.
 */

import { useState, useEffect } from 'react';
import { ExternalLink, Loader2, Ticket } from 'lucide-react';
import { lookupActivityUrl } from '@/services/enrichmentService';

interface ActivityLinkProps {
  activityName: string;
  destination: string;
  activityType?: string;
  className?: string;
  /** If true, shows "Book Now" instead of "Get Tickets" */
  bookingStyle?: boolean;
}

export function ActivityLink({ 
  activityName, 
  destination, 
  activityType,
  className,
  bookingStyle = false
}: ActivityLinkProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    async function lookup() {
      try {
        const result = await lookupActivityUrl(activityName, destination, activityType);
        
        if (!cancelled) {
          setUrl(result.url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error looking up activity URL:', err);
        if (!cancelled) {
          setUrl(null);
          setIsLoading(false);
        }
      }
    }
    
    lookup();
    
    return () => {
      cancelled = true;
    };
  }, [activityName, destination, activityType]);

  if (isLoading) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className || ''}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Finding tickets...
      </span>
    );
  }

  if (!url) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs text-primary hover:underline ${className || ''}`}
    >
      {bookingStyle ? (
        <>
          <ExternalLink className="h-3 w-3" />
          Book Now
        </>
      ) : (
        <>
          <Ticket className="h-3 w-3" />
          Get Tickets
        </>
      )}
    </a>
  );
}
