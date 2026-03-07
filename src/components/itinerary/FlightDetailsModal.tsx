/**
 * FlightDetailsModal
 * 
 * Modal for entering comprehensive flight details including airports,
 * times, and optional layover information for both outbound and return flights.
 */

import { useState, useEffect } from 'react';
import { Plane, ChevronDown, ChevronUp, Plus, X, Clipboard, Train, Bus, Car, Ship, ArrowRight } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export type TransportMode = 'flight' | 'train' | 'bus' | 'car' | 'ferry';

export interface InterCityTransfer {
  mode: TransportMode;
  fromCity: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  arrivalTime?: string;
  carrier?: string;
  reference?: string;
}

export interface FlightDetails {
  outbound: FlightSegment;
  outboundLayovers?: FlightSegment[];
  return?: FlightSegment;
  returnLayovers?: FlightSegment[];
  interCityTransfers?: InterCityTransfer[];
  isMultiCity?: boolean;
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
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
  const [interCityTransfers, setInterCityTransfers] = useState<InterCityTransfer[]>(initialDetails?.interCityTransfers || []);
  const [showInterCity, setShowInterCity] = useState((initialDetails?.interCityTransfers?.length || 0) > 0);
  const [showOutboundLayovers, setShowOutboundLayovers] = useState(false);
  const [showReturnLayovers, setShowReturnLayovers] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const emptyTransfer: InterCityTransfer = {
    mode: 'train',
    fromCity: '',
    toCity: '',
    departureDate: '',
    departureTime: '',
  };

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setOutbound(initialDetails?.outbound || { ...emptySegment });
      setOutboundLayovers(initialDetails?.outboundLayovers || []);
      setHasReturn(!!initialDetails?.return);
      setReturnFlight(initialDetails?.return || { ...emptySegment });
      setReturnLayovers(initialDetails?.returnLayovers || []);
      setInterCityTransfers(initialDetails?.interCityTransfers || []);
      setShowInterCity((initialDetails?.interCityTransfers?.length || 0) > 0);
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
      interCityTransfers: interCityTransfers.length > 0 ? interCityTransfers : undefined,
      isMultiCity: interCityTransfers.length > 0,
    };

    if (hasReturn && (returnFlight.arrivalTime || returnFlight.departureTime)) {
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

  const addInterCityTransfer = () => {
    setInterCityTransfers([...interCityTransfers, { ...emptyTransfer }]);
    setShowInterCity(true);
  };

  const getModeIcon = (mode: TransportMode) => {
    switch (mode) {
      case 'flight': return <Plane className="h-3.5 w-3.5" />;
      case 'train': return <Train className="h-3.5 w-3.5" />;
      case 'bus': return <Bus className="h-3.5 w-3.5" />;
      case 'car': return <Car className="h-3.5 w-3.5" />;
      case 'ferry': return <Ship className="h-3.5 w-3.5" />;
    }
  };

  const canSave = outbound.arrivalTime && outbound.departureAirport && outbound.arrivalAirport;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Transportation Details
            </DialogTitle>
            <DialogDescription>
              Arrival times help plan your first day, departure times help plan your last day
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
              Paste booking confirmation
            </Button>

            {/* Outbound Flight */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-primary rotate-[-45deg]" />
                  <span className="text-sm font-medium">Outbound Flight</span>
                  {tripStartDate && (
                    <span className="text-xs text-muted-foreground">
                      ({tripStartDate})
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground -mt-1">
                Arrival time determines when Day 1 activities can start
              </p>

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
                <p className="text-[10px] text-muted-foreground">
                  Departure time determines when last day activities must end
                </p>
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

            {/* Inter-City Transportation - for multi-city trips */}
            <Collapsible open={showInterCity} onOpenChange={setShowInterCity}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-sm border border-dashed border-border">
                  <div className="flex items-center gap-2">
                    <Train className="h-4 w-4 text-primary" />
                    <span>Multi-City Transportation</span>
                    {interCityTransfers.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {interCityTransfers.length}
                      </span>
                    )}
                  </div>
                  {showInterCity ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <p className="text-[10px] text-muted-foreground">
                  Add flights, trains, or buses between cities in your multi-city trip
                </p>

                {interCityTransfers.map((transfer, idx) => (
                  <div key={idx} className="space-y-3 p-3 bg-muted/30 rounded-lg relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Transfer {idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setInterCityTransfers(interCityTransfers.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Mode</Label>
                        <Select
                          value={transfer.mode}
                          onValueChange={(value) => {
                            const updated = [...interCityTransfers];
                            updated[idx] = { ...transfer, mode: value as TransportMode };
                            setInterCityTransfers(updated);
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flight">
                              <div className="flex items-center gap-2">
                                <Plane className="h-3.5 w-3.5" />
                                Flight
                              </div>
                            </SelectItem>
                            <SelectItem value="train">
                              <div className="flex items-center gap-2">
                                <Train className="h-3.5 w-3.5" />
                                Train
                              </div>
                            </SelectItem>
                            <SelectItem value="bus">
                              <div className="flex items-center gap-2">
                                <Bus className="h-3.5 w-3.5" />
                                Bus
                              </div>
                            </SelectItem>
                            <SelectItem value="car">
                              <div className="flex items-center gap-2">
                                <Car className="h-3.5 w-3.5" />
                                Car
                              </div>
                            </SelectItem>
                            <SelectItem value="ferry">
                              <div className="flex items-center gap-2">
                                <Ship className="h-3.5 w-3.5" />
                                Ferry
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Date</Label>
                        <Input
                          type="date"
                          value={transfer.departureDate}
                          onChange={(e) => {
                            const updated = [...interCityTransfers];
                            updated[idx] = { ...transfer, departureDate: e.target.value };
                            setInterCityTransfers(updated);
                          }}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Departs</Label>
                        <Input
                          type="time"
                          value={transfer.departureTime}
                          onChange={(e) => {
                            const updated = [...interCityTransfers];
                            updated[idx] = { ...transfer, departureTime: e.target.value };
                            setInterCityTransfers(updated);
                          }}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Arrives</Label>
                        <Input
                          type="time"
                          value={transfer.arrivalTime || ''}
                          onChange={(e) => {
                            const updated = [...interCityTransfers];
                            updated[idx] = { ...transfer, arrivalTime: e.target.value };
                            setInterCityTransfers(updated);
                          }}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">From City</Label>
                        <Input
                          value={transfer.fromCity}
                          onChange={(e) => {
                            const updated = [...interCityTransfers];
                            updated[idx] = { ...transfer, fromCity: e.target.value };
                            setInterCityTransfers(updated);
                          }}
                          placeholder="Marrakech"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">To City</Label>
                        <Input
                          value={transfer.toCity}
                          onChange={(e) => {
                            const updated = [...interCityTransfers];
                            updated[idx] = { ...transfer, toCity: e.target.value };
                            setInterCityTransfers(updated);
                          }}
                          placeholder="Lisbon"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground w-full"
                  onClick={addInterCityTransfer}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add inter-city transportation
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              Save Transportation Details
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
