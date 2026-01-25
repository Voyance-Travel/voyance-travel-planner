/**
 * Budget Setup Dialog
 * 
 * Modal for setting up trip budget with input mode toggle and allocation sliders.
 */

import { useState, useEffect } from 'react';
import { Wallet, Users, Sliders, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  type BudgetAllocations, 
  type TripBudgetSettings,
  DEFAULT_ALLOCATIONS,
  getDefaultAllocations 
} from '@/services/tripBudgetService';

interface BudgetSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: TripBudgetSettings | null;
  travelers: number;
  spendStyle?: 'value_focused' | 'balanced' | 'splurge_forward';
  onSave: (settings: Partial<TripBudgetSettings>) => Promise<void>;
}

export function BudgetSetupDialog({
  open,
  onOpenChange,
  settings,
  travelers,
  spendStyle = 'balanced',
  onSave,
}: BudgetSetupDialogProps) {
  const [inputMode, setInputMode] = useState<'total' | 'per_person'>(settings?.budget_input_mode || 'total');
  const [amount, setAmount] = useState('');
  const [includeHotel, setIncludeHotel] = useState(settings?.budget_include_hotel ?? true);
  const [includeFlight, setIncludeFlight] = useState(settings?.budget_include_flight ?? false);
  const [warningsEnabled, setWarningsEnabled] = useState(settings?.budget_warnings_enabled ?? true);
  const [allocations, setAllocations] = useState<BudgetAllocations>(
    settings?.budget_allocations || getDefaultAllocations(spendStyle)
  );
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from settings
  useEffect(() => {
    if (settings?.budget_total_cents) {
      const displayAmount = inputMode === 'per_person' 
        ? settings.budget_total_cents / travelers / 100
        : settings.budget_total_cents / 100;
      setAmount(displayAmount.toString());
    }
  }, [settings, inputMode, travelers]);

  // Calculate totals
  const numericAmount = parseFloat(amount) || 0;
  const totalCents = inputMode === 'per_person' 
    ? Math.round(numericAmount * travelers * 100)
    : Math.round(numericAmount * 100);
  const perPersonCents = Math.round(totalCents / travelers);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings?.budget_currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  // Handle allocation changes
  const updateAllocation = (key: keyof BudgetAllocations, value: number) => {
    const newAllocations = { ...allocations, [key]: value };
    
    // Ensure allocations sum to 100
    const total = Object.values(newAllocations).reduce((a, b) => a + b, 0);
    if (total !== 100) {
      // Adjust buffer to compensate
      const diff = 100 - total;
      newAllocations.buffer_percent = Math.max(0, newAllocations.buffer_percent + diff);
    }
    
    setAllocations(newAllocations);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        budget_total_cents: totalCents,
        budget_input_mode: inputMode,
        budget_include_hotel: includeHotel,
        budget_include_flight: includeFlight,
        budget_warnings_enabled: warningsEnabled,
        budget_allocations: allocations,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const allocationTotal = Object.values(allocations).reduce((a, b) => a + b, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Trip Budget
          </DialogTitle>
          <DialogDescription>
            Set your budget and customize how it's allocated across categories.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="amount" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="amount">
              <DollarSign className="h-4 w-4 mr-2" />
              Amount
            </TabsTrigger>
            <TabsTrigger value="allocations">
              <Sliders className="h-4 w-4 mr-2" />
              Allocations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="amount" className="space-y-4 mt-4">
            {/* Input Mode Toggle */}
            <div className="flex items-center justify-center gap-4 p-3 bg-accent/50 rounded-lg">
              <Button
                variant={inputMode === 'total' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setInputMode('total')}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Total Trip
              </Button>
              <Button
                variant={inputMode === 'per_person' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setInputMode('per_person')}
              >
                <Users className="h-4 w-4 mr-2" />
                Per Person
              </Button>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="budget-amount">
                {inputMode === 'total' ? 'Total Budget' : 'Budget Per Person'}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="budget-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="pl-7 text-lg"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {inputMode === 'total' 
                  ? `${formatCurrency(perPersonCents)} per person for ${travelers} traveler${travelers > 1 ? 's' : ''}`
                  : `${formatCurrency(totalCents)} total for ${travelers} traveler${travelers > 1 ? 's' : ''}`
                }
              </p>
            </div>

            {/* Include Options */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="include-hotel">Include Hotel</Label>
                  <p className="text-xs text-muted-foreground">Track hotel against budget</p>
                </div>
                <Switch
                  id="include-hotel"
                  checked={includeHotel}
                  onCheckedChange={setIncludeHotel}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="include-flight">Include Flight</Label>
                  <p className="text-xs text-muted-foreground">Track flight costs (usually booked separately)</p>
                </div>
                <Switch
                  id="include-flight"
                  checked={includeFlight}
                  onCheckedChange={setIncludeFlight}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="warnings">Budget Warnings</Label>
                  <p className="text-xs text-muted-foreground">Show alerts when approaching limit</p>
                </div>
                <Switch
                  id="warnings"
                  checked={warningsEnabled}
                  onCheckedChange={setWarningsEnabled}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="allocations" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Customize how your budget is split across categories
              </p>
              <Badge variant={allocationTotal === 100 ? 'secondary' : 'destructive'}>
                {allocationTotal}%
              </Badge>
            </div>

            <div className="space-y-4">
              {/* Food */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Food & Dining</Label>
                  <span className="text-sm text-muted-foreground">{allocations.food_percent}%</span>
                </div>
                <Slider
                  value={[allocations.food_percent]}
                  onValueChange={([v]) => updateAllocation('food_percent', v)}
                  max={60}
                  step={5}
                />
              </div>

              {/* Activities */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Activities & Experiences</Label>
                  <span className="text-sm text-muted-foreground">{allocations.activities_percent}%</span>
                </div>
                <Slider
                  value={[allocations.activities_percent]}
                  onValueChange={([v]) => updateAllocation('activities_percent', v)}
                  max={60}
                  step={5}
                />
              </div>

              {/* Transit */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Local Transportation</Label>
                  <span className="text-sm text-muted-foreground">{allocations.transit_percent}%</span>
                </div>
                <Slider
                  value={[allocations.transit_percent]}
                  onValueChange={([v]) => updateAllocation('transit_percent', v)}
                  max={30}
                  step={5}
                />
              </div>

              {/* Misc */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Miscellaneous</Label>
                  <span className="text-sm text-muted-foreground">{allocations.misc_percent}%</span>
                </div>
                <Slider
                  value={[allocations.misc_percent]}
                  onValueChange={([v]) => updateAllocation('misc_percent', v)}
                  max={20}
                  step={5}
                />
              </div>

              {/* Buffer */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Buffer / Flexibility</Label>
                  <span className="text-sm text-muted-foreground">{allocations.buffer_percent}%</span>
                </div>
                <Slider
                  value={[allocations.buffer_percent]}
                  onValueChange={([v]) => updateAllocation('buffer_percent', v)}
                  max={50}
                  step={5}
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground">
                  Automatically adjusts to keep total at 100%
                </p>
              </div>
            </div>

            {/* Preset Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAllocations(DEFAULT_ALLOCATIONS.value_focused)}
              >
                Value-Focused
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAllocations(DEFAULT_ALLOCATIONS.balanced)}
              >
                Balanced
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAllocations(DEFAULT_ALLOCATIONS.splurge_forward)}
              >
                Splurge-Forward
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || totalCents <= 0}>
            {isSaving ? 'Saving...' : 'Save Budget'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BudgetSetupDialog;
