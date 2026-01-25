/**
 * Multi-City Destination Selector
 * 
 * Polished component for adding multiple cities with nights allocation
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Plus, Trash2, GripVertical, MapPin, Train, Plane, ArrowDown, Sparkles, Globe, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TripDestination, InterCityTransport, POPULAR_ROUTES, PopularRoute, calculateTotalNights } from '@/types/multiCity';

interface MultiCitySelectorProps {
  destinations: TripDestination[];
  transports: InterCityTransport[];
  onDestinationsChange: (destinations: TripDestination[]) => void;
  onTransportsChange: (transports: InterCityTransport[]) => void;
  startDate?: string;
  className?: string;
}

export default function MultiCitySelector({
  destinations,
  transports,
  onDestinationsChange,
  onTransportsChange,
  startDate,
  className,
}: MultiCitySelectorProps) {
  const [newCity, setNewCity] = useState('');
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const totalNights = calculateTotalNights(destinations);
  const displayedRoutes = showAllTemplates ? POPULAR_ROUTES : POPULAR_ROUTES.slice(0, 3);

  const handleAddCity = useCallback(() => {
    if (!newCity.trim()) return;

    const newDestination: TripDestination = {
      id: crypto.randomUUID(),
      city: newCity.trim(),
      nights: 3,
      order: destinations.length + 1,
    };

    onDestinationsChange([...destinations, newDestination]);
    setNewCity('');

    // Add transport between previous city and new city
    if (destinations.length > 0) {
      const prevCity = destinations[destinations.length - 1];
      const newTransport: InterCityTransport = {
        id: crypto.randomUUID(),
        fromCity: prevCity.city,
        toCity: newCity.trim(),
        type: 'train',
        departureDate: '',
      };
      onTransportsChange([...transports, newTransport]);
    }
  }, [newCity, destinations, transports, onDestinationsChange, onTransportsChange]);

  const handleRemoveCity = useCallback((id: string) => {
    const index = destinations.findIndex(d => d.id === id);
    const newDestinations = destinations.filter(d => d.id !== id);
    
    const reordered = newDestinations.map((d, i) => ({ ...d, order: i + 1 }));
    onDestinationsChange(reordered);

    const newTransports = transports.filter(t => {
      const removedCity = destinations[index]?.city;
      return t.fromCity !== removedCity && t.toCity !== removedCity;
    });
    onTransportsChange(newTransports);
  }, [destinations, transports, onDestinationsChange, onTransportsChange]);

  const handleNightsChange = useCallback((id: string, nights: number) => {
    const updated = destinations.map(d =>
      d.id === id ? { ...d, nights: Math.max(1, Math.min(14, nights)) } : d
    );
    onDestinationsChange(updated);
  }, [destinations, onDestinationsChange]);

  const handleReorder = useCallback((reordered: TripDestination[]) => {
    const withOrder = reordered.map((d, i) => ({ ...d, order: i + 1 }));
    onDestinationsChange(withOrder);

    const newTransports: InterCityTransport[] = [];
    for (let i = 0; i < withOrder.length - 1; i++) {
      const existing = transports.find(
        t => t.fromCity === withOrder[i].city && t.toCity === withOrder[i + 1].city
      );
      newTransports.push(existing || {
        id: crypto.randomUUID(),
        fromCity: withOrder[i].city,
        toCity: withOrder[i + 1].city,
        type: 'train',
        departureDate: '',
      });
    }
    onTransportsChange(newTransports);
  }, [transports, onDestinationsChange, onTransportsChange]);

  const handleTransportTypeChange = useCallback((index: number, type: InterCityTransport['type']) => {
    const updated = transports.map((t, i) =>
      i === index ? { ...t, type } : t
    );
    onTransportsChange(updated);
  }, [transports, onTransportsChange]);

  const handleSelectTemplate = useCallback((route: PopularRoute) => {
    const newDestinations: TripDestination[] = route.destinations.map((d, i) => ({
      id: crypto.randomUUID(),
      city: d.city,
      country: d.country,
      nights: d.recommendedNights,
      order: i + 1,
    }));

    const newTransports: InterCityTransport[] = [];
    for (let i = 0; i < newDestinations.length - 1; i++) {
      newTransports.push({
        id: crypto.randomUUID(),
        fromCity: newDestinations[i].city,
        toCity: newDestinations[i + 1].city,
        type: route.region === 'Europe' ? 'train' : 'flight',
        departureDate: '',
      });
    }

    onDestinationsChange(newDestinations);
    onTransportsChange(newTransports);
  }, [onDestinationsChange, onTransportsChange]);

  return (
    <div className={cn('space-y-8', className)}>
      {/* Add City - Primary Action */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground font-medium">
            Add Your Destinations
          </span>
        </div>
        
        <div className="relative">
          <Input
            placeholder="Search cities (e.g., Paris, Tokyo, Barcelona...)"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCity()}
            className="h-14 pl-12 pr-24 text-base border-2 border-dashed border-primary/30 bg-primary/5 focus:border-primary focus:bg-background rounded-xl"
          />
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/60" />
          <Button
            onClick={handleAddCity}
            disabled={!newCity.trim()}
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Current Route */}
      {destinations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground font-medium">
                Your Route
              </span>
              <Badge variant="secondary" className="text-xs">
                {destinations.length} {destinations.length === 1 ? 'city' : 'cities'} • {totalNights} nights
              </Badge>
            </div>
          </div>

          <Reorder.Group
            axis="y"
            values={destinations}
            onReorder={handleReorder}
            className="space-y-0"
          >
            {destinations.map((destination, index) => (
              <Reorder.Item
                key={destination.id}
                value={destination}
                className="list-none"
              >
                <motion.div layout>
                  {/* City Card */}
                  <div className="flex items-stretch gap-3">
                    {/* Timeline */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                        index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      {index < destinations.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border my-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <Card className="border-border hover:border-primary/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            {/* Drag Handle */}
                            <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                            </div>

                            {/* City Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{destination.city}</span>
                                {destination.country && (
                                  <span className="text-sm text-muted-foreground">{destination.country}</span>
                                )}
                              </div>
                            </div>

                            {/* Nights Selector - Pill Style */}
                            <div className="flex items-center bg-muted rounded-full">
                              <button
                                onClick={() => handleNightsChange(destination.id, destination.nights - 1)}
                                disabled={destination.nights <= 1}
                                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                              >
                                −
                              </button>
                              <span className="w-16 text-center text-sm font-medium">
                                {destination.nights} {destination.nights === 1 ? 'night' : 'nights'}
                              </span>
                              <button
                                onClick={() => handleNightsChange(destination.id, destination.nights + 1)}
                                disabled={destination.nights >= 14}
                                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                              >
                                +
                              </button>
                            </div>

                            {/* Remove */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveCity(destination.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Transport Selector */}
                      {index < destinations.length - 1 && transports[index] && (
                        <div className="flex items-center gap-2 mt-2 ml-4">
                          <Select
                            value={transports[index].type}
                            onValueChange={(value) => handleTransportTypeChange(index, value as InterCityTransport['type'])}
                          >
                            <SelectTrigger className="w-auto h-7 text-xs border-0 bg-muted/50 gap-1 rounded-full px-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="train">
                                <span className="flex items-center gap-2">
                                  <Train className="h-3 w-3" /> Train
                                </span>
                              </SelectItem>
                              <SelectItem value="flight">
                                <span className="flex items-center gap-2">
                                  <Plane className="h-3 w-3" /> Flight
                                </span>
                              </SelectItem>
                              <SelectItem value="bus">🚌 Bus</SelectItem>
                              <SelectItem value="car">🚗 Car</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">
                            to {destinations[index + 1].city}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </motion.div>
      )}

      {/* Popular Routes - Inspiration Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground font-medium">
            {destinations.length > 0 ? 'Or Start Fresh with a Template' : 'Popular Routes for Inspiration'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence mode="popLayout">
            {displayedRoutes.map((route, index) => (
              <motion.div
                key={route.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="cursor-pointer group hover:border-primary/50 transition-all overflow-hidden"
                  onClick={() => handleSelectTemplate(route)}
                >
                  <div className="flex items-stretch">
                    {/* Image */}
                    <div
                      className="w-24 md:w-32 bg-cover bg-center shrink-0"
                      style={{ backgroundImage: `url(${route.imageUrl})` }}
                    />
                    
                    {/* Content */}
                    <CardContent className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold group-hover:text-primary transition-colors">
                              {route.name}
                            </h4>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {route.region}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                            {route.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {route.destinations.map(d => d.city).join(' → ')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {route.totalDays} days
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="mt-2 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Use Template
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {POPULAR_ROUTES.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllTemplates(!showAllTemplates)}
            className="w-full text-muted-foreground"
          >
            {showAllTemplates ? 'Show Less' : `Show ${POPULAR_ROUTES.length - 3} More Routes`}
            <ArrowDown className={cn(
              "ml-1 h-4 w-4 transition-transform",
              showAllTemplates && "rotate-180"
            )} />
          </Button>
        )}
      </div>

      {/* Journey Summary */}
      {destinations.length >= 2 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your Journey</p>
              <p className="font-medium">
                {destinations.map(d => d.city).join(' → ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-serif font-semibold text-primary">{totalNights}</p>
              <p className="text-xs text-muted-foreground">total nights</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
