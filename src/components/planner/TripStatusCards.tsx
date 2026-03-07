import { Calendar, MapPin, Users, Plane, DollarSign, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';

interface TripStatusCardsProps {
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  departureCity?: string;
  budget?: number;
  currency?: string;
  className?: string;
}

export default function TripStatusCards({
  destination,
  startDate,
  endDate,
  travelers,
  departureCity,
  budget,
  currency = 'USD',
  className = ''
}: TripStatusCardsProps) {
  const tripDays = startDate && endDate 
    ? differenceInDays(parseLocalDate(endDate), parseLocalDate(startDate))
    : null;

  const cards = [
    {
      icon: MapPin,
      label: 'Destination',
      value: destination || 'Not selected',
      color: 'text-primary',
    },
    {
      icon: Calendar,
      label: 'Dates',
      value: startDate && endDate 
        ? `${format(parseLocalDate(startDate), 'MMM d')} – ${format(parseLocalDate(endDate), 'MMM d')}`
        : 'Not set',
      subValue: tripDays ? `${tripDays} days` : undefined,
      color: 'text-blue-500',
    },
    {
      icon: Users,
      label: 'Travelers',
      value: travelers ? `${travelers} ${travelers === 1 ? 'person' : 'people'}` : 'Not set',
      color: 'text-violet-500',
    },
    {
      icon: Plane,
      label: 'Departure',
      value: departureCity || 'Not set',
      color: 'text-emerald-500',
    },
    {
      icon: DollarSign,
      label: 'Budget',
      value: budget 
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(budget)
        : 'Not set',
      color: 'text-amber-500',
    },
  ].filter(card => card.value !== 'Not set' && card.value !== 'Not selected');

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 ${className}`}>
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div 
            key={index}
            className="bg-card border border-border rounded-xl p-4 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-sm font-medium text-foreground">{card.value}</p>
            {card.subValue && (
              <p className="text-xs text-muted-foreground mt-0.5">{card.subValue}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
