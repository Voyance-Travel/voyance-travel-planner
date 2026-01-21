/**
 * Multi-City Destination Selector
 * 
 * Allows users to add multiple cities with nights allocation for their trip
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Plus, Trash2, GripVertical, MapPin, Calendar, ChevronDown, ChevronUp, Train, Plane, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [showTemplates, setShowTemplates] = useState(destinations.length === 0);
  const [newCity, setNewCity] = useState('');

  const totalNights = calculateTotalNights(destinations);

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
        type: 'train', // Default to train for Europe
        departureDate: '', // Will be calculated
      };
      onTransportsChange([...transports, newTransport]);
    }
  }, [newCity, destinations, transports, onDestinationsChange, onTransportsChange]);

  const handleRemoveCity = useCallback((id: string) => {
    const index = destinations.findIndex(d => d.id === id);
    const newDestinations = destinations.filter(d => d.id !== id);
    
    // Reorder remaining destinations
    const reordered = newDestinations.map((d, i) => ({ ...d, order: i + 1 }));
    onDestinationsChange(reordered);

    // Remove related transports
    const newTransports = transports.filter(t => {
      const removedCity = destinations[index]?.city;
      return t.fromCity !== removedCity && t.toCity !== removedCity;
    });
    onTransportsChange(newTransports);
  }, [destinations, transports, onDestinationsChange, onTransportsChange]);

  const handleNightsChange = useCallback((id: string, nights: number) => {
    const updated = destinations.map(d =>
      d.id === id ? { ...d, nights: Math.max(1, nights) } : d
    );
    onDestinationsChange(updated);
  }, [destinations, onDestinationsChange]);

  const handleReorder = useCallback((reordered: TripDestination[]) => {
    const withOrder = reordered.map((d, i) => ({ ...d, order: i + 1 }));
    onDestinationsChange(withOrder);

    // Rebuild transports based on new order
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
    setShowTemplates(false);
  }, [onDestinationsChange, onTransportsChange]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with toggle for templates */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Your Destinations</h3>
          <p className="text-sm text-muted-foreground">
            {destinations.length === 0
              ? 'Add cities to your trip or choose a popular route'
              : `${destinations.length} cities • ${totalNights} nights total`}
          </p>
        </div>
        {destinations.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-muted-foreground"
          >
            {showTemplates ? 'Hide' : 'Show'} Templates
            {showTemplates ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Popular Route Templates */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {POPULAR_ROUTES.slice(0, 6).map((route) => (
                <Card
                  key={route.id}
                  className="cursor-pointer hover:border-primary transition-colors overflow-hidden"
                  onClick={() => handleSelectTemplate(route)}
                >
                  <div
                    className="h-24 bg-cover bg-center"
                    style={{ backgroundImage: `url(${route.imageUrl})` }}
                  />
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{route.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {route.destinations.map(d => d.city).join(' → ')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {route.totalDays} days
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destination List */}
      {destinations.length > 0 && (
        <Reorder.Group
          axis="y"
          values={destinations}
          onReorder={handleReorder}
          className="space-y-3"
        >
          {destinations.map((destination, index) => (
            <Reorder.Item
              key={destination.id}
              value={destination}
              className="list-none"
            >
              <motion.div layout>
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Drag Handle */}
                      <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                        <GripVertical className="h-5 w-5" />
                      </div>

                      {/* Order Number */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>

                      {/* City Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{destination.city}</span>
                          {destination.country && (
                            <span className="text-sm text-muted-foreground">{destination.country}</span>
                          )}
                        </div>
                      </div>

                      {/* Nights Selector */}
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`nights-${destination.id}`} className="text-sm text-muted-foreground whitespace-nowrap">
                          Nights:
                        </Label>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleNightsChange(destination.id, destination.nights - 1)}
                            disabled={destination.nights <= 1}
                          >
                            -
                          </Button>
                          <Input
                            id={`nights-${destination.id}`}
                            type="number"
                            min={1}
                            max={14}
                            value={destination.nights}
                            onChange={(e) => handleNightsChange(destination.id, parseInt(e.target.value) || 1)}
                            className="w-14 h-8 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleNightsChange(destination.id, destination.nights + 1)}
                            disabled={destination.nights >= 14}
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveCity(destination.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Transport Between Cities */}
                {index < destinations.length - 1 && transports[index] && (
                  <div className="flex items-center justify-center py-2">
                    <div className="flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
                      <Select
                        value={transports[index].type}
                        onValueChange={(value) => handleTransportTypeChange(index, value as InterCityTransport['type'])}
                      >
                        <SelectTrigger className="w-[120px] h-8 border-0 bg-transparent">
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
                          <SelectItem value="bus">Bus</SelectItem>
                          <SelectItem value="car">Car</SelectItem>
                        </SelectContent>
                      </Select>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {destinations[index + 1].city}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {/* Add City Input */}
      <Card className="border-dashed border-2">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <Input
              placeholder="Add a city (e.g., Paris, Tokyo, Barcelona)"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCity()}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-base"
            />
            <Button
              onClick={handleAddCity}
              disabled={!newCity.trim()}
              size="sm"
            >
              Add City
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {destinations.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Duration</p>
              <p className="font-semibold">{totalNights} nights</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-sm text-muted-foreground">Cities</p>
              <p className="font-semibold">{destinations.length}</p>
            </div>
            {transports.length > 0 && (
              <>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-sm text-muted-foreground">Transfers</p>
                  <p className="font-semibold">{transports.length}</p>
                </div>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Route</p>
            <p className="text-sm font-medium">
              {destinations.map(d => d.city).join(' → ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
