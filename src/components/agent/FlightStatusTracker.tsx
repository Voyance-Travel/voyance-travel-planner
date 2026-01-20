import { useState, useEffect } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { 
  Plane, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  RefreshCw,
  XCircle,
  ArrowRight,
  Terminal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { BookingSegment } from '@/services/agencyCRM';

interface FlightStatus {
  carrierCode: string;
  flightNumber: string;
  scheduledDate: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  departureGate?: string;
  arrivalGate?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  flightStatus: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'delayed' | 'unknown';
  delayMinutes?: number;
  lastUpdated: string;
}

interface FlightStatusTrackerProps {
  segments: BookingSegment[];
  compact?: boolean;
}

const STATUS_CONFIG = {
  scheduled: { label: 'On Time', color: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  active: { label: 'In Flight', color: 'bg-blue-500/10 text-blue-600', icon: Plane },
  landed: { label: 'Landed', color: 'bg-gray-500/10 text-gray-600', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-600', icon: XCircle },
  diverted: { label: 'Diverted', color: 'bg-orange-500/10 text-orange-600', icon: AlertTriangle },
  delayed: { label: 'Delayed', color: 'bg-amber-500/10 text-amber-600', icon: AlertTriangle },
  unknown: { label: 'Unknown', color: 'bg-gray-500/10 text-gray-600', icon: Clock },
};

export default function FlightStatusTracker({ segments, compact = false }: FlightStatusTrackerProps) {
  const [statuses, setStatuses] = useState<Record<string, FlightStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filter to only flight segments with flight numbers
  const flightSegments = segments.filter(
    s => s.segment_type === 'flight' && s.flight_number && s.start_date
  );

  const parseFlightNumber = (flightNum: string): { carrier: string; number: string } | null => {
    // Match patterns like "UA 123", "UA123", "United 123"
    const match = flightNum.trim().match(/^([A-Z]{2})\s*(\d+)$/i);
    if (match) {
      return { carrier: match[1].toUpperCase(), number: match[2] };
    }
    
    // Try airline name + number
    const airlines: Record<string, string> = {
      'united': 'UA', 'delta': 'DL', 'american': 'AA', 'southwest': 'WN',
      'jetblue': 'B6', 'alaska': 'AS', 'spirit': 'NK', 'frontier': 'F9',
      'british': 'BA', 'lufthansa': 'LH', 'emirates': 'EK', 'air france': 'AF',
    };
    
    for (const [name, code] of Object.entries(airlines)) {
      if (flightNum.toLowerCase().startsWith(name)) {
        const numPart = flightNum.replace(new RegExp(`^${name}\\s*`, 'i'), '');
        if (/^\d+$/.test(numPart)) {
          return { carrier: code, number: numPart };
        }
      }
    }
    
    return null;
  };

  const fetchFlightStatus = async (segment: BookingSegment) => {
    if (!segment.flight_number || !segment.start_date) return;
    
    const parsed = parseFlightNumber(segment.flight_number);
    if (!parsed) {
      console.warn(`Could not parse flight number: ${segment.flight_number}`);
      return;
    }

    setLoading(prev => ({ ...prev, [segment.id]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('flight-status', {
        body: {
          carrierCode: parsed.carrier,
          flightNumber: parsed.number,
          scheduledDate: segment.start_date,
        },
      });

      if (error) throw error;

      if (data?.success && data?.status) {
        setStatuses(prev => ({ ...prev, [segment.id]: data.status }));
      }
    } catch (error) {
      console.error('Failed to fetch flight status:', error);
    } finally {
      setLoading(prev => ({ ...prev, [segment.id]: false }));
    }
  };

  const refreshAllStatuses = async () => {
    await Promise.all(flightSegments.map(s => fetchFlightStatus(s)));
    setLastRefresh(new Date());
    toast({ title: 'Flight statuses refreshed' });
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (flightSegments.length > 0) {
      Promise.all(flightSegments.map(s => fetchFlightStatus(s)));
      setLastRefresh(new Date());
    }
  }, [segments.length]);

  if (flightSegments.length === 0) {
    return null;
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      return format(parseISO(isoString), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {flightSegments.map(segment => {
          const status = statuses[segment.id];
          const isLoading = loading[segment.id];
          const config = status ? STATUS_CONFIG[status.flightStatus] : STATUS_CONFIG.unknown;
          const StatusIcon = config.icon;

          return (
            <div 
              key={segment.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Plane className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{segment.flight_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {segment.origin_code || segment.origin} → {segment.destination_code || segment.destination}
                  </p>
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : status ? (
                <div className="flex items-center gap-2">
                  {status.delayMinutes && status.delayMinutes > 0 && (
                    <span className="text-xs font-medium text-amber-600">
                      +{status.delayMinutes}m
                    </span>
                  )}
                  <Badge variant="outline" className={config.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                </div>
              ) : (
                <Badge variant="outline">No data</Badge>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Flight Status
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refreshAllStatuses}
            disabled={Object.values(loading).some(Boolean)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${Object.values(loading).some(Boolean) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {lastRefresh && (
          <p className="text-xs text-muted-foreground">
            Last updated: {format(lastRefresh, 'HH:mm')}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {flightSegments.map(segment => {
          const status = statuses[segment.id];
          const isLoading = loading[segment.id];
          const config = status ? STATUS_CONFIG[status.flightStatus] : STATUS_CONFIG.unknown;
          const StatusIcon = config.icon;

          return (
            <div 
              key={segment.id}
              className="border rounded-lg p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plane className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{segment.flight_number}</p>
                    <p className="text-sm text-muted-foreground">{segment.vendor_name}</p>
                  </div>
                </div>
                {isLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <Badge variant="outline" className={config.color}>
                    <StatusIcon className="h-3.5 w-3.5 mr-1" />
                    {config.label}
                    {status?.delayMinutes && status.delayMinutes > 0 && (
                      <span className="ml-1">(+{status.delayMinutes}m)</span>
                    )}
                  </Badge>
                )}
              </div>

              {/* Route & Times */}
              <div className="flex items-center justify-between text-sm">
                <div className="text-center">
                  <p className="text-lg font-bold">
                    {segment.origin_code || status?.departureAirport || segment.origin?.slice(0, 3).toUpperCase() || '---'}
                  </p>
                  {status?.scheduledDeparture && (
                    <p className={status.delayMinutes ? 'line-through text-muted-foreground' : ''}>
                      {formatTime(status.scheduledDeparture)}
                    </p>
                  )}
                  {status?.estimatedDeparture && status.delayMinutes && (
                    <p className="text-amber-600 font-medium">
                      {formatTime(status.estimatedDeparture)}
                    </p>
                  )}
                </div>

                <div className="flex-1 flex items-center justify-center px-4">
                  <div className="w-full border-t border-dashed relative">
                    <Plane className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background text-muted-foreground" />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-lg font-bold">
                    {segment.destination_code || status?.arrivalAirport || segment.destination?.slice(0, 3).toUpperCase() || '---'}
                  </p>
                  {status?.scheduledArrival && (
                    <p className={status.estimatedArrival && status.delayMinutes ? 'line-through text-muted-foreground' : ''}>
                      {formatTime(status.scheduledArrival)}
                    </p>
                  )}
                  {status?.estimatedArrival && status.delayMinutes && (
                    <p className="text-amber-600 font-medium">
                      {formatTime(status.estimatedArrival)}
                    </p>
                  )}
                </div>
              </div>

              {/* Gate & Terminal Info */}
              {status && (status.departureGate || status.departureTerminal) && (
                <div className="flex items-center gap-4 pt-2 border-t text-sm">
                  {status.departureTerminal && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Terminal className="h-3.5 w-3.5" />
                      <span>Terminal {status.departureTerminal}</span>
                    </div>
                  )}
                  {status.departureGate && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Gate {status.departureGate}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Disruption Alert */}
              {status?.flightStatus === 'delayed' && status.delayMinutes && status.delayMinutes >= 30 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm">
                    <strong>Significant delay:</strong> This flight is delayed by {status.delayMinutes} minutes. 
                    Consider notifying travelers and checking connection impacts.
                  </p>
                </div>
              )}

              {status?.flightStatus === 'cancelled' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-red-700 dark:text-red-400">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm">
                    <strong>Flight cancelled.</strong> Contact the airline immediately for rebooking options.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
