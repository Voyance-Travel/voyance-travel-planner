import { motion } from 'framer-motion';
import { Users, User, DollarSign, Compass, Heart, Briefcase, Baby, UserCircle, SkipForward, ArrowRight, Plane, Building, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import DestinationTeaser from '../shared/DestinationTeaser';

interface Companion {
  id: string;
  name: string;
  type: 'adult' | 'child';
}

interface BudgetAllocation {
  hotel: number;
  flight: number;
  activities: number;
}

interface TripContextProps {
  formData: {
    destination: string;
    departureCity: string;
    startDate: string;
    endDate: string;
    travelers: number;
  };
  companions: Companion[];
  budget: string;
  budgetAllocation: BudgetAllocation;
  tripType: string;
  updateCompanions: (companions: Companion[]) => void;
  updateBudget: (budget: string) => void;
  updateBudgetAllocation: (allocation: BudgetAllocation) => void;
  updateTripType: (tripType: string) => void;
  onContinue: () => void;
  onSkipToItinerary?: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

const budgetOptions = [
  { value: 'budget', label: 'Budget-Friendly', description: 'Smart savings', icon: '$', color: 'from-emerald-500 to-teal-500' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced comfort', icon: '$$', color: 'from-blue-500 to-indigo-500' },
  { value: 'premium', label: 'Premium', description: 'Elevated experience', icon: '$$$', color: 'from-violet-500 to-purple-500' },
  { value: 'luxury', label: 'Luxury', description: 'No compromises', icon: '✦', color: 'from-amber-500 to-orange-500' },
];

const tripTypeOptions = [
  { value: 'leisure', label: 'Leisure', description: 'Relaxation & exploration', icon: Compass, color: 'from-sky-500 to-blue-500' },
  { value: 'romantic', label: 'Romantic', description: 'Couple getaway', icon: Heart, color: 'from-rose-500 to-pink-500' },
  { value: 'family', label: 'Family', description: 'All ages adventure', icon: Baby, color: 'from-green-500 to-emerald-500' },
  { value: 'business', label: 'Business', description: 'Work & meetings', icon: Briefcase, color: 'from-slate-500 to-zinc-500' },
];

function CompanionCard({ 
  companion, 
  index,
  onChange 
}: { 
  companion: Companion; 
  index: number;
  onChange: (updates: Partial<Companion>) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-4 hover:border-primary/30 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative">
          <div className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
            companion.name 
              ? 'bg-gradient-to-br from-primary to-primary/80' 
              : 'bg-gradient-to-br from-slate-200 to-slate-300'
          )}>
            {companion.name ? (
              <span className="text-xl font-bold text-white">
                {companion.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <UserCircle className="w-7 h-7 text-slate-500" />
            )}
          </div>
          {index === 0 && (
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-primary text-[10px] font-medium text-white rounded-full">
              You
            </span>
          )}
        </div>
        
        {/* Name Input */}
        <div className="flex-1">
          <Label className="text-xs font-medium text-slate-500 mb-1.5 block">
            Traveler {index + 1}
          </Label>
          <Input
            placeholder={index === 0 ? "Your name (optional)" : "Name (optional)"}
            value={companion.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-9 bg-white/50 border-slate-200 focus:border-primary"
          />
        </div>
        
        {/* Type Toggle */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onChange({ type: 'adult' })}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              companion.type === 'adult' 
                ? 'bg-primary text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            Adult
          </button>
          <button
            type="button"
            onClick={() => onChange({ type: 'child' })}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              companion.type === 'child' 
                ? 'bg-primary text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            Child
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function BudgetCard({
  option,
  isSelected,
  onSelect,
}: {
  option: typeof budgetOptions[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative p-4 rounded-xl text-left transition-all overflow-hidden group',
        isSelected
          ? 'ring-2 ring-primary shadow-lg'
          : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md'
      )}
    >
      {/* Background gradient when selected */}
      {isSelected && (
        <div className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-10',
          option.color
        )} />
      )}
      
      <div className="relative flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-colors',
          isSelected 
            ? `bg-gradient-to-br ${option.color} text-white` 
            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
        )}>
          {option.icon}
        </div>
        <div>
          <p className={cn(
            'font-semibold transition-colors',
            isSelected ? 'text-primary' : 'text-slate-900'
          )}>{option.label}</p>
          <p className="text-xs text-slate-500">{option.description}</p>
        </div>
      </div>
    </motion.button>
  );
}

function TripTypeCard({
  option,
  isSelected,
  onSelect,
}: {
  option: typeof tripTypeOptions[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative p-4 rounded-xl text-left transition-all overflow-hidden group',
        isSelected
          ? 'ring-2 ring-primary shadow-lg'
          : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md'
      )}
    >
      {isSelected && (
        <div className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-10',
          option.color
        )} />
      )}
      
      <div className="relative flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
          isSelected 
            ? `bg-gradient-to-br ${option.color} text-white` 
            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className={cn(
            'font-semibold transition-colors',
            isSelected ? 'text-primary' : 'text-slate-900'
          )}>{option.label}</p>
          <p className="text-xs text-slate-500">{option.description}</p>
        </div>
      </div>
    </motion.button>
  );
}

export default function TripContext({
  formData,
  companions,
  budget,
  budgetAllocation,
  tripType,
  updateCompanions,
  updateBudget,
  updateBudgetAllocation,
  updateTripType,
  onContinue,
  onSkipToItinerary,
  onBack,
  isSubmitting,
}: TripContextProps) {
  const handleCompanionChange = (index: number, updates: Partial<Companion>) => {
    const newCompanions = [...companions];
    newCompanions[index] = { ...newCompanions[index], ...updates };
    updateCompanions(newCompanions);
  };

  const handleAllocationChange = (category: keyof BudgetAllocation, value: number) => {
    const remaining = 100 - value;
    const otherCategories = Object.keys(budgetAllocation).filter(k => k !== category) as (keyof BudgetAllocation)[];
    const currentOtherTotal = otherCategories.reduce((sum, k) => sum + budgetAllocation[k], 0);
    
    if (currentOtherTotal === 0) {
      // Split remaining equally among other categories
      const splitValue = Math.floor(remaining / otherCategories.length);
      const newAllocation = { ...budgetAllocation, [category]: value };
      otherCategories.forEach((k, i) => {
        newAllocation[k] = i === otherCategories.length - 1 
          ? remaining - splitValue * (otherCategories.length - 1) 
          : splitValue;
      });
      updateBudgetAllocation(newAllocation);
    } else {
      // Scale other categories proportionally
      const scale = remaining / currentOtherTotal;
      const newAllocation = { ...budgetAllocation, [category]: value };
      let allocated = value;
      otherCategories.forEach((k, i) => {
        if (i === otherCategories.length - 1) {
          newAllocation[k] = 100 - allocated;
        } else {
          newAllocation[k] = Math.round(budgetAllocation[k] * scale);
          allocated += newAllocation[k];
        }
      });
      updateBudgetAllocation(newAllocation);
    }
  };

  const canContinue = budget && tripType;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Skip Button at Top */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-4"
      >
        <Button
          variant="ghost"
          onClick={onContinue}
          disabled={isSubmitting}
          className="text-slate-500 hover:text-primary gap-2"
        >
          {isSubmitting ? 'Saving...' : 'Skip this step'}
          <SkipForward className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Destination Teaser */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <DestinationTeaser
          destination={formData.destination}
          startDate={formData.startDate}
          endDate={formData.endDate}
          travelers={formData.travelers}
        />
      </motion.div>

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-display font-medium text-slate-900 mb-2">
          Tell us about your trip
        </h1>
        <p className="text-slate-600">
          Help us personalize your experience, or skip ahead if you're in a hurry
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Companions Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Who's Coming Along?</h2>
                  <p className="text-sm text-slate-500">Optional: add names or leave anonymous</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              {companions.map((companion, index) => (
                <CompanionCard
                  key={companion.id}
                  companion={companion}
                  index={index}
                  onChange={(updates) => handleCompanionChange(index, updates)}
                />
              ))}
            </div>
          </motion.div>

          {/* Budget Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Trip Budget</h2>
                <p className="text-sm text-slate-500">Per person, per day estimate</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {budgetOptions.map((option) => (
                <BudgetCard
                  key={option.value}
                  option={option}
                  isSelected={budget === option.value}
                  onSelect={() => updateBudget(option.value)}
                />
              ))}
            </div>

            {/* Budget Allocation Sliders */}
            {budget && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
                className="mt-6 pt-6 border-t border-slate-100"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium text-slate-700">Customize your priorities</span>
                  <span className="text-xs text-slate-400">(optional)</span>
                </div>
                
                <div className="space-y-5">
                  {/* Hotel Allocation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-violet-500" />
                        <span className="text-sm font-medium text-slate-600">Hotel</span>
                      </div>
                      <span className="text-sm font-bold text-violet-600">{budgetAllocation.hotel}%</span>
                    </div>
                    <Slider
                      value={[budgetAllocation.hotel]}
                      onValueChange={([value]) => handleAllocationChange('hotel', value)}
                      min={10}
                      max={70}
                      step={5}
                      className="[&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-violet-500 [&_.bg-primary]:bg-violet-500"
                    />
                  </div>

                  {/* Flight Allocation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plane className="w-4 h-4 text-sky-500" />
                        <span className="text-sm font-medium text-slate-600">Flights</span>
                      </div>
                      <span className="text-sm font-bold text-sky-600">{budgetAllocation.flight}%</span>
                    </div>
                    <Slider
                      value={[budgetAllocation.flight]}
                      onValueChange={([value]) => handleAllocationChange('flight', value)}
                      min={10}
                      max={70}
                      step={5}
                      className="[&_[role=slider]]:bg-sky-500 [&_[role=slider]]:border-sky-500 [&_.bg-primary]:bg-sky-500"
                    />
                  </div>

                  {/* Activities Allocation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-medium text-slate-600">Activities</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{budgetAllocation.activities}%</span>
                    </div>
                    <Slider
                      value={[budgetAllocation.activities]}
                      onValueChange={([value]) => handleAllocationChange('activities', value)}
                      min={5}
                      max={50}
                      step={5}
                      className="[&_[role=slider]]:bg-emerald-500 [&_[role=slider]]:border-emerald-500 [&_.bg-primary]:bg-emerald-500"
                    />
                  </div>
                </div>

                {/* Visual Summary */}
                <div className="mt-4 h-3 rounded-full overflow-hidden flex bg-slate-100">
                  <div 
                    className="bg-violet-500 transition-all duration-300" 
                    style={{ width: `${budgetAllocation.hotel}%` }} 
                  />
                  <div 
                    className="bg-sky-500 transition-all duration-300" 
                    style={{ width: `${budgetAllocation.flight}%` }} 
                  />
                  <div 
                    className="bg-emerald-500 transition-all duration-300" 
                    style={{ width: `${budgetAllocation.activities}%` }} 
                  />
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Trip Type Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                <Compass className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Type of Trip</h2>
                <p className="text-sm text-slate-500">We'll tailor suggestions accordingly</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {tripTypeOptions.map((option) => (
                <TripTypeCard
                  key={option.value}
                  option={option}
                  isSelected={tripType === option.value}
                  onSelect={() => updateTripType(option.value)}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Sidebar Summary */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <div className="sticky top-24 space-y-4">
            {/* Quick Summary */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Your Trip</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Compass className="w-4 h-4" />
                  </div>
                  <span className="font-medium truncate">{formData.destination}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <span>{formData.travelers} traveler{formData.travelers > 1 ? 's' : ''}</span>
                </div>
                {budget && (
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <span>{budgetOptions.find(b => b.value === budget)?.label}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-primary">Next up:</span> Choose flights & hotels, or skip straight to your itinerary
              </p>
            </div>

            {/* Skip to Itinerary Option */}
            {onSkipToItinerary && (
              <button
                onClick={onSkipToItinerary}
                disabled={isSubmitting}
                className="w-full p-4 rounded-xl border border-dashed border-slate-300 hover:border-primary/50 hover:bg-primary/5 transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/10 flex items-center justify-center group-hover:from-violet-500/30 group-hover:to-violet-500/20 transition-colors">
                    <SkipForward className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 group-hover:text-primary transition-colors">
                      {isSubmitting ? 'Saving...' : 'Just Build My Itinerary'}
                    </p>
                    <p className="text-xs text-slate-500">Skip flights & hotels, add them later</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex justify-between mt-8 pt-6 border-t border-slate-200"
      >
        <Button variant="outline" onClick={onBack} disabled={isSubmitting} className="h-12 px-6">
          Back
        </Button>
        <Button
          onClick={onContinue}
          disabled={isSubmitting}
          className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white gap-2"
        >
          {isSubmitting ? 'Saving...' : 'Continue to Flights'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </div>
  );
}
