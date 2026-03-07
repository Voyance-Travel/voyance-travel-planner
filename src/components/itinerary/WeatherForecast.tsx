/**
 * Weather Forecast Component
 * 
 * Displays real weather forecast data for each day of the trip.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sun, Cloud, CloudRain, Snowflake, CloudSun, Wind, 
  Droplets, Thermometer, RefreshCw, CloudLightning, CloudFog
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';

interface WeatherDay {
  date: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  precipitation: number;
}

interface WeatherData {
  destination: string;
  current: {
    temp: number;
    feelsLike: number;
    condition: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    precipitation: number;
  };
  forecast: WeatherDay[];
  source: 'weatherkit' | 'open-meteo' | 'fallback';
}

interface WeatherForecastProps {
  destination: string;
  startDate: string;
  endDate: string;
  tripDays: number;
}

const getWeatherIcon = (condition: string, size: 'sm' | 'md' | 'lg' = 'md') => {
  const sizeClass = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-6 w-6';
  const c = condition.toLowerCase();

  // Keep icons on-brand (design tokens only)
  const iconClass = cn(sizeClass, 'text-primary');

  if (c.includes('sunny') || c.includes('clear')) return <Sun className={iconClass} />;
  if (c.includes('thunder') || c.includes('storm')) return <CloudLightning className={iconClass} />;
  if (c.includes('rain') || c.includes('shower')) return <CloudRain className={iconClass} />;
  if (c.includes('snow')) return <Snowflake className={iconClass} />;
  if (c.includes('fog') || c.includes('mist')) return <CloudFog className={iconClass} />;
  if (c.includes('partly') || c.includes('partial')) return <CloudSun className={iconClass} />;
  if (c.includes('cloud') || c.includes('overcast')) return <Cloud className={iconClass} />;
  return <CloudSun className={iconClass} />;
};

const getGradientForCondition = (_condition: string): string => {
  // Subtle, neutral gradient (avoid rainbowy weather theming)
  return 'from-primary/10 via-background/60 to-accent/10';
};

export function WeatherForecast({ destination, startDate, endDate, tripDays }: WeatherForecastProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Normalize destination (remove IATA codes)
      const cleanDestination = destination
        .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
        .trim();
      
      const { data, error: fetchError } = await supabase.functions.invoke('weather', {
        body: {
          destination: cleanDestination,
          startDate,
          days: tripDays,
        },
      });
      
      if (fetchError) throw fetchError;
      
      if (data?.weather) {
        setWeather(data.weather);
      } else {
        throw new Error('No weather data returned');
      }
    } catch (err) {
      console.error('[WeatherForecast] Error:', err);
      setError('Unable to load weather data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [destination, startDate, tripDays]);

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
            {Array.from({ length: Math.min(tripDays, 7) }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center py-6">
            <CloudFog className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-3">{error || 'Weather data unavailable'}</p>
            <Button variant="outline" size="sm" onClick={fetchWeather} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentCondition = weather.current.condition;
  const gradient = getGradientForCondition(currentCondition);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn("overflow-hidden border border-border")}> 
        <CardContent className={cn("p-0 bg-gradient-to-br", gradient)}>
          {/* Current Weather Header */}
          <div className="p-6 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-background/80 shadow-lg">
                  {getWeatherIcon(currentCondition, 'lg')}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-serif font-bold">{weather.current.temp}°</span>
                    <span className="text-lg text-muted-foreground">F</span>
                  </div>
                  <p className="text-sm font-medium text-foreground/80">{currentCondition}</p>
                  <p className="text-xs text-muted-foreground">Feels like {weather.current.feelsLike}°</p>
                </div>
              </div>
              
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground justify-end">
                  <Droplets className="h-4 w-4" />
                  <span>{weather.current.humidity}% humidity</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground justify-end">
                  <Wind className="h-4 w-4" />
                  <span>{weather.current.windSpeed} mph</span>
                </div>
                {weather.source === 'weatherkit' && (
                  <Badge variant="outline" className="text-xs mt-2">
                     Apple Weather
                  </Badge>
                )}
                {weather.source === 'fallback' && (
                  <Badge variant="outline" className="text-xs mt-2">
                    Estimated
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Forecast Grid */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Your Trip Forecast
              </p>
              {weather.source === 'fallback' && (
                <Badge variant="outline" className="text-xs">
                  Seasonal Estimates
                </Badge>
              )}
            </div>
            <div className={cn(
              "grid gap-2",
              tripDays <= 4 ? "grid-cols-4" : tripDays <= 5 ? "grid-cols-5" : tripDays <= 7 ? "grid-cols-7" : "grid-cols-8"
            )}>
              {weather.forecast.slice(0, Math.min(tripDays, 8)).map((day, idx) => {
                const dayDate = parseLocalDate(day.date);
                const todayDate = new Date();
                const isTodayActual = format(dayDate, 'yyyy-MM-dd') === format(todayDate, 'yyyy-MM-dd');
                const dayNumber = idx + 1;
                
                return (
                  <motion.div
                    key={day.date}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "rounded-xl p-3 text-center transition-all",
                      isTodayActual 
                        ? "bg-primary/10 border-2 border-primary/30 shadow-md" 
                        : "bg-background/60 hover:bg-background/80"
                    )}
                  >
                    <p className={cn(
                      "text-[10px] font-medium text-muted-foreground mb-0.5"
                    )}>
                      Day {dayNumber}
                    </p>
                    <p className={cn(
                      "text-xs font-medium mb-2",
                      isTodayActual ? "text-primary" : "text-foreground"
                    )}>
                      {format(dayDate, 'MMM d')}
                    </p>
                    <div className="flex justify-center mb-2">
                      {getWeatherIcon(day.condition, 'sm')}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold">{day.high}°</p>
                      <p className="text-xs text-muted-foreground">{day.low}°</p>
                    </div>
                    {day.precipitation > 20 && (
                      <div className="flex items-center justify-center gap-0.5 mt-1.5 text-muted-foreground">
                        <Droplets className="h-3 w-3" />
                        <span className="text-xs">{day.precipitation}%</span>
                      </div>
                    )}
                    {isTodayActual && (
                      <Badge variant="secondary" className="text-[9px] mt-1 px-1.5">
                        Today
                      </Badge>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Packing Suggestion */}
          <div className="px-6 pb-4">
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-1">💡 Packing Tip</p>
              <p className="text-sm text-foreground/80">
                {getPackingSuggestion(weather)}
              </p>
            </div>
          </div>

          {/* Apple Weather Attribution (required by Apple's terms) */}
          {weather.source === 'weatherkit' && (
            <div className="px-6 pb-3">
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Weather data provided by  Apple Weather
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function getPackingSuggestion(weather: WeatherData): string {
  const avgHigh = weather.forecast.reduce((sum, d) => sum + d.high, 0) / weather.forecast.length;
  const hasRain = weather.forecast.some(d => d.condition.toLowerCase().includes('rain') || d.precipitation > 40);
  // Thresholds in Fahrenheit: 50°F = cold, 82°F = hot, 77°F = sunny
  const hasCold = weather.forecast.some(d => d.low < 50);
  const hasHot = weather.forecast.some(d => d.high > 82);
  
  const tips: string[] = [];
  
  if (hasRain) tips.push('Pack a compact umbrella or rain jacket');
  if (hasCold && hasHot) tips.push('Layer up - temperatures will vary significantly');
  else if (hasCold) tips.push('Bring warm layers for cooler evenings');
  else if (hasHot) tips.push('Light, breathable clothing recommended');
  
  if (avgHigh > 77) tips.push('Don\'t forget sunscreen and a hat');
  
  if (tips.length === 0) {
    return 'Comfortable casual wear should work perfectly for your trip!';
  }
  
  return tips.join('. ') + '.';
}

export default WeatherForecast;
