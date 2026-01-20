/**
 * Consolidated Bookings Table
 * Shows all bookings (segments + itinerary activities) in a unified table view
 * with: item, supplier, date/time, status, confirmation, cancel policy, support contact
 */
import { useState } from 'react';
import { format } from 'date-fns';
import {
  Plane,
  Hotel,
  Car,
  MapPin,
  Ticket,
  ExternalLink,
  Phone,
  Mail,
  FileText,
  MoreHorizontal,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { BookingSegment } from '@/services/agencyCRM';

// Status badge config
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  not_selected: { label: 'Not Booked', className: 'bg-muted text-muted-foreground border-muted' },
  selected_pending: { label: 'In Cart', className: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  booked_confirmed: { label: 'Booked', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  ticketed: { label: 'Ticketed', className: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/10 text-red-600 border-red-200' },
  refunded: { label: 'Refunded', className: 'bg-purple-500/10 text-purple-600 border-purple-200' },
};

const SEGMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: Car,
  transfer: Car,
  tour: MapPin,
  activity: Ticket,
  default: MapPin,
};

export interface BookingRow {
  id: string;
  type: 'segment' | 'activity';
  itemName: string;
  itemType: string;
  supplier?: string | null;
  date?: string | null;
  time?: string | null;
  status: string;
  confirmationNumber?: string | null;
  cancellationPolicy?: string | null;
  cancellationDeadline?: string | null;
  supportContact?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  vendorUrl?: string | null;
  voucherUrl?: string | null;
  priceCents?: number | null;
  currency?: string;
  // Original data for editing
  originalData?: BookingSegment | Record<string, unknown>;
}

interface BookingsTableProps {
  bookings: BookingRow[];
  currency?: string;
  onEditBooking?: (booking: BookingRow) => void;
  onViewVoucher?: (booking: BookingRow) => void;
}

export default function BookingsTable({
  bookings,
  currency = 'USD',
  onEditBooking,
  onViewVoucher,
}: BookingsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<{ title: string; policy: string } | null>(null);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const handleCopyConfirmation = (id: string, confirmation: string) => {
    navigator.clipboard.writeText(confirmation);
    setCopiedId(id);
    toast({ title: 'Confirmation copied' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const viewCancellationPolicy = (booking: BookingRow) => {
    setSelectedPolicy({
      title: booking.itemName,
      policy: booking.cancellationPolicy || 'No cancellation policy specified.',
    });
    setPolicyModalOpen(true);
  };

  if (bookings.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Item</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date / Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confirmation</TableHead>
              <TableHead>Cancel Policy</TableHead>
              <TableHead>Support</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => {
              const Icon = SEGMENT_ICONS[booking.itemType] || SEGMENT_ICONS.default;
              const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

              return (
                <TableRow key={booking.id} className="group">
                  {/* Item */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{booking.itemName}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {booking.itemType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Supplier */}
                  <TableCell>
                    {booking.supplier ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{booking.supplier}</span>
                        {booking.vendorUrl && (
                          <a
                            href={booking.vendorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Date / Time */}
                  <TableCell>
                    {booking.date ? (
                      <div className="text-sm">
                        <p>{format(new Date(booking.date), 'MMM d, yyyy')}</p>
                        {booking.time && (
                          <p className="text-muted-foreground text-xs">{booking.time}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge variant="outline" className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>

                  {/* Confirmation */}
                  <TableCell>
                    {booking.confirmationNumber ? (
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {booking.confirmationNumber}
                        </code>
                        <button
                          onClick={() => handleCopyConfirmation(booking.id, booking.confirmationNumber!)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {copiedId === booking.id ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Cancel Policy */}
                  <TableCell>
                    {booking.cancellationPolicy ? (
                      <div className="flex items-center gap-1">
                        {booking.cancellationDeadline && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs cursor-help">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {format(new Date(booking.cancellationDeadline), 'MMM d')}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Free cancellation until this date</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => viewCancellationPolicy(booking)}
                        >
                          View
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Support */}
                  <TableCell>
                    {(booking.supportContact || booking.supportEmail || booking.supportPhone) ? (
                      <div className="flex items-center gap-1">
                        {booking.supportPhone && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`tel:${booking.supportPhone}`}
                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>{booking.supportPhone}</TooltipContent>
                          </Tooltip>
                        )}
                        {booking.supportEmail && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`mailto:${booking.supportEmail}`}
                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>{booking.supportEmail}</TooltipContent>
                          </Tooltip>
                        )}
                        {booking.supportContact && !booking.supportPhone && !booking.supportEmail && (
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                            {booking.supportContact}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Price */}
                  <TableCell className="text-right">
                    {booking.priceCents ? (
                      <span className="font-medium">{formatCurrency(booking.priceCents)}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEditBooking && (
                          <DropdownMenuItem onClick={() => onEditBooking(booking)}>
                            Edit Booking
                          </DropdownMenuItem>
                        )}
                        {booking.voucherUrl && onViewVoucher && (
                          <DropdownMenuItem onClick={() => onViewVoucher(booking)}>
                            <FileText className="h-4 w-4 mr-2" />
                            View Voucher
                          </DropdownMenuItem>
                        )}
                        {booking.confirmationNumber && (
                          <DropdownMenuItem
                            onClick={() => handleCopyConfirmation(booking.id, booking.confirmationNumber!)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Confirmation
                          </DropdownMenuItem>
                        )}
                        {booking.cancellationPolicy && (
                          <DropdownMenuItem onClick={() => viewCancellationPolicy(booking)}>
                            View Cancel Policy
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Cancellation Policy Modal */}
      <Dialog open={policyModalOpen} onOpenChange={setPolicyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancellation Policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPolicy && (
              <>
                <p className="font-medium">{selectedPolicy.title}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedPolicy.policy}
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

// Helper to convert segments to BookingRow format
export function segmentToBookingRow(segment: BookingSegment): BookingRow {
  // Build item name based on segment type
  let itemName = segment.vendor_name || '';
  if (segment.segment_type === 'flight' && segment.flight_number) {
    itemName = `${segment.vendor_name || 'Flight'} ${segment.flight_number}`;
  } else if (segment.segment_type === 'hotel') {
    itemName = segment.vendor_name || segment.destination || 'Hotel';
  }

  return {
    id: segment.id,
    type: 'segment',
    itemName,
    itemType: segment.segment_type,
    supplier: segment.vendor_name,
    date: segment.start_date,
    time: segment.start_time || undefined,
    status: segment.status || 'pending',
    confirmationNumber: segment.confirmation_number,
    cancellationPolicy: segment.cancellation_policy,
    cancellationDeadline: segment.cancellation_deadline,
    supportContact: segment.support_instructions,
    vendorUrl: segment.booking_source 
      ? `https://www.viator.com` 
      : undefined,
    priceCents: segment.sell_price_cents,
    currency: segment.currency || 'USD',
    originalData: segment,
  };
}
