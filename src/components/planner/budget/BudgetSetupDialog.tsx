/**
 * Budget Setup Dialog
 * 
 * Modal for setting up trip budget with input mode toggle, allocation sliders,
 * and optional per-person budget differentiation.
 */

import { useState, useEffect } from 'react';
import { Wallet, Users, Sliders, DollarSign, AlertTriangle } from 'lucide-react';
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
  onSave: (settings: Partial<TripBudgetSettings> & { budget_individual_cents?: Record<string, number> }) => Promise<void>;
  /** Optional member names for per-person budget differentiation */
  memberNames?: { id: string; name: string }[];
  /** Current estimated trip total in cents — used for feasibility warnings */
  tripTotalCents?: number;
  /** Committed hotel cost in cents — used for hotel-vs-budget realism note */
  hotelCents?: number;
  /** Number of nights, for hotel breakdown copy */
  totalNights?: number;
}

export function BudgetSetupDialog({
  open,
  onOpenChange,
  settings,
  travelers,
  spendStyle = 'balanced',
  onSave,
  memberNames = [],
  tripTotalCents,
  hotelCents = 0,
  totalNights = 0,
}: BudgetSetupDialogProps) {
  const [inputMode, setInputMode] = useState<'total' | 'per_person'>(settings?.budget_input_mode || 'total');
  const [amount, setAmount] = useState('');
  const [includeHotel, setIncludeHotel] = useState(settings?.budget_include_hotel ?? true);
  const [includeFlight, setIncludeFlight] = useState(settings?.budget_include_flight ?? false);
  const [warningsEnabled, setWarningsEnabled] = useState(settings?.budget_warnings_enabled ?? true);
  const [allocations, setAllocations] = useState<BudgetAllocations>(() => {
    const a = settings?.budget_allocations;
    return (a && typeof a.food_percent === 'number' && typeof a.activities_percent === 'number')
      ? a
      : getDefaultAllocations(spendStyle);
  });
  const [isSaving, setIsSaving] = useState(false);
  // Per-person individual budgets: { memberId: dollarString }
  const [individualBudgets, setIndividualBudgets] = useState<Record<string, string>>({});
  const [useIndividualBudgets, setUseIndividualBudgets] = useState(false);

  // Initialize from settings
  useEffect(() => {
    if (settings?.budget_total_cents) {
      const displayAmount = inputMode === 'per_person' 
        ? settings.budget_total_cents / travelers / 100
        : settings.budget_total_cents / 100;
      setAmount(displayAmount.toString());
    }
    
    // Initialize individual budgets from saved data
    const savedIndividual = (settings as any)?.budget_individual_cents as Record<string, number> | null;
    if (savedIndividual && memberNames.length >= 2) {
      const restored: Record<string, string> = {};
      let hasAny = false;
      memberNames.forEach(m => {
        const cents = savedIndividual[m.id];
        if (cents && cents > 0) {
          restored[m.id] = (cents / 100).toString();
          hasAny = true;
        }
      });
      if (hasAny) {
        setIndividualBudgets(restored);
        setUseIndividualBudgets(true);
      }
    }
  }, [settings, inputMode, travelers, memberNames]);

  // Calculate totals
  const numericAmount = parseFloat(amount) || 0;
  
  // If using individual budgets, sum them for the total
  const individualTotal = useIndividualBudgets && memberNames.length >= 2
    ? memberNames.reduce((sum, m) => sum + (parseFloat(individualBudgets[m.id] || '0') || 0), 0)
    : 0;
  
  const totalCents = useIndividualBudgets && memberNames.length >= 2
    ? Math.round(individualTotal * 100)
    : inputMode === 'per_person' 
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
      const diff = 100 - total;
      newAllocations.buffer_percent = Math.max(0, newAllocations.buffer_percent + diff);
    }
    
    setAllocations(newAllocations);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saveData: Partial<TripBudgetSettings> & { budget_individual_cents?: Record<string, number> } = {
        budget_total_cents: totalCents,
        budget_input_mode: inputMode,
        budget_include_hotel: includeHotel,
        budget_include_flight: includeFlight,
        budget_warnings_enabled: warningsEnabled,
        budget_allocations: allocations,
      };
      
      // Include individual budgets if enabled
      if (useIndividualBudgets && memberNames.length >= 2) {
        const individualCents: Record<string, number> = {};
        memberNames.forEach(m => {
          individualCents[m.id] = Math.round((parseFloat(individualBudgets[m.id] || '0') || 0) * 100);
        });
        saveData.budget_individual_cents = individualCents;
      }
      
      await onSave(saveData);
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
                onClick={() => { setInputMode('total'); setUseIndividualBudgets(false); }}
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

            {/* Per-Person Individual Budgets */}
            {inputMode === 'per_person' && memberNames.length >= 2 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="individual-toggle">Individual amounts</Label>
                    <p className="text-xs text-muted-foreground">Set different budgets per traveler</p>
                  </div>
                  <Switch
                    id="individual-toggle"
                    checked={useIndividualBudgets}
                    onCheckedChange={setUseIndividualBudgets}
                  />
                </div>
                
                {useIndividualBudgets && (
                  <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    {memberNames.map(member => (
                      <div key={member.id} className="flex items-center gap-3">
                        <span className="text-sm font-medium min-w-0 truncate flex-1">
                          {member.name}
                        </span>
                        <div className="relative w-28">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            type="number"
                            min="0"
                            value={individualBudgets[member.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || parseFloat(val) >= 0) {
                                setIndividualBudgets(prev => ({
                                  ...prev,
                                  [member.id]: val,
                                }));
                              }
                            }}
                            placeholder="0"
                            className="pl-6 h-8 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="text-sm font-semibold">{formatCurrency(totalCents)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Amount Input — hidden when using individual budgets */}
            {!(useIndividualBudgets && inputMode === 'per_person' && memberNames.length >= 2) && (
              <div className="space-y-2">
                <Label htmlFor="budget-amount">
                  {inputMode === 'total' ? 'Total Budget' : 'Budget Per Person'}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="budget-amount"
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) setAmount(val);
                    }}
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
                {/* Impossible budget warning */}
                {tripTotalCents && tripTotalCents > 0 && totalCents > 0 && totalCents < tripTotalCents * 0.5 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Your trip's estimated cost is {formatCurrency(tripTotalCents)}.
                      This budget may be difficult to achieve without significant changes.
                    </span>
                  </div>
                )}
              </div>
            )}

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
                  <Label>Spending Money & Tips</Label>
                  <span className="text-sm text-muted-foreground">{allocations.misc_percent}%</span>
                </div>
                <Slider
                  value={[allocations.misc_percent]}
                  onValueChange={([v]) => updateAllocation('misc_percent', v)}
                  max={20}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Cash reserve for tips, pharmacy, SIMs, market finds. Not auto-filled by the itinerary — log expenses as you go.
                </p>
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

            {/* Preset Buttons — labels carry realistic per-person/day spend bands
                so users don't anchor on the vibe word and undersize the budget
                for venues the AI then schedules. */}
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-xs text-muted-foreground">
                Pick a preset that matches your daily spend, not just your vibe.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2 items-start"
                  onClick={() => setAllocations(DEFAULT_ALLOCATIONS.value_focused)}
                  title="Hostels, casual dining, free activities. Best for backpacking and longer stays."
                >
                  <span className="font-medium">Value-Focused</span>
                  <span className="text-[10px] text-muted-foreground">$80–150/day pp</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2 items-start"
                  onClick={() => setAllocations(DEFAULT_ALLOCATIONS.balanced)}
                  title="Mid-range hotels, bistros + one nicer dinner. Most travelers."
                >
                  <span className="font-medium">Balanced</span>
                  <span className="text-[10px] text-muted-foreground">$150–300/day pp</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2 items-start"
                  onClick={() => setAllocations(DEFAULT_ALLOCATIONS.splurge_forward)}
                  title="4–5★ hotels, 1 splurge dinner, premium activities, private/airport transfers and frequent taxis. Not Michelin-every-night."
                >
                  <span className="font-medium">Splurge-Forward</span>
                  <span className="text-[10px] text-muted-foreground">$300–500/day pp · ~20% transit</span>
                </Button>
              </div>
              {/* Hotel realism note — fires when the chosen hotel alone exceeds the typed budget */}
              {hotelCents > 0 && includeHotel && totalCents > 0 && hotelCents >= totalCents * 0.6 && (() => {
                const ratio = hotelCents / Math.max(1, totalCents);
                const cushion = Math.round(hotelCents * 0.4);
                const suggested = Math.ceil((hotelCents + cushion) / 10000) * 10000;
                return (
                  <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Your selected hotel alone is <span className="font-medium">{formatCurrency(hotelCents)}</span>{totalNights > 0 ? <> ({totalNights} night{totalNights !== 1 ? 's' : ''})</> : null} — about <span className="font-medium">{ratio.toFixed(1)}×</span> this budget. Consider <span className="font-medium">{formatCurrency(suggested)}+</span> so the preset can fund dining and experiences on top, or toggle "Include Hotel" off below.
                    </span>
                  </div>
                );
              })()}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          {totalCents <= 0 && (
            <p className="text-sm text-destructive mr-auto self-center">
              Please enter a budget amount greater than $0
            </p>
          )}
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
