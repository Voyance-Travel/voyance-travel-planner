/**
 * Invoice Builder Modal
 * 
 * Create professional invoices with:
 * - Auto-populated line items from bookings
 * - Agency fee configuration
 * - Discount & tax handling
 * - Payment instructions
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  FileText,
  DollarSign,
  Calculator,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createInvoice, type BookingSegment, type AgencyTrip, SEGMENT_TYPE_LABELS } from '@/services/agencyCRM';
import { format, addDays } from 'date-fns';

interface InvoiceLineItem {
  id: string;
  description: string;
  segment_id?: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

interface InvoiceBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: AgencyTrip;
  segments: BookingSegment[];
  onSuccess: () => void;
}

export default function InvoiceBuilderModal({
  open,
  onOpenChange,
  trip,
  segments,
  onSuccess,
}: InvoiceBuilderModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [agencyFeeCents, setAgencyFeeCents] = useState(0);
  const [discountCents, setDiscountCents] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [dueInDays, setDueInDays] = useState(14);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());

  // Initialize line items from segments
  useEffect(() => {
    if (open) {
      const items: InvoiceLineItem[] = segments
        .filter(s => s.sell_price_cents > 0)
        .map(segment => ({
          id: crypto.randomUUID(),
          description: `${SEGMENT_TYPE_LABELS[segment.segment_type]} - ${segment.vendor_name || 'Unnamed'}${
            segment.confirmation_number ? ` (${segment.confirmation_number})` : ''
          }`,
          segment_id: segment.id,
          quantity: 1,
          unit_price_cents: segment.sell_price_cents,
          total_cents: segment.sell_price_cents,
        }));
      
      setLineItems(items);
      setSelectedSegments(new Set(items.map(i => i.segment_id).filter(Boolean) as string[]));
    }
  }, [open, segments]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: trip.currency || 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const parseCurrency = (value: string): number => {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return Math.round(parseFloat(cleaned || '0') * 100);
  };

  // Calculations
  const calculations = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total_cents, 0);
    const taxCents = Math.round((subtotal + agencyFeeCents - discountCents) * (taxPercent / 100));
    const total = subtotal + agencyFeeCents - discountCents + taxCents;
    return { subtotal, taxCents, total };
  }, [lineItems, agencyFeeCents, discountCents, taxPercent]);

  const handleAddLineItem = () => {
    setLineItems(prev => [...prev, {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit_price_cents: 0,
      total_cents: 0,
    }]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateLineItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // Recalculate total when quantity or unit price changes
      if (field === 'quantity' || field === 'unit_price_cents') {
        updated.total_cents = updated.quantity * updated.unit_price_cents;
      }
      
      return updated;
    }));
  };

  const toggleSegment = (segmentId: string) => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;

    const newSelected = new Set(selectedSegments);
    
    if (newSelected.has(segmentId)) {
      newSelected.delete(segmentId);
      setLineItems(prev => prev.filter(item => item.segment_id !== segmentId));
    } else {
      newSelected.add(segmentId);
      setLineItems(prev => [...prev, {
        id: crypto.randomUUID(),
        description: `${SEGMENT_TYPE_LABELS[segment.segment_type]} - ${segment.vendor_name || 'Unnamed'}`,
        segment_id: segment.id,
        quantity: 1,
        unit_price_cents: segment.sell_price_cents,
        total_cents: segment.sell_price_cents,
      }]);
    }
    
    setSelectedSegments(newSelected);
  };

  const handleSubmit = async () => {
    if (lineItems.length === 0) {
      toast({ title: 'Add at least one line item', variant: 'destructive' });
      return;
    }

    const invalidItems = lineItems.filter(item => !item.description.trim() || item.unit_price_cents <= 0);
    if (invalidItems.length > 0) {
      toast({ title: 'All line items must have a description and positive price', variant: 'destructive' });
      return;
    }

    if (dueInDays < 1) {
      toast({ title: 'Due date must be at least 1 day from now', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await createInvoice({
        trip_id: trip.id,
        account_id: trip.account_id,
        status: 'draft',
        due_date: format(addDays(new Date(), dueInDays), 'yyyy-MM-dd'),
        subtotal_cents: calculations.subtotal,
        agency_fee_cents: agencyFeeCents,
        discount_cents: discountCents,
        tax_cents: calculations.taxCents,
        total_cents: calculations.total,
        currency: trip.currency || 'USD',
        line_items: lineItems.map(item => ({
          description: item.description,
          segment_id: item.segment_id,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          total_cents: item.total_cents,
        })),
        payment_instructions: paymentInstructions,
        notes,
      });

      toast({ title: 'Invoice created!' });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create invoice:', error);
      toast({ title: 'Failed to create invoice', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Invoice
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Segment Selection */}
            {segments.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Include Bookings</Label>
                <div className="grid grid-cols-2 gap-2">
                  {segments.filter(s => s.sell_price_cents > 0).map(segment => (
                    <div
                      key={segment.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedSegments.has(segment.id)
                          ? 'bg-primary/5 border-primary/30'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleSegment(segment.id)}
                    >
                      <Checkbox checked={selectedSegments.has(segment.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {SEGMENT_TYPE_LABELS[segment.segment_type]}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {segment.vendor_name}
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(segment.sell_price_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Line Items</Label>
                <Button size="sm" variant="outline" onClick={handleAddLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-2">
                {lineItems.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleUpdateLineItem(item.id, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="col-span-3">
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-7"
                          placeholder="0.00"
                          value={(item.unit_price_cents / 100).toFixed(2)}
                          onChange={(e) => handleUpdateLineItem(item.id, 'unit_price_cents', parseCurrency(e.target.value))}
                        />
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="col-span-1"
                      onClick={() => handleRemoveLineItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Fees & Adjustments */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agency Fee</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-7"
                    placeholder="0.00"
                    value={(agencyFeeCents / 100).toFixed(2)}
                    onChange={(e) => setAgencyFeeCents(parseCurrency(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Discount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-7"
                    placeholder="0.00"
                    value={(discountCents / 100).toFixed(2)}
                    onChange={(e) => setDiscountCents(parseCurrency(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tax %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Due in (days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(parseInt(e.target.value) || 14)}
                />
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(calculations.subtotal)}</span>
              </div>
              {agencyFeeCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Agency Fee</span>
                  <span>+{formatCurrency(agencyFeeCents)}</span>
                </div>
              )}
              {discountCents > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountCents)}</span>
                </div>
              )}
              {calculations.taxCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax ({taxPercent}%)</span>
                  <span>+{formatCurrency(calculations.taxCents)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(calculations.total)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Payment Instructions</Label>
                <Textarea
                  placeholder="Bank transfer details, accepted payment methods, etc."
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes (shown on invoice)</Label>
                <Textarea
                  placeholder="Thank you for your business..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
