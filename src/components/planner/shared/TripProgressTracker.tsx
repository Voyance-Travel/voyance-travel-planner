import { Check, Calendar, Plane, Hotel, DollarSign, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TripProgressTrackerProps {
  destination: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  budget?: string;
  flightSelected?: boolean;
  hotelSelected?: boolean;
  currentStep: 'context' | 'flights' | 'hotels' | 'booking';
}

const budgetLabels: Record<string, string> = {
  budget: 'Budget-Friendly',
  moderate: 'Moderate',
  premium: 'Premium',
  luxury: 'Luxury',
};

export default function TripProgressTracker({
  destination,
  startDate,
  endDate,
  travelers,
  budget,
  flightSelected,
  hotelSelected,
  currentStep,
}: TripProgressTrackerProps) {
  const formatDates = () => {
    if (!startDate || !endDate) return null;
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return {
        range: `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`,
        nights,
      };
    } catch {
      return null;
    }
  };

  const dateInfo = formatDates();

  const items = [
    {
      icon: MapPin,
      label: 'Destination',
      value: destination,
      completed: true,
    },
    {
      icon: Calendar,
      label: 'Dates',
      value: dateInfo ? `${dateInfo.range} (${dateInfo.nights} nights)` : 'Not set',
      completed: !!dateInfo,
    },
    {
      icon: DollarSign,
      label: 'Budget',
      value: budget ? budgetLabels[budget] || budget : 'Not set',
      completed: !!budget,
      active: currentStep === 'context',
    },
    {
      icon: Plane,
      label: 'Flight',
      value: flightSelected ? 'Selected' : 'Choose flights',
      completed: !!flightSelected,
      active: currentStep === 'flights',
    },
    {
      icon: Hotel,
      label: 'Hotel',
      value: hotelSelected ? 'Selected' : 'Choose hotel',
      completed: !!hotelSelected,
      active: currentStep === 'hotels',
    },
  ];

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Trip Progress
      </h3>
      
      <div className="space-y-3">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.active;
          const isCompleted = item.completed;
          
          return (
            <div 
              key={index}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg transition-colors',
                isActive && 'bg-primary/5 border border-primary/20',
                !isActive && !isCompleted && 'opacity-50'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                isCompleted ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
              )}>
                {isCompleted && !isActive ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className={cn(
                  'text-sm font-medium truncate',
                  isCompleted ? 'text-slate-900' : 'text-slate-400'
                )}>
                  {item.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
