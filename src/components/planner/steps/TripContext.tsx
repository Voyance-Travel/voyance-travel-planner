import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, User, DollarSign, Compass, Heart, Briefcase, Baby, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Companion {
  id: string;
  name: string;
  type: 'adult' | 'child';
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
  tripType: string;
  updateCompanions: (companions: Companion[]) => void;
  updateBudget: (budget: string) => void;
  updateTripType: (tripType: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

const budgetOptions = [
  { value: 'budget', label: 'Budget-Friendly', description: 'Under $150/day', icon: <DollarSign className="w-5 h-5" /> },
  { value: 'moderate', label: 'Moderate', description: '$150-300/day', icon: <><DollarSign className="w-5 h-5" /><DollarSign className="w-5 h-5 -ml-3" /></> },
  { value: 'premium', label: 'Premium', description: '$300-500/day', icon: <><DollarSign className="w-5 h-5" /><DollarSign className="w-5 h-5 -ml-3" /><DollarSign className="w-5 h-5 -ml-3" /></> },
  { value: 'luxury', label: 'Luxury', description: '$500+/day', icon: <Heart className="w-5 h-5" /> },
];

const tripTypeOptions = [
  { value: 'leisure', label: 'Leisure', description: 'Relaxation & exploration', icon: <Compass className="w-5 h-5" /> },
  { value: 'romantic', label: 'Romantic', description: 'Couple getaway', icon: <Heart className="w-5 h-5" /> },
  { value: 'family', label: 'Family', description: 'All ages adventure', icon: <Baby className="w-5 h-5" /> },
  { value: 'business', label: 'Business', description: 'Work & meetings', icon: <Briefcase className="w-5 h-5" /> },
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
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4"
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        {companion.name ? (
          <span className="text-lg font-semibold text-primary">
            {companion.name.charAt(0).toUpperCase()}
          </span>
        ) : (
          <UserCircle className="w-6 h-6 text-primary" />
        )}
      </div>
      <div className="flex-1">
        <Label className="text-xs text-slate-500 mb-1 block">
          Traveler {index + 1} {index === 0 ? '(You)' : ''}
        </Label>
        <Input
          placeholder={index === 0 ? "Your name (optional)" : "Name (optional)"}
          value={companion.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-10"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ type: 'adult' })}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            companion.type === 'adult' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          Adult
        </button>
        <button
          type="button"
          onClick={() => onChange({ type: 'child' })}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            companion.type === 'child' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          Child
        </button>
      </div>
    </motion.div>
  );
}

function OptionCard({
  value,
  label,
  description,
  icon,
  isSelected,
  onSelect,
}: {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'p-4 rounded-xl border-2 text-left transition-all w-full',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          isSelected ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-slate-600'
        )}>
          {icon}
        </div>
        <div>
          <p className="font-medium text-slate-900">{label}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default function TripContext({
  formData,
  companions,
  budget,
  tripType,
  updateCompanions,
  updateBudget,
  updateTripType,
  onContinue,
  onBack,
}: TripContextProps) {
  const handleCompanionChange = (index: number, updates: Partial<Companion>) => {
    const newCompanions = [...companions];
    newCompanions[index] = { ...newCompanions[index], ...updates };
    updateCompanions(newCompanions);
  };

  const canContinue = budget && tripType;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      {/* Trip Summary Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Compass className="w-4 h-4" />
          {formData.destination}
        </div>
        <h1 className="text-3xl font-display font-medium text-slate-900 mb-2">
          Who's coming along?
        </h1>
        <p className="text-slate-600">
          {formData.startDate} → {formData.endDate} • {formData.travelers} traveler{formData.travelers > 1 ? 's' : ''}
        </p>
      </div>

      {/* Companions Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-medium text-slate-900">Your Travel Party</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Add names to personalize the experience, or leave anonymous. We'll remember everyone's preferences.
        </p>
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
      </div>

      {/* Budget Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-medium text-slate-900">Trip Budget</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {budgetOptions.map((option) => (
            <OptionCard
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              icon={option.icon}
              isSelected={budget === option.value}
              onSelect={() => updateBudget(option.value)}
            />
          ))}
        </div>
      </div>

      {/* Trip Type Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Compass className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-medium text-slate-900">Type of Trip</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tripTypeOptions.map((option) => (
            <OptionCard
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              icon={option.icon}
              isSelected={tripType === option.value}
              onSelect={() => updateTripType(option.value)}
            />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-slate-200">
        <Button variant="outline" onClick={onBack} className="h-12 px-6">
          Back
        </Button>
        <Button
          onClick={onContinue}
          disabled={!canContinue}
          className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white"
        >
          Continue to Flights
        </Button>
      </div>
    </motion.div>
  );
}
