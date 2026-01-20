import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, Send, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createQuote, updateQuote, type AgencyQuote, type QuoteLineItem } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';

interface QuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  quote?: AgencyQuote | null;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  description: string;
  expires_at: string;
  agency_fee_cents: number;
  discount_cents: number;
  tax_cents: number;
  terms_and_conditions: string;
  notes: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price_cents: number;
  }>;
}

export default function QuoteModal({ open, onOpenChange, tripId, quote, onSuccess }: QuoteModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!quote;

  const { register, handleSubmit, reset, watch, setValue, control } = useForm<FormData>({
    defaultValues: {
      line_items: [{ description: '', quantity: 1, unit_price_cents: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items',
  });

  const lineItems = watch('line_items') || [];
  const agencyFee = watch('agency_fee_cents') || 0;
  const discount = watch('discount_cents') || 0;
  const tax = watch('tax_cents') || 0;

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price_cents), 0);
  const total = subtotal + agencyFee - discount + tax;

  useEffect(() => {
    if (quote) {
      reset({
        name: quote.name || '',
        description: quote.description || '',
        expires_at: quote.expires_at?.split('T')[0] || '',
        agency_fee_cents: quote.agency_fee_cents / 100,
        discount_cents: quote.discount_cents / 100,
        tax_cents: quote.tax_cents / 100,
        terms_and_conditions: quote.terms_and_conditions || '',
        notes: quote.notes || '',
        line_items: (quote.line_items || []).map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents / 100,
        })),
      });
    } else {
      reset({
        name: '',
        description: '',
        expires_at: '',
        agency_fee_cents: 0,
        discount_cents: 0,
        tax_cents: 0,
        terms_and_conditions: '',
        notes: '',
        line_items: [{ description: '', quantity: 1, unit_price_cents: 0 }],
      });
    }
  }, [quote, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const lineItemsFormatted: QuoteLineItem[] = data.line_items
        .filter(item => item.description.trim())
        .map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: Math.round(item.unit_price_cents * 100),
          total_cents: Math.round(item.quantity * item.unit_price_cents * 100),
        }));

      const subtotalCents = lineItemsFormatted.reduce((sum, item) => sum + item.total_cents, 0);
      const agencyFeeCents = Math.round(data.agency_fee_cents * 100);
      const discountCents = Math.round(data.discount_cents * 100);
      const taxCents = Math.round(data.tax_cents * 100);
      const totalCents = subtotalCents + agencyFeeCents - discountCents + taxCents;

      const payload = {
        trip_id: tripId,
        name: data.name || `Quote v${quote?.version_number ? quote.version_number + 1 : 1}`,
        description: data.description,
        expires_at: data.expires_at || undefined,
        agency_fee_cents: agencyFeeCents,
        discount_cents: discountCents,
        tax_cents: taxCents,
        subtotal_cents: subtotalCents,
        total_cents: totalCents,
        terms_and_conditions: data.terms_and_conditions,
        notes: data.notes,
        line_items: lineItemsFormatted,
      };

      if (isEdit && quote) {
        await updateQuote(quote.id, payload);
        toast({ title: 'Quote updated' });
      } else {
        await createQuote(payload);
        toast({ title: 'Quote created' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to save quote', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEdit ? 'Edit Quote' : 'Create Quote'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Header Info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Quote Name</Label>
              <Input id="name" {...register('name')} placeholder="Trip to Europe - Option A" />
            </div>
            <div>
              <Label htmlFor="expires_at">Valid Until</Label>
              <Input id="expires_at" type="date" {...register('expires_at')} />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              {...register('description')} 
              placeholder="Overview of this quote option..."
              rows={2}
            />
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Line Items</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => append({ description: '', quantity: 1, unit_price_cents: 0 })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1">
                    <Input 
                      {...register(`line_items.${index}.description`)}
                      placeholder="Description (e.g., Round-trip flights JFK-LHR)"
                    />
                  </div>
                  <div className="w-20">
                    <Input 
                      type="number"
                      min="1"
                      {...register(`line_items.${index}.quantity`, { valueAsNumber: true })}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="w-28">
                    <Input 
                      type="number"
                      step="0.01"
                      {...register(`line_items.${index}.unit_price_cents`, { valueAsNumber: true })}
                      placeholder="Price"
                    />
                  </div>
                  <div className="w-24 text-right pt-2 font-medium">
                    {formatCurrency((lineItems[index]?.quantity || 0) * (lineItems[index]?.unit_price_cents || 0) * 100)}
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => fields.length > 1 && remove(index)}
                    disabled={fields.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="agency_fee_cents">Agency Fee ($)</Label>
                  <Input 
                    id="agency_fee_cents" 
                    type="number"
                    step="0.01"
                    {...register('agency_fee_cents', { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="discount_cents">Discount ($)</Label>
                  <Input 
                    id="discount_cents" 
                    type="number"
                    step="0.01"
                    {...register('discount_cents', { valueAsNumber: true })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tax_cents">Tax ($)</Label>
                <Input 
                  id="tax_cents" 
                  type="number"
                  step="0.01"
                  {...register('tax_cents', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal * 100)}</span>
              </div>
              {agencyFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Agency Fee</span>
                  <span>{formatCurrency(agencyFee * 100)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(discount * 100)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(tax * 100)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(total * 100)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Terms & Notes */}
          <div>
            <Label htmlFor="terms_and_conditions">Terms & Conditions</Label>
            <Textarea 
              id="terms_and_conditions" 
              {...register('terms_and_conditions')}
              placeholder="Payment terms, cancellation policies, etc."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="notes">Internal Notes (not shown to client)</Label>
            <Textarea 
              id="notes" 
              {...register('notes')}
              placeholder="Notes for your reference..."
              rows={2}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Quote' : 'Create Quote'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
