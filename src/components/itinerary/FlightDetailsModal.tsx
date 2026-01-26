/**
 * FlightDetailsModal
 * 
 * Modal for entering comprehensive flight details including airports,
 * times, and optional layover information for both outbound and return flights.
 */

import { useState, useEffect } from 'react';
import { Plane, ChevronDown, ChevronUp, Plus, X, Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { FlightImportModal } from './FlightImportModal';
import type { ManualFlightEntry } from './AddBookingInline';

export interface FlightSegment {
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  departureDate?: string;
  arrivalDate?: string;
  flightNumber?: string;
  airline?: string;
}

export interface FlightDetails {
  outbound: FlightSegment;
  outboundLayovers?: FlightSegment[];
  return?: FlightSegment;
  returnLayovers?: FlightSegment[];
}

interface FlightDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (details: FlightDetails) => void;
  initialDetails?: Partial<FlightDetails>;
  tripStartDate?: string;
  tripEndDate?: string;
  destination?: string;
}

function FlightSegmentForm({
  segment,
  onChange,
  label,
  showDates = false,
  dateValue,
  onRemove,
}: {
  segment: FlightSegment;
  onChange: (segment: FlightSegment) => void;
  label: string;
  showDates?: boolean;
  dateValue?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg relative">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">From (Airport)</Label>
          <Input
            value={segment.departureAirport}
            onChange={(e) => onChange({ ...segment, departureAirport: e.target.value.toUpperCase() })}
            placeholder="ATL"
            className="h-9 text-sm uppercase"
            maxLength={3}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">To (Airport)</Label>
          <Input
            value={segment.arrivalAirport}
            onChange={(e) => onChange({ ...segment, arrivalAirport: e.target.value.toUpperCase() })}
            placeholder="LIS"
            className="h-9 text-sm uppercase"
            maxLength={3}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Departs</Label>
          <Input
            type="time"
            value={segment.departureTime}
            onChange={(e) => onChange({ ...segment, departureTime: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Arrives</Label>
          <Input
            type="time"
            value={segment.arrivalTime}
            onChange={(e) => onChange({ ...segment, arrivalTime: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {showDates && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Departure Date</Label>
            <Input
              type="date"
              value={segment.departureDate || dateValue || ''}
              onChange={(e) => onChange({ ...segment, departureDate: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Arrival Date</Label>
            <Input
              type="date"
              value={segment.arrivalDate || dateValue || ''}
              onChange={(e) => onChange({ ...segment, arrivalDate: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

const emptySegment: FlightSegment = {
  departureAirport: '',
  arrivalAirport: '',
  departureTime: '',
  arrivalTime: '',
};

export function FlightDetailsModal({
  open,
  onOpenChange,
  onSave,
  initialDetails,
  tripStartDate,
  tripEndDate,
  destination,
}: FlightDetailsModalProps) {
  const [outbound, setOutbound] = useState<FlightSegment>(initialDetails?.outbound || { ...emptySegment });
  const [outboundLayovers, setOutboundLayovers] = useState<FlightSegment[]>(initialDetails?.outboundLayovers || []);
  const [hasReturn, setHasReturn] = useState(!!initialDetails?.return);
  const [returnFlight, setReturnFlight] = useState<FlightSegment>(initialDetails?.return || { ...emptySegment });
  const [returnLayovers, setReturnLayovers] = useState<FlightSegment[]>(initialDetails?.returnLayovers || []);
  const [showOutboundLayovers, setShowOutboundLayovers] = useState(false);
  const [showReturnLayovers, setShowReturnLayovers] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setOutbound(initialDetails?.outbound || { ...emptySegment });
      setOutboundLayovers(initialDetails?.outboundLayovers || []);
      setHasReturn(!!initialDetails?.return);
      setReturnFlight(initialDetails?.return || { ...emptySegment });
      setReturnLayovers(initialDetails?.returnLayovers || []);
    }
  }, [open, initialDetails]);

  const handleImport = (imported: ManualFlightEntry) => {
    setOutbound({
      departureAirport: imported.departureAirport || '',
      arrivalAirport: imported.arrivalAirport || '',
      departureTime: imported.departureTime || '',
      arrivalTime: imported.arrivalTime || '',
      departureDate: imported.departureDate,
      flightNumber: imported.flightNumber,
      airline: imported.airline,
    });
  };

  const handleSave = () => {
    const details: FlightDetails = {
      outbound,
      outboundLayovers: outboundLayovers.length > 0 ? outboundLayovers : undefined,
    };

    if (hasReturn && returnFlight.arrivalTime) {
      details.return = returnFlight;
      if (returnLayovers.length > 0) {
        details.returnLayovers = returnLayovers;
      }
    }

    onSave(details);
    onOpenChange(false);
  };

  const addOutboundLayover = () => {
    setOutboundLayovers([...outboundLayovers, { ...emptySegment }]);
    setShowOutboundLayovers(true);
  };

  const addReturnLayover = () => {
    setReturnLayovers([...returnLayovers, { ...emptySegment }]);
    setShowReturnLayovers(true);
  };

  const canSave = outbound.arrivalTime && outbound.departureAirport && outbound.arrivalAirport;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Flight Details
            </DialogTitle>
            <DialogDescription>
              Enter your flight information for accurate itinerary planning
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Import option */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowImportModal(true)}
            >
              <Clipboard className="h-3.5 w-3.5 mr-2" />
              Paste from airline confirmation
            </Button>

            {/* Outbound Flight */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-primary rotate-[-45deg]" />
                <span className="text-sm font-medium">Outbound Flight</span>
                {tripStartDate && (
                  <span className="text-xs text-muted-foreground">
                    ({tripStartDate})
                  </span>
                )}
              </div>

              <FlightSegmentForm
                segment={outbound}
                onChange={setOutbound}
                label="Main Flight"
                showDates={!tripStartDate}
                dateValue={tripStartDate}
              />

              {/* Outbound Layovers */}
              {outboundLayovers.length > 0 && (
                <Collapsible open={showOutboundLayovers} onOpenChange={setShowOutboundLayovers}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs w-full justify-between">
                      <span>Layovers ({outboundLayovers.length})</span>
                      {showOutboundLayovers ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {outboundLayovers.map((layover, idx) => (
                      <FlightSegmentForm
                        key={idx}
                        segment={layover}
                        onChange={(updated) => {
                          const newLayovers = [...outboundLayovers];
                          newLayovers[idx] = updated;
                          setOutboundLayovers(newLayovers);
                        }}
                        label={`Connecting Flight ${idx + 1}`}
                        onRemove={() => setOutboundLayovers(outboundLayovers.filter((_, i) => i !== idx))}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={addOutboundLayover}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add layover/connection
              </Button>
            </div>

            {/* Return Flight */}
            <Collapsible open={hasReturn} onOpenChange={setHasReturn}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-primary rotate-45" />
                    <span>Return Flight</span>
                    {tripEndDate && (
                      <span className="text-xs text-muted-foreground">
                        ({tripEndDate})
                      </span>
                    )}
                  </div>
                  {hasReturn ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <FlightSegmentForm
                  segment={returnFlight}
                  onChange={setReturnFlight}
                  label="Main Flight"
                  showDates={!tripEndDate}
                  dateValue={tripEndDate}
                />

                {/* Return Layovers */}
                {returnLayovers.length > 0 && (
                  <Collapsible open={showReturnLayovers} onOpenChange={setShowReturnLayovers}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs w-full justify-between">
                        <span>Layovers ({returnLayovers.length})</span>
                        {showReturnLayovers ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      {returnLayovers.map((layover, idx) => (
                        <FlightSegmentForm
                          key={idx}
                          segment={layover}
                          onChange={(updated) => {
                            const newLayovers = [...returnLayovers];
                            newLayovers[idx] = updated;
                            setReturnLayovers(newLayovers);
                          }}
                          label={`Connecting Flight ${idx + 1}`}
                          onRemove={() => setReturnLayovers(returnLayovers.filter((_, i) => i !== idx))}
                        />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={addReturnLayover}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add layover/connection
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              Save Flight Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FlightImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImport}
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
      />
    </>
  );
}
