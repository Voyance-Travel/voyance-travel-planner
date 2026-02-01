/**
 * ReservationCard
 * Displays a single reservation with confirmation details and quick actions
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plane, Hotel, Utensils, Ticket, MapPin, 
  QrCode, Download, Copy, Check, Clock, 
  ExternalLink, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { format, parseISO, isAfter, isToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type ReservationType = 'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';
export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled';

export interface ReservationData {
  id: string;
  type: ReservationType;
  title: string;
  date: string;
  time?: string;
  endDate?: string;
  endTime?: string;
  confirmationNumber?: string;
  voucherUrl?: string;
  qrCode?: string;
  status: ReservationStatus;
  vendorName?: string;
  location?: string;
  address?: string;
  notes?: string;
  // Flight specific
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  // Hotel specific
  roomType?: string;
  checkInTime?: string;
  checkOutTime?: string;
  // Restaurant specific
  partySize?: number;
}

interface ReservationCardProps {
  reservation: ReservationData;
  compact?: boolean;
  onViewDetails?: () => void;
  onShowQR?: () => void;
}

const typeIcons: Record<ReservationType, React.ElementType> = {
  flight: Plane,
  hotel: Hotel,
  restaurant: Utensils,
  activity: Ticket,
  transport: MapPin,
};

const typeLabels: Record<ReservationType, string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  restaurant: 'Restaurant',
  activity: 'Activity',
  transport: 'Transport',
};

const statusConfig: Record<ReservationStatus, { color: string; label: string }> = {
  confirmed: { 
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', 
    label: 'Confirmed' 
  },
  pending: { 
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', 
    label: 'Pending' 
  },
  cancelled: { 
    color: 'bg-red-500/10 text-red-600 border-red-500/30', 
    label: 'Cancelled' 
  },
};

export function ReservationCard({
  reservation,
  compact = false,
  onViewDetails,
  onShowQR,
}: ReservationCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const Icon = typeIcons[reservation.type];
  const status = statusConfig[reservation.status];
  const isUpcoming = isAfter(parseISO(reservation.date), new Date()) || isToday(parseISO(reservation.date));

  const handleCopy = () => {
    if (reservation.confirmationNumber) {
      navigator.clipboard.writeText(reservation.confirmationNumber);
      setCopied(true);
      toast.success('Confirmation copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderTypeSpecificInfo = () => {
    switch (reservation.type) {
      case 'flight':
        return (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono">{reservation.flightNumber}</span>
            {reservation.departureAirport && reservation.arrivalAirport && (
              <span className="text-muted-foreground">
                {reservation.departureAirport} → {reservation.arrivalAirport}
              </span>
            )}
          </div>
        );
      case 'hotel':
        return (
          <div className="space-y-1 text-sm">
            {reservation.roomType && (
              <p className="text-muted-foreground">{reservation.roomType}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {reservation.checkInTime && (
                <span>Check-in: {reservation.checkInTime}</span>
              )}
              {reservation.checkOutTime && (
                <span>Check-out: {reservation.checkOutTime}</span>
              )}
            </div>
          </div>
        );
      case 'restaurant':
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {reservation.time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {reservation.time}
              </span>
            )}
            {reservation.partySize && (
              <span>· Party of {reservation.partySize}</span>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div 
        className={cn(
          'flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:bg-muted/50',
          !isUpcoming && 'opacity-60'
        )}
        onClick={onViewDetails}
      >
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          reservation.status === 'confirmed' 
            ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-amber-500/10 text-amber-600'
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{reservation.title}</p>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(reservation.date), 'EEE, MMM d')}
            {reservation.time && ` · ${reservation.time}`}
          </p>
        </div>
        {reservation.confirmationNumber && (
          <Badge variant="outline" className="text-[10px] font-mono">
            {reservation.confirmationNumber.slice(0, 8)}...
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className={cn(!isUpcoming && 'opacity-60')}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              reservation.status === 'confirmed' 
                ? 'bg-emerald-500/10 text-emerald-600'
                : reservation.status === 'pending'
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-red-500/10 text-red-600'
            )}>
              <Icon className="h-5 w-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{reservation.title}</h4>
                    <Badge variant="outline" className="text-[10px]">
                      {typeLabels[reservation.type]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {format(parseISO(reservation.date), 'EEEE, MMM d')}
                    {reservation.time && ` at ${reservation.time}`}
                    {reservation.endDate && reservation.endDate !== reservation.date && (
                      <> — {format(parseISO(reservation.endDate), 'MMM d')}</>
                    )}
                  </p>
                </div>
                <Badge variant="outline" className={cn('text-[10px] flex-shrink-0', status.color)}>
                  {status.label}
                </Badge>
              </div>

              {/* Type-specific info */}
              <div className="mt-2">
                {renderTypeSpecificInfo()}
              </div>

              {/* Vendor & Location */}
              {(reservation.vendorName || reservation.location) && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  {reservation.vendorName && <span>via {reservation.vendorName}</span>}
                  {reservation.vendorName && reservation.location && <span>·</span>}
                  {reservation.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {reservation.location}
                    </span>
                  )}
                </div>
              )}

              {/* Confirmation Number */}
              {reservation.confirmationNumber && (
                <div className="flex items-center gap-2 mt-3 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                  <QrCode className="h-4 w-4 text-primary" />
                  <code className="text-sm font-mono font-bold flex-1 tracking-wide">
                    {reservation.confirmationNumber}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy();
                    }}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}

              {/* Expandable details */}
              <CollapsibleContent>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 pt-4 border-t border-border/50 space-y-3"
                >
                  {reservation.address && (
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Address</p>
                      <p>{reservation.address}</p>
                    </div>
                  )}
                  {reservation.notes && (
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-muted-foreground">{reservation.notes}</p>
                    </div>
                  )}
                </motion.div>
              </CollapsibleContent>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                {reservation.qrCode && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 gap-1.5"
                    onClick={onShowQR}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Show QR
                  </Button>
                )}
                {reservation.voucherUrl && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 gap-1.5"
                    onClick={() => window.open(reservation.voucherUrl, '_blank')}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Voucher
                  </Button>
                )}
                <CollapsibleTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 ml-auto">
                    {expanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        More
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

export default ReservationCard;
