/**
 * Agent Booking Actions Component
 * 
 * A stateful booking flow for travel agents that makes itinerary items "alive":
 * 1. Book (external) - Opens Viator with "Mark as Booked" after
 * 2. Capture Confirmation - Agent enters supplier confirmation details
 * 3. Manage Voucher - Upload/view voucher, tickets
 * 4. Cancel/Refund - Record cancellations and refunds
 */

import { useState } from 'react';
import { 
  ExternalLink, 
  Check, 
  Upload, 
  FileText, 
  XCircle, 
  DollarSign,
  Ticket,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { VendorBookingLink } from '@/components/booking/VendorBookingLink';

// Booking states specific to agent workflow (external bookings)
export type AgentBookingState = 
  | 'not_booked'         // Initial state - show "Book on Viator"
  | 'pending_capture'    // Agent clicked external link, now needs to capture confirmation
  | 'confirmed'          // Confirmation captured, booking is live
  | 'voucher_pending'    // Waiting for voucher/tickets
  | 'voucher_ready'      // Voucher uploaded and available
  | 'cancelled'          // Booking was cancelled
  | 'refunded';          // Refund processed

export interface AgentBookingData {
  id: string;
  title: string;
  state: AgentBookingState;
  // Supplier/vendor info
  vendorName?: string;
  vendorBookingUrl?: string;
  // Confirmation details
  confirmationNumber?: string;
  supplierConfirmationNumber?: string;
  bookedAt?: string;
  bookedBy?: string;
  // Pricing
  netCostCents?: number;
  sellPriceCents?: number;
  commissionCents?: number;
  currency?: string;
  // Voucher/tickets
  voucherUrl?: string;
  voucherCode?: string;
  ticketNumbers?: string[];
  redemptionInstructions?: string;
  // Policies
  cancellationDeadline?: string;
  cancellationPolicy?: string;
  // Cancellation/refund
  cancelledAt?: string;
  cancellationReason?: string;
  refundAmountCents?: number;
  refundedAt?: string;
  // Travelers
  travelerCount?: number;
  leadTravelerName?: string;
  // Notes
  internalNotes?: string;
}

interface AgentBookingActionsProps {
  booking: AgentBookingData;
  destination: string;
  estimatedCost?: number;
  onStateChange: (bookingId: string, newState: AgentBookingState, data?: Partial<AgentBookingData>) => void;
  compact?: boolean;
}

export function AgentBookingActions({
  booking,
  destination,
  estimatedCost,
  onStateChange,
  compact = false,
}: AgentBookingActionsProps) {
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  
  const { state } = booking;
  const currency = booking.currency || 'USD';
  
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  // Handle external booking click - opens Viator and transitions to pending_capture
  const handleExternalBook = () => {
    // The VendorBookingLink opens the external URL
    // We transition to pending_capture so agent can capture confirmation
    onStateChange(booking.id, 'pending_capture', {
      vendorName: 'Viator',
    });
  };

  // Render state-specific UI
  switch (state) {
    case 'not_booked':
      return (
        <div className="flex items-center gap-2">
          <VendorBookingLink
            activityName={booking.title}
            destination={destination}
            externalBookingUrl={booking.vendorBookingUrl}
            preferredVendor="viator"
            estimatedPrice={estimatedCost}
            size="sm"
            onAfterClick={() => handleExternalBook()}
          />
          {!compact && (
            <span className="text-xs text-muted-foreground">
              Opens in new tab
            </span>
          )}
        </div>
      );

    case 'pending_capture':
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Awaiting Confirmation
          </Badge>
          <Button
            size="sm"
            variant="default"
            onClick={() => setShowConfirmationModal(true)}
            className="gap-1.5 text-xs"
          >
            <Check className="h-3 w-3" />
            {compact ? 'Capture' : 'Capture Confirmation'}
          </Button>
          <VendorBookingLink
            activityName={booking.title}
            destination={destination}
            externalBookingUrl={booking.vendorBookingUrl}
            preferredVendor="viator"
            size="sm"
            variant="ghost"
            className="text-xs"
          >
            Rebook
          </VendorBookingLink>
          
          <ConfirmationCaptureModal
            open={showConfirmationModal}
            onOpenChange={setShowConfirmationModal}
            booking={booking}
            onSave={(data) => {
              onStateChange(booking.id, 'confirmed', data);
              setShowConfirmationModal(false);
            }}
          />
        </div>
      );

    case 'confirmed':
    case 'voucher_pending':
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-green-600 text-white text-xs">
            <Check className="h-3 w-3 mr-1" />
            Confirmed
          </Badge>
          {booking.confirmationNumber && (
            <span className="font-mono text-xs text-muted-foreground">
              #{booking.confirmationNumber}
            </span>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowVoucherModal(true)}
            className="gap-1.5 text-xs"
          >
            <Upload className="h-3 w-3" />
            {booking.voucherUrl ? 'View Voucher' : 'Add Voucher'}
          </Button>
          
          <AgentBookingMenu
            booking={booking}
            onEdit={() => setShowConfirmationModal(true)}
            onCancel={() => setShowCancelModal(true)}
          />
          
          <ConfirmationCaptureModal
            open={showConfirmationModal}
            onOpenChange={setShowConfirmationModal}
            booking={booking}
            onSave={(data) => {
              onStateChange(booking.id, 'confirmed', data);
              setShowConfirmationModal(false);
            }}
          />
          
          <VoucherUploadModal
            open={showVoucherModal}
            onOpenChange={setShowVoucherModal}
            booking={booking}
            onSave={(data) => {
              onStateChange(booking.id, 'voucher_ready', data);
              setShowVoucherModal(false);
            }}
          />
          
          <CancelBookingModal
            open={showCancelModal}
            onOpenChange={setShowCancelModal}
            booking={booking}
            onConfirm={(data) => {
              onStateChange(booking.id, 'cancelled', data);
              setShowCancelModal(false);
            }}
          />
        </div>
      );

    case 'voucher_ready':
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-green-600 text-white text-xs">
            <Ticket className="h-3 w-3 mr-1" />
            Voucher Ready
          </Badge>
          {booking.confirmationNumber && (
            <span className="font-mono text-xs text-muted-foreground">
              #{booking.confirmationNumber}
            </span>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowVoucherModal(true)}
            className="gap-1.5 text-xs"
          >
            <FileText className="h-3 w-3" />
            View Voucher
          </Button>
          
          <AgentBookingMenu
            booking={booking}
            onEdit={() => setShowConfirmationModal(true)}
            onCancel={() => setShowCancelModal(true)}
          />
          
          <ConfirmationCaptureModal
            open={showConfirmationModal}
            onOpenChange={setShowConfirmationModal}
            booking={booking}
            onSave={(data) => {
              onStateChange(booking.id, 'voucher_ready', data);
              setShowConfirmationModal(false);
            }}
          />
          
          <VoucherUploadModal
            open={showVoucherModal}
            onOpenChange={setShowVoucherModal}
            booking={booking}
            onSave={(data) => {
              onStateChange(booking.id, 'voucher_ready', data);
              setShowVoucherModal(false);
            }}
          />
          
          <CancelBookingModal
            open={showCancelModal}
            onOpenChange={setShowCancelModal}
            booking={booking}
            onConfirm={(data) => {
              onStateChange(booking.id, 'cancelled', data);
              setShowCancelModal(false);
            }}
          />
        </div>
      );

    case 'cancelled':
      return (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
          {booking.cancelledAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(booking.cancelledAt).toLocaleDateString()}
            </span>
          )}
          {booking.refundAmountCents !== undefined && booking.refundAmountCents > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRefundModal(true)}
              className="gap-1.5 text-xs"
            >
              <DollarSign className="h-3 w-3" />
              Record Refund
            </Button>
          )}
          
          <RefundModal
            open={showRefundModal}
            onOpenChange={setShowRefundModal}
            booking={booking}
            onConfirm={(data) => {
              onStateChange(booking.id, 'refunded', data);
              setShowRefundModal(false);
            }}
          />
        </div>
      );

    case 'refunded':
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            Refunded
          </Badge>
          {booking.refundAmountCents && (
            <span className="text-xs text-muted-foreground">
              {formatPrice(booking.refundAmountCents)}
            </span>
          )}
        </div>
      );

    default:
      return null;
  }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function AgentBookingMenu({
  booking,
  onEdit,
  onCancel,
}: {
  booking: AgentBookingData;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Booking segment options">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCancel} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Cancel Booking
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// MODALS
// =============================================================================

interface ConfirmationCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: AgentBookingData;
  onSave: (data: Partial<AgentBookingData>) => void;
}

function ConfirmationCaptureModal({
  open,
  onOpenChange,
  booking,
  onSave,
}: ConfirmationCaptureModalProps) {
  const [confirmationNumber, setConfirmationNumber] = useState(booking.confirmationNumber || '');
  const [supplierConfirmation, setSupplierConfirmation] = useState(booking.supplierConfirmationNumber || '');
  const [netCost, setNetCost] = useState(
    booking.netCostCents ? (booking.netCostCents / 100).toFixed(2) : ''
  );
  const [sellPrice, setSellPrice] = useState(
    booking.sellPriceCents ? (booking.sellPriceCents / 100).toFixed(2) : ''
  );
  const [travelerCount, setTravelerCount] = useState(booking.travelerCount?.toString() || '1');
  const [leadTraveler, setLeadTraveler] = useState(booking.leadTravelerName || '');
  const [cancellationDeadline, setCancellationDeadline] = useState(booking.cancellationDeadline || '');
  const [notes, setNotes] = useState(booking.internalNotes || '');

  const handleSave = () => {
    onSave({
      confirmationNumber,
      supplierConfirmationNumber: supplierConfirmation,
      netCostCents: netCost ? Math.round(parseFloat(netCost) * 100) : undefined,
      sellPriceCents: sellPrice ? Math.round(parseFloat(sellPrice) * 100) : undefined,
      travelerCount: parseInt(travelerCount) || 1,
      leadTravelerName: leadTraveler,
      cancellationDeadline,
      internalNotes: notes,
      bookedAt: booking.bookedAt || new Date().toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Capture Booking Confirmation</DialogTitle>
          <DialogDescription>
            Enter the confirmation details from {booking.vendorName || 'the supplier'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="confirmation">Confirmation Number *</Label>
            <Input
              id="confirmation"
              value={confirmationNumber}
              onChange={(e) => setConfirmationNumber(e.target.value)}
              placeholder="e.g., VIA-123456"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="supplierConf">Supplier Reference (optional)</Label>
            <Input
              id="supplierConf"
              value={supplierConfirmation}
              onChange={(e) => setSupplierConfirmation(e.target.value)}
              placeholder="Vendor's internal reference"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="netCost">Net Cost</Label>
              <Input
                id="netCost"
                type="number"
                step="0.01"
                value={netCost}
                onChange={(e) => setNetCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sellPrice">Sell Price</Label>
              <Input
                id="sellPrice"
                type="number"
                step="0.01"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="travelers">Travelers</Label>
              <Input
                id="travelers"
                type="number"
                min="1"
                value={travelerCount}
                onChange={(e) => setTravelerCount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leadTraveler">Lead Traveler</Label>
              <Input
                id="leadTraveler"
                value={leadTraveler}
                onChange={(e) => setLeadTraveler(e.target.value)}
                placeholder="Name"
              />
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="cancelDeadline">Cancellation Deadline</Label>
            <Input
              id="cancelDeadline"
              type="datetime-local"
              value={cancellationDeadline}
              onChange={(e) => setCancellationDeadline(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this booking..."
              rows={2}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!confirmationNumber.trim()}>
            Save Confirmation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface VoucherUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: AgentBookingData;
  onSave: (data: Partial<AgentBookingData>) => void;
}

function VoucherUploadModal({
  open,
  onOpenChange,
  booking,
  onSave,
}: VoucherUploadModalProps) {
  const [voucherUrl, setVoucherUrl] = useState(booking.voucherUrl || '');
  const [voucherCode, setVoucherCode] = useState(booking.voucherCode || '');
  const [ticketNumbers, setTicketNumbers] = useState(booking.ticketNumbers?.join(', ') || '');
  const [instructions, setInstructions] = useState(booking.redemptionInstructions || '');

  const handleSave = () => {
    onSave({
      voucherUrl,
      voucherCode,
      ticketNumbers: ticketNumbers ? ticketNumbers.split(',').map(t => t.trim()) : [],
      redemptionInstructions: instructions,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Voucher & Tickets</DialogTitle>
          <DialogDescription>
            Add voucher details for {booking.title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="voucherUrl">Voucher URL / PDF Link</Label>
            <Input
              id="voucherUrl"
              type="url"
              value={voucherUrl}
              onChange={(e) => setVoucherUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="voucherCode">Voucher Code</Label>
            <Input
              id="voucherCode"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              placeholder="Code to show at venue"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="tickets">Ticket Numbers (comma-separated)</Label>
            <Input
              id="tickets"
              value={ticketNumbers}
              onChange={(e) => setTicketNumbers(e.target.value)}
              placeholder="TKT-001, TKT-002"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="instructions">Redemption Instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="How to use this voucher..."
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Voucher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CancelBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: AgentBookingData;
  onConfirm: (data: Partial<AgentBookingData>) => void;
}

function CancelBookingModal({
  open,
  onOpenChange,
  booking,
  onConfirm,
}: CancelBookingModalProps) {
  const [reason, setReason] = useState('');
  const [refundExpected, setRefundExpected] = useState('');

  const handleConfirm = () => {
    onConfirm({
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason,
      refundAmountCents: refundExpected ? Math.round(parseFloat(refundExpected) * 100) : undefined,
    });
  };

  const originalPrice = booking.sellPriceCents || booking.netCostCents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancel Booking
          </DialogTitle>
          <DialogDescription>
            This will mark the booking for {booking.title} as cancelled.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {booking.confirmationNumber && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">Confirmation:</span>{' '}
                <span className="font-mono">{booking.confirmationNumber}</span>
              </p>
              {originalPrice && (
                <p className="text-sm mt-1">
                  <span className="text-muted-foreground">Original amount:</span>{' '}
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: booking.currency || 'USD',
                  }).format(originalPrice / 100)}
                </p>
              )}
            </div>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="reason">Cancellation Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_request">Client Request</SelectItem>
                <SelectItem value="schedule_change">Schedule Change</SelectItem>
                <SelectItem value="supplier_cancellation">Supplier Cancelled</SelectItem>
                <SelectItem value="weather">Weather/Force Majeure</SelectItem>
                <SelectItem value="duplicate">Duplicate Booking</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="refund">Expected Refund Amount</Label>
            <Input
              id="refund"
              type="number"
              step="0.01"
              value={refundExpected}
              onChange={(e) => setRefundExpected(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty if no refund expected
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep Booking
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason}>
            Cancel Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: AgentBookingData;
  onConfirm: (data: Partial<AgentBookingData>) => void;
}

function RefundModal({
  open,
  onOpenChange,
  booking,
  onConfirm,
}: RefundModalProps) {
  const [refundAmount, setRefundAmount] = useState(
    booking.refundAmountCents ? (booking.refundAmountCents / 100).toFixed(2) : ''
  );
  const [refundMethod, setRefundMethod] = useState('original_payment');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm({
      refundAmountCents: refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined,
      refundedAt: new Date().toISOString(),
      internalNotes: notes ? `${booking.internalNotes || ''}\nRefund: ${notes}`.trim() : booking.internalNotes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Refund</DialogTitle>
          <DialogDescription>
            Record the refund for this cancelled booking
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">Booking:</span> {booking.title}
            </p>
            {booking.cancellationReason && (
              <p className="text-sm mt-1">
                <span className="text-muted-foreground">Reason:</span>{' '}
                {booking.cancellationReason.replace('_', ' ')}
              </p>
            )}
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="refundAmount">Refund Amount *</Label>
            <Input
              id="refundAmount"
              type="number"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="method">Refund Method</Label>
            <Select value={refundMethod} onValueChange={setRefundMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original_payment">Original Payment Method</SelectItem>
                <SelectItem value="credit">Travel Credit</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="refundNotes">Notes</Label>
            <Textarea
              id="refundNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this refund..."
              rows={2}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!refundAmount}>
            Record Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AgentBookingActions;
