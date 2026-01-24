/**
 * Vendor Booking Link Component
 * Generates affiliate/external links to booking vendors like Viator, GetYourGuide, TripAdvisor
 * 
 * NOTE: Viator blocks search URL redirects. We only link to Viator when we have a verified
 * product URL from the Partner API. For fallback searches, we use GetYourGuide instead.
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
 * NOTE: Viator blocks search redirects, so we use GetYourGuide as fallback
 */
function generateVendorSearchUrl(
  vendor: 'viator' | 'getyourguide' | 'tripadvisor',
  activityName: string,
  destination: string
): string {
  const query = encodeURIComponent(`${activityName} ${destination}`);

  switch (vendor) {
    case 'getyourguide':
      return `https://www.getyourguide.com/s/?q=${query}`;
    case 'tripadvisor':
      return `https://www.tripadvisor.com/Search?q=${query}&searchSessionId=&searchNearby=false&geo=&sid=&blockRedirect=true&ssrc=A&rf=1`;
    case 'viator':
    default:
      // Viator blocks search redirects - use GetYourGuide as fallback
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
 * Detect vendor from a URL
 */
function detectVendorFromUrl(url: string): 'viator' | 'getyourguide' | 'tripadvisor' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('viator.com')) return 'viator';
  if (lowerUrl.includes('getyourguide.com')) return 'getyourguide';
  if (lowerUrl.includes('tripadvisor.com')) return 'tripadvisor';
  return 'getyourguide'; // Default fallback (no longer Viator)
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
  
  // If we have a Viator URL, use it directly. Otherwise generate search (defaults to GYG)
  const bookingUrl = externalBookingUrl || generateVendorSearchUrl(preferredVendor, activityName, destination);
  
  // Detect vendor from URL if we have a direct link
  const detectedVendor = hasDirectUrl ? detectVendorFromUrl(externalBookingUrl!) : 'getyourguide';
  const vendorName = getVendorDisplayName(detectedVendor);

  const handleClick = () => {
    window.open(bookingUrl, '_blank', 'noopener,noreferrer');
    onAfterClick?.();
  };

  // Format estimated price if provided
  const formattedPrice = estimatedPrice 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(estimatedPrice)
    : null;

  // Determine label based on whether we have a direct URL or are searching
  const linkLabel = hasDirectUrl 
    ? `View on ${vendorName}` 
    : `Find on ${vendorName}`;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn("gap-1.5", className)}
      {...props}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {children || (
        <>
          {linkLabel}
          {formattedPrice && <span className="text-muted-foreground">~{formattedPrice}</span>}
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
  const detectedVendor = hasDirectUrl ? detectVendorFromUrl(externalBookingUrl!) : 'getyourguide';
  const vendorName = getVendorDisplayName(detectedVendor);

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
