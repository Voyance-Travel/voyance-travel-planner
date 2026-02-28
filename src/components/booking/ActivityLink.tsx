/**
 * ActivityLink Component
 * 
 * On-demand booking URL lookup — only calls Perplexity when the user clicks,
 * not on mount. This prevents N API calls per itinerary view.
 */

import { useState } from 'react';
import { ExternalLink, Loader2, Ticket, Search } from 'lucide-react';
import { lookupActivityUrl } from '@/services/enrichmentService';

interface ActivityLinkProps {
  activityName: string;
  destination: string;
  activityType?: string;
  className?: string;
  /** If true, shows "Book Now" instead of "Get Tickets" */
  bookingStyle?: boolean;
  /** If a URL is already known (e.g. stored during generation), skip the lookup */
  knownUrl?: string | null;
}

export function ActivityLink({ 
  activityName, 
  destination, 
  activityType,
  className,
  bookingStyle = false,
  knownUrl,
}: ActivityLinkProps) {
  const [url, setUrl] = useState<string | null>(knownUrl ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!knownUrl);

  async function handleClick() {
    // If we already have a URL, just open it
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // If already searching or already searched with no result, bail
    if (isLoading || (hasSearched && !url)) return;

    setIsLoading(true);
    try {
      const result = await lookupActivityUrl(activityName, destination, activityType);
      setUrl(result.url);
      setHasSearched(true);
      if (result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Error looking up activity URL:', err);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  }

  // Already searched but nothing found
  if (hasSearched && !url && !knownUrl) {
    return null;
  }

  // Known URL — render as a direct link
  if (url) {
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

  // Not yet searched — show clickable "Find tickets" button
  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ${className || ''}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Finding...
        </>
      ) : (
        <>
          <Search className="h-3 w-3" />
          Find tickets
        </>
      )}
    </button>
  );
}
