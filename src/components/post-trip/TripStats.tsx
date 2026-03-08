/**
 * Trip Stats Component
 * Displays key statistics from the trip
 */

import { useEffect, useState } from 'react';
import { 
  Utensils, MapPin, Camera, Footprints, 
  Building2, Train
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TripStatsProps {
  tripId: string;
  tripDays: number;
}

interface Stats {
  meals: number;
  activities: number;
  neighborhoods: number;
  photos: number;
}

export function TripStats({ tripId, tripDays }: TripStatsProps) {
  const [stats, setStats] = useState<Stats>({
    meals: 0,
    activities: 0,
    neighborhoods: 0,
    photos: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      // Get activities count
      const { data: activities } = await supabase
        .from('trip_activities')
        .select('id, title')
        .eq('trip_id', tripId);

      // Get photos count
      const { data: photos } = await supabase
        .from('trip_photos')
        .select('id')
        .eq('trip_id', tripId);

      const activityCount = activities?.length || 0;

      setStats({
        meals: Math.ceil(tripDays * 2), // Estimate meals
        activities: activityCount,
        neighborhoods: Math.ceil(activityCount / 3) || Math.ceil(tripDays / 2),
        photos: photos?.length || 0,
      });
    }

    if (tripId) {
      fetchStats();
    }
  }, [tripId, tripDays]);

  // Estimate steps based on activities
  const estimatedSteps = stats.activities * 3500 + (tripDays * 2000);

  const statItems = [
    { icon: Utensils, value: stats.meals, label: 'Meals', color: 'text-orange-500' },
    { icon: MapPin, value: stats.neighborhoods, label: 'Neighborhoods', color: 'text-blue-500' },
    { icon: Camera, value: stats.photos, label: 'Photos', color: 'text-pink-500', show: stats.photos > 0 },
    { icon: Footprints, value: `${Math.round(estimatedSteps / 1000)}k`, label: 'Est. Walking', color: 'text-teal-500' },
  ].filter(item => item.show !== false);

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        By The Numbers
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((item, idx) => (
          <div key={idx} className="text-center">
            <item.icon className={`w-5 h-5 mx-auto mb-1.5 ${item.color}`} />
            <p className="text-xl font-semibold">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
