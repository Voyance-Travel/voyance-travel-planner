import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, CalendarIcon, Users, Plane } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getLocalToday, parseLocalDate } from '@/utils/dateUtils';

interface TripSetupProps {
  formData: {
    destination: string;
    departureCity: string;
    startDate: string;
    endDate: string;
    travelers: number;
    name?: string;
  };
  updateFormData: (data: Partial<TripSetupProps['formData']>) => void;
  onContinue: () => void;
}

export default function TripSetup({ formData, updateFormData, onContinue }: TripSetupProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const today = getLocalToday();
  const todayDate = parseLocalDate(today);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.destination) newErrors.destination = 'Please enter a destination';
    if (!formData.departureCity) newErrors.departureCity = 'Please enter a departure city';
    if (!formData.startDate) {
      newErrors.startDate = 'Please select a start date';
    } else if (formData.startDate < today) {
      newErrors.startDate = 'Start date cannot be in the past';
    }
    if (!formData.endDate) {
      newErrors.endDate = 'Please select an end date';
    } else if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) {
      onContinue();
    } else {
      toast.error('Please fill in all required fields');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-medium text-slate-900 mb-2">
          Where are you going?
        </h1>
        <p className="text-slate-600">
          Let's start planning your perfect trip
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
        {/* Trip Name (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-700">
            Trip Name <span className="text-slate-400">(optional)</span>
          </Label>
          <Input
            id="name"
            placeholder="Summer Adventure 2026"
            value={formData.name || ''}
            onChange={(e) => updateFormData({ name: e.target.value })}
            className="h-12"
          />
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <Label htmlFor="destination" className="text-slate-700">
            Destination
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              id="destination"
              placeholder="Paris, France"
              value={formData.destination}
              onChange={(e) => updateFormData({ destination: e.target.value })}
              className={`pl-10 h-12 ${errors.destination ? 'border-destructive' : ''}`}
            />
          </div>
          {errors.destination && (
            <p className="text-sm text-red-500">{errors.destination}</p>
          )}
        </div>

        {/* Departure City */}
        <div className="space-y-2">
          <Label htmlFor="departureCity" className="text-slate-700">
            Departing From
          </Label>
          <div className="relative">
            <Plane className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              id="departureCity"
              placeholder="New York, NY"
              value={formData.departureCity}
              onChange={(e) => updateFormData({ departureCity: e.target.value })}
              className={`pl-10 h-12 ${errors.departureCity ? 'border-destructive' : ''}`}
            />
          </div>
          {errors.departureCity && (
            <p className="text-sm text-red-500">{errors.departureCity}</p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-slate-700">
              Start Date
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="startDate"
                type="date"
                min={today}
                value={formData.startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  if (newStart && formData.endDate && newStart > formData.endDate) {
                    updateFormData({ startDate: newStart, endDate: newStart });
                  } else {
                    updateFormData({ startDate: newStart });
                  }
                }}
                className={`pl-10 h-12 ${errors.startDate ? 'border-destructive' : ''}`}
              />
            </div>
            {errors.startDate && (
              <p className="text-sm text-red-500">{errors.startDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-slate-700">
              End Date
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="endDate"
                type="date"
                min={formData.startDate || today}
                value={formData.endDate}
                onChange={(e) => updateFormData({ endDate: e.target.value })}
                className={`pl-10 h-12 ${errors.endDate ? 'border-destructive' : ''}`}
              />
            </div>
            {errors.endDate && (
              <p className="text-sm text-red-500">{errors.endDate}</p>
            )}
          </div>
        </div>

        {/* Travelers */}
        <div className="space-y-2">
          <Label htmlFor="travelers" className="text-slate-700">
            Number of Travelers
          </Label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              id="travelers"
              type="number"
              min={1}
              max={20}
              value={formData.travelers}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                updateFormData({ travelers: Math.max(1, Math.min(20, val)) });
              }}
              className="pl-10 h-12"
            />
          </div>
        </div>

        {/* Continue Button */}
        <Button
          onClick={handleContinue}
          className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white"
        >
          Continue to Flights
        </Button>
      </div>
    </motion.div>
  );
}
