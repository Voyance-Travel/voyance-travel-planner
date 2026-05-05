/**
 * Vendor Booking Link Component
 * Generates affiliate/external links to booking vendors like Viator, GetYourGuide, TripAdvisor
 * 
 * Uses a mix of Viator and GetYourGuide for search fallbacks to provide variety.
 * Direct API-matched URLs always use the detected vendor.
 */

import { ExternalLink } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VendorBookingLinkProps extends Omit<ButtonProps, 'onClick'> {
  activityName: string;
  destination: string;
  /** If provided, opens this URL directly instead of generating a search link */
  externalBookingUrl?: string;
  /** Preferred vendor: viator, getyourguide, tripadvisor */
  preferredVendor?: 'viator' | 'getyourguide' | 'tripadvisor';
  /** Show estimated price for context (optional) */
  estimatedPrice?: number;
  currency?: string;
  /** Callback fired after the link is clicked (useful for state changes) */
  onAfterClick?: () => void;
}

/**
 * Generate a search URL for the given vendor
 * Uses a mix of Viator and GetYourGuide for variety (alternating based on activity name hash)
 */
function generateVendorSearchUrl(
  vendor: 'viator' | 'getyourguide' | 'tripadvisor',
  activityName: string,
  destination: string
): string {
  const query = encodeURIComponent(`${activityName} ${destination}`);

  // For explicit vendor preference, use that vendor
  if (vendor === 'getyourguide') {
    return `https://www.getyourguide.com/s/?q=${query}`;
  }
  if (vendor === 'tripadvisor') {
    return `https://www.tripadvisor.com/Search?q=${query}&searchSessionId=&searchNearby=false&geo=&sid=&blockRedirect=true&ssrc=A&rf=1`;
  }
  
  // For viator/default: alternate between Viator and GetYourGuide based on activity name
  // This provides variety while still using both vendors
  const hash = activityName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const useViator = hash % 2 === 0;
  
  if (useViator) {
    // Direct Viator search - may work for some users
    return `https://www.viator.com/searchResults/all?text=${query}`;
  } else {
    return `https://www.getyourguide.com/s/?q=${query}`;
  }
}

/**
 * Get the vendor display name
 */
function getVendorDisplayName(vendor: 'viator' | 'getyourguide' | 'tripadvisor'): string {
  switch (vendor) {
    case 'viator':
      return 'Viator';
    case 'getyourguide':
      return 'GetYourGuide';
    case 'tripadvisor':
      return 'TripAdvisor';
    default:
      return 'GetYourGuide';
  }
}

/**
 * Detect vendor from a URL. Returns null for unknown hosts so we can render
 * an honest "Reserve on {hostname}" label rather than mislabel the venue's
 * own site as Viator.
 */
function detectVendorFromUrl(url: string): 'viator' | 'getyourguide' | 'tripadvisor' | null {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('viator.com')) return 'viator';
  if (lowerUrl.includes('getyourguide.com')) return 'getyourguide';
  if (lowerUrl.includes('tripadvisor.com')) return 'tripadvisor';
  return null;
}

/** Extract a clean hostname for display (e.g. "louvre.fr"). */
function prettyHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'official site';
  }
}

export function VendorBookingLink({
  activityName,
  destination,
  externalBookingUrl,
  preferredVendor = 'viator',
  estimatedPrice,
  currency = 'USD',
  className,
  variant = 'outline',
  size = 'sm',
  children,
  onAfterClick,
  ...props
}: VendorBookingLinkProps) {
  // Use direct URL if provided, otherwise generate search URL
  const hasDirectUrl = !!externalBookingUrl;
  const bookingUrl = externalBookingUrl || generateVendorSearchUrl(preferredVendor, activityName, destination);
  
  // Detect vendor from URL or booking URL for correct display name
  const detectedVendor = hasDirectUrl
    ? detectVendorFromUrl(externalBookingUrl!)
    : detectVendorFromUrl(bookingUrl);
  // Unknown direct URLs (e.g. louvre.fr) → label with hostname instead of "Viator"
  const isOfficialDirect = hasDirectUrl && detectedVendor === null;
  const vendorName = detectedVendor ? getVendorDisplayName(detectedVendor) : prettyHostname(bookingUrl);

  const handleClick = () => {
    window.open(bookingUrl, '_blank', 'noopener,noreferrer');
    onAfterClick?.();
  };

  // Format estimated price if provided
  const formattedPrice = estimatedPrice
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(estimatedPrice)
    : null;

  const linkLabel = isOfficialDirect
    ? `Reserve on ${vendorName}`
    : hasDirectUrl
      ? `View on ${vendorName}`
      : `Find on ${vendorName}`;

  const shortLabel = isOfficialDirect ? 'Reserve' : hasDirectUrl ? 'View' : 'Find';

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(
        "gap-1 sm:gap-1.5 text-xs px-2 sm:px-3 h-7 sm:h-8",
        className
      )}
      {...props}
    >
      <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
      {children || (
        <>
          {/* Short label on mobile, full label on desktop */}
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{linkLabel}</span>
          {formattedPrice && <span className="hidden sm:inline text-muted-foreground">~{formattedPrice}</span>}
        </>
      )}
    </Button>
  );
}

/**
 * Compact text link variant for inline use
 */
export function VendorBookingTextLink({
  activityName,
  destination,
  externalBookingUrl,
  preferredVendor = 'viator',
  className,
}: Pick<VendorBookingLinkProps, 'activityName' | 'destination' | 'externalBookingUrl' | 'preferredVendor' | 'className'>) {
  const hasDirectUrl = !!externalBookingUrl;
  const bookingUrl = externalBookingUrl || generateVendorSearchUrl(preferredVendor, activityName, destination);
  const detectedVendor = hasDirectUrl ? detectVendorFromUrl(externalBookingUrl!) : detectVendorFromUrl(bookingUrl);
  const vendorName = detectedVendor ? getVendorDisplayName(detectedVendor) : prettyHostname(bookingUrl);
  const ctaPrefix = hasDirectUrl && detectedVendor === null ? 'Reserve on' : 'Book on';

  return (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-xs text-primary hover:underline",
        className
      )}
    >
      <ExternalLink className="h-3 w-3" />
      Book on {vendorName}
    </a>
  );
}

export default VendorBookingLink;
