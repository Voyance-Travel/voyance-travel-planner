/**
 * Payment Schedule Modal
 * 
 * Configure deposit/final payment schedules:
 * - Quick presets (50/50, 25/75, custom)
 * - Per-milestone amounts
 * - Reminder settings
 */

import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Calendar,
  Clock,
  Bell,
  Percent,
  DollarSign,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createPaymentSchedule, type PaymentSchedule, type AgencyTrip } from '@/services/agencyCRM';
import { format, addDays, subDays, parseISO } from 'date-fns';

interface ScheduleItem {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  reminder_enabled: boolean;
  reminder_days_before: number;
}

interface PaymentScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: AgencyTrip;
  existingSchedules: PaymentSchedule[];
  onSuccess: () => void;
}

const PRESETS = [
  { id: 'deposit_final', label: '50% Deposit / 50% Final', splits: [50, 50] },
  { id: '25_75', label: '25% Deposit / 75% Final', splits: [25, 75] },
  { id: 'thirds', label: 'Three Payments (33/33/34)', splits: [33, 33, 34] },
  { id: 'full', label: 'Full Payment Upfront', splits: [100] },
  { id: 'custom', label: 'Custom Schedule', splits: [] },
];

export default function PaymentScheduleModal({
  open,
  onOpenChange,
  trip,
  existingSchedules,
  onSuccess,
}: PaymentScheduleModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('deposit_final');
  const [defaultReminderDays, setDefaultReminderDays] = useState(7);

  const totalCents = trip.total_cost_cents || 0;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: trip.currency || 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  // Initialize schedule based on preset
  useEffect(() => {
    if (!open) return;
    
    const preset = PRESETS.find(p => p.id === selectedPreset);
    if (!preset || preset.id === 'custom') return;

    const tripStartDate = trip.start_date ? parseISO(trip.start_date) : addDays(new Date(), 60);
    const today = new Date();
    
    const items: ScheduleItem[] = preset.splits.map((percent, index) => {
      const amount = Math.round(totalCents * (percent / 100));
      let dueDate: Date;
      
      if (index === 0) {
        // First payment due soon or immediately
        dueDate = addDays(today, 7);
      } else if (index === preset.splits.length - 1) {
        // Final payment before trip
        dueDate = subDays(tripStartDate, 30);
      } else {
        // Middle payments spread out
        const daysUntilTrip = Math.floor((tripStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        dueDate = addDays(today, Math.floor(daysUntilTrip * ((index + 1) / (preset.splits.length + 1))));
      }
      
      const description = preset.splits.length === 1 
        ? 'Full Payment'
        : index === 0 
          ? 'Deposit' 
          : index === preset.splits.length - 1 
            ? 'Final Payment' 
            : `Payment ${index + 1}`;

      return {
        id: crypto.randomUUID(),
        description,
        amount_cents: amount,
        due_date: format(dueDate, 'yyyy-MM-dd'),
        reminder_enabled: true,
        reminder_days_before: defaultReminderDays,
      };
    });

    setScheduleItems(items);
  }, [open, selectedPreset, totalCents, trip.start_date, defaultReminderDays]);

  const handleAddItem = () => {
    const remainingCents = totalCents - scheduleItems.reduce((sum, i) => sum + i.amount_cents, 0);
    
    setScheduleItems(prev => [...prev, {
      id: crypto.randomUUID(),
      description: `Payment ${prev.length + 1}`,
      amount_cents: Math.max(0, remainingCents),
      due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
      reminder_enabled: true,
      reminder_days_before: defaultReminderDays,
    }]);
  };

  const handleRemoveItem = (id: string) => {
    setScheduleItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<ScheduleItem>) => {
    setScheduleItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const totalScheduled = scheduleItems.reduce((sum, i) => sum + i.amount_cents, 0);
  const difference = totalCents - totalScheduled;

  const handleSubmit = async () => {
    if (scheduleItems.length === 0) {
      toast({ title: 'Add at least one payment', variant: 'destructive' });
      return;
    }

    if (Math.abs(difference) > 100) { // Allow small rounding differences
      toast({ 
        title: 'Schedule does not match trip total', 
        description: `Difference: ${formatCurrency(difference)}`,
        variant: 'destructive' 
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create all schedule items
      for (const item of scheduleItems) {
        await createPaymentSchedule({
          trip_id: trip.id,
          description: item.description,
          amount_cents: item.amount_cents,
          due_date: item.due_date,
          is_paid: false,
          notes: item.reminder_enabled 
            ? `Reminder: ${item.reminder_days_before} days before due`
            : undefined,
        });
      }

      toast({ title: 'Payment schedule created!' });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create payment schedule:', error);
      toast({ title: 'Failed to create schedule', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Payment Schedule
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Trip Total Reference */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Trip Total</span>
            <span className="text-lg font-bold">{formatCurrency(totalCents)}</span>
          </div>

          {/* Preset Selection */}
          <div className="space-y-2">
            <Label>Quick Setup</Label>
            <Select value={selectedPreset} onValueChange={setSelectedPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map(preset => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Payment Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Payment Milestones</Label>
              <Button size="sm" variant="outline" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Payment
              </Button>
            </div>

            <div className="space-y-3">
              {scheduleItems.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{index + 1}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                        placeholder="e.g., Deposit"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Amount</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-7"
                          value={(item.amount_cents / 100).toFixed(2)}
                          onChange={(e) => {
                            const cents = Math.round(parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0') * 100);
                            handleUpdateItem(item.id, { amount_cents: cents });
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Due Date</Label>
                      <Input
                        type="date"
                        value={item.due_date}
                        onChange={(e) => handleUpdateItem(item.id, { due_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Reminder</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.reminder_enabled}
                          onCheckedChange={(checked) => handleUpdateItem(item.id, { reminder_enabled: checked })}
                        />
                        {item.reminder_enabled && (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="1"
                              className="w-16 h-8"
                              value={item.reminder_days_before}
                              onChange={(e) => handleUpdateItem(item.id, { reminder_days_before: parseInt(e.target.value) || 7 })}
                            />
                            <span className="text-xs text-muted-foreground">days before</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className={`p-4 rounded-lg ${Math.abs(difference) > 100 ? 'bg-red-50 border-red-200 border' : 'bg-muted/50'}`}>
            <div className="flex justify-between text-sm">
              <span>Total Scheduled</span>
              <span className="font-medium">{formatCurrency(totalScheduled)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Trip Total</span>
              <span className="font-medium">{formatCurrency(totalCents)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className={Math.abs(difference) > 100 ? 'text-red-600' : ''}>
                {difference === 0 ? 'Balanced ✓' : difference > 0 ? 'Remaining' : 'Over-scheduled'}
              </span>
              <span className={`font-bold ${Math.abs(difference) > 100 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(Math.abs(difference))}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
