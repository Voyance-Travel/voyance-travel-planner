/**
 * Vendor Booking Link Component
 * Generates affiliate/external links to booking vendors like Viator, GetYourGuide, TripAdvisor
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
 */
function generateVendorSearchUrl(
  vendor: 'viator' | 'getyourguide' | 'tripadvisor',
  activityName: string,
  destination: string
): string {
  const query = encodeURIComponent(`${activityName} ${destination}`);
  const destQuery = encodeURIComponent(destination);
  const activityQuery = encodeURIComponent(activityName);

  switch (vendor) {
    case 'viator':
      // Viator search URL
      return `https://www.viator.com/searchResults/all?text=${query}`;
    case 'getyourguide':
      // GetYourGuide search URL
      return `https://www.getyourguide.com/s/?q=${query}`;
    case 'tripadvisor':
      // TripAdvisor experiences search
      return `https://www.tripadvisor.com/Search?q=${query}&searchSessionId=&searchNearby=false&geo=&sid=&blockRedirect=true&ssrc=A&rf=1`;
    default:
      return `https://www.viator.com/searchResults/all?text=${query}`;
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
      return 'Viator';
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
  const bookingUrl = externalBookingUrl || generateVendorSearchUrl(preferredVendor, activityName, destination);
  const vendorName = getVendorDisplayName(preferredVendor);

  const handleClick = () => {
    window.open(bookingUrl, '_blank', 'noopener,noreferrer');
    onAfterClick?.();
  };

  // Format estimated price if provided
  const formattedPrice = estimatedPrice 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(estimatedPrice)
    : null;

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
          Book on {vendorName}
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
  const bookingUrl = externalBookingUrl || generateVendorSearchUrl(preferredVendor, activityName, destination);
  const vendorName = getVendorDisplayName(preferredVendor);

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
