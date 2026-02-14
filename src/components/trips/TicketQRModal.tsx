/**
 * TicketQRModal
 * Displays QR codes and ticket information for quick access
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, QrCode, Copy, Check, Download, ExternalLink,
  Ticket, Calendar, Clock, MapPin, User
} from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface TicketData {
  id: string;
  title: string;
  type: 'ticket' | 'pass' | 'voucher' | 'reservation';
  date?: string;
  time?: string;
  location?: string;
  confirmationNumber?: string;
  qrCodeUrl?: string;
  qrCodeData?: string;
  voucherUrl?: string;
  redemptionInstructions?: string;
  validFrom?: string;
  validUntil?: string;
  travelerName?: string;
  notes?: string;
}

interface TicketQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: TicketData | null;
}

export function TicketQRModal({
  isOpen,
  onClose,
  ticket,
}: TicketQRModalProps) {
  const [copied, setCopied] = useState(false);

  if (!ticket) return null;

  const handleCopy = () => {
    if (ticket.confirmationNumber) {
      navigator.clipboard.writeText(ticket.confirmationNumber);
      setCopied(true);
      toast.success('Confirmation copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (ticket.voucherUrl) {
      window.open(ticket.voucherUrl, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            {ticket.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR Code Display */}
          {(ticket.qrCodeUrl || ticket.qrCodeData) && (
            <div className="flex flex-col items-center p-6 bg-white rounded-xl">
              <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {ticket.qrCodeUrl ? (
                  <img 
                    src={ticket.qrCodeUrl} 
                    alt="QR Code"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <QrCode className="h-16 w-16 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">QR Code</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Show this at the entrance
              </p>
            </div>
          )}

          {/* Confirmation Number */}
          {ticket.confirmationNumber && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Confirmation Number
                  </p>
                  <code className="text-lg font-mono font-bold tracking-wider">
                    {ticket.confirmationNumber}
                  </code>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="space-y-3 text-sm">
            {ticket.date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(parseLocalDate(ticket.date), 'EEEE, MMMM d, yyyy')}
                  {ticket.time && ` at ${ticket.time}`}
                </span>
              </div>
            )}
            
            {ticket.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{ticket.location}</span>
              </div>
            )}
            
            {ticket.travelerName && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{ticket.travelerName}</span>
              </div>
            )}

            {(ticket.validFrom || ticket.validUntil) && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {ticket.validFrom && `From ${format(parseLocalDate(ticket.validFrom), 'MMM d')}`}
                  {ticket.validFrom && ticket.validUntil && ' - '}
                  {ticket.validUntil && `Until ${format(parseLocalDate(ticket.validUntil), 'MMM d')}`}
                </span>
              </div>
            )}
          </div>

          {/* Redemption Instructions */}
          {ticket.redemptionInstructions && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Instructions</p>
              <p className="text-sm">{ticket.redemptionInstructions}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {ticket.voucherUrl && (
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            )}
            <Button className="flex-1" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TicketQRModal;
