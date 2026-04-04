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
            <Label className="text-slate-700">Start Date</Label>
            <Popover open={startOpen} onOpenChange={setStartOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal pl-10 relative",
                    !formData.startDate && "text-muted-foreground",
                    errors.startDate && "border-destructive"
                  )}
                >
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  {formData.startDate
                    ? format(parseLocalDate(formData.startDate), 'PPP')
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.startDate ? parseLocalDate(formData.startDate) : undefined}
                  defaultMonth={formData.startDate ? parseLocalDate(formData.startDate) : todayDate}
                  onSelect={(date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      const newStart = `${y}-${m}-${d}`;
                      if (formData.endDate && newStart > formData.endDate) {
                        updateFormData({ startDate: newStart, endDate: newStart });
                      } else {
                        updateFormData({ startDate: newStart });
                      }
                    }
                    setStartOpen(false);
                  }}
                  disabled={(date) => date < todayDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {errors.startDate && (
              <p className="text-sm text-destructive">{errors.startDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700">End Date</Label>
            <Popover open={endOpen} onOpenChange={setEndOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal pl-10 relative",
                    !formData.endDate && "text-muted-foreground",
                    errors.endDate && "border-destructive"
                  )}
                >
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  {formData.endDate
                    ? format(parseLocalDate(formData.endDate), 'PPP')
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.endDate ? parseLocalDate(formData.endDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      updateFormData({ endDate: `${y}-${m}-${d}` });
                    }
                    setEndOpen(false);
                  }}
                  disabled={(date) => {
                    const minDate = formData.startDate ? parseLocalDate(formData.startDate) : todayDate;
                    return date < minDate;
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {errors.endDate && (
              <p className="text-sm text-destructive">{errors.endDate}</p>
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
