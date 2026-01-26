/**
 * LocalEventsCard Component
 * 
 * Displays local events, festivals, and happenings during the trip dates.
 * Uses AI-powered search to find current events.
 */

import { useState, useEffect } from 'react';
import { Calendar, MapPin, Ticket, ExternalLink, Loader2, Sparkles, PartyPopper } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { lookupLocalEvents, LocalEvent } from '@/services/enrichmentService';
import { cn } from '@/lib/utils';

interface LocalEventsCardProps {
  destination: string;
  startDate: string;
  endDate: string;
  interests?: string[];
  className?: string;
}

const eventTypeColors: Record<string, string> = {
  festival: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  concert: 'bg-pink-500/10 text-pink-700 dark:text-pink-300',
  exhibition: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  sports: 'bg-green-500/10 text-green-700 dark:text-green-300',
  cultural: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  market: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  other: 'bg-gray-500/10 text-gray-700 dark:text-gray-300',
};

const eventTypeIcons: Record<string, string> = {
  festival: '🎉',
  concert: '🎵',
  exhibition: '🎨',
  sports: '⚽',
  cultural: '🎭',
  market: '🛍️',
  other: '📅',
};

export function LocalEventsCard({ 
  destination, 
  startDate, 
  endDate, 
  interests,
  className 
}: LocalEventsCardProps) {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchEvents() {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await lookupLocalEvents(destination, startDate, endDate, interests);
        
        if (!cancelled) {
          if (result.success) {
            setEvents(result.events);
          } else {
            setError(result.error || 'Failed to load events');
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching local events:', err);
        if (!cancelled) {
          setError('Failed to load events');
          setIsLoading(false);
        }
      }
    }
    
    fetchEvents();
    
    return () => {
      cancelled = true;
    };
  }, [destination, startDate, endDate, interests]);

  if (isLoading) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Finding local events...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || events.length === 0) {
    return null; // Don't show card if no events
  }

  const displayedEvents = showAll ? events : events.slice(0, 3);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PartyPopper className="h-5 w-5 text-primary" />
          What's Happening
          <Badge variant="secondary" className="ml-auto text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-powered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayedEvents.map((event, index) => (
          <div 
            key={index} 
            className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{eventTypeIcons[event.type] || '📅'}</span>
                <span className="font-medium text-sm">{event.name}</span>
              </div>
              <Badge className={cn("text-xs shrink-0", eventTypeColors[event.type])}>
                {event.type}
              </Badge>
            </div>
            
            <p className="text-xs text-muted-foreground line-clamp-2">
              {event.description}
            </p>
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {event.dates}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {typeof event.location === 'string' 
                  ? event.location 
                  : (event.location as { name?: string; address?: string })?.name || 
                    (event.location as { name?: string; address?: string })?.address || ''}
              </span>
              {event.isFree ? (
                <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">
                  Free
                </Badge>
              ) : event.priceRange && (
                <span className="text-xs">{event.priceRange}</span>
              )}
            </div>
            
            {event.ticketUrl && (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <Ticket className="h-3 w-3" />
                Get Tickets
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
        
        {events.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="w-full text-xs"
          >
            {showAll ? 'Show less' : `Show ${events.length - 3} more events`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
