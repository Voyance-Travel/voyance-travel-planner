/**
 * SortableFlightLegCards
 * 
 * Wraps flight leg cards with drag-and-drop reordering via @dnd-kit.
 * Used inside EditorialItinerary's Details > Flights section.
 */

import { useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plane, Star, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AirlineLogo from '@/components/planner/shared/AirlineLogo';

export interface FlightLegDisplay {
  airline?: string;
  airlineCode?: string;
  flightNumber?: string;
  departure?: { airport?: string; time?: string; date?: string };
  arrival?: { airport?: string; time?: string; date?: string };
  duration?: string;
  price?: number;
  cabinClass?: string;
  seat?: string;
  confirmationCode?: string;
  terminal?: string;
  gate?: string;
  baggageInfo?: string;
  frequentFlyerNumber?: string;
  boardingPassUrl?: string;
  isDestinationArrival?: boolean;
  isDestinationDeparture?: boolean;
}

interface SortableFlightLegCardsProps {
  legs: FlightLegDisplay[];
  startDate: string;
  endDate: string;
  isEditable: boolean;
  onReorder: (reorderedLegs: FlightLegDisplay[]) => void;
  onMarkLeg: (legIndex: number, field: 'isDestinationArrival' | 'isDestinationDeparture') => void;
  getAirportDisplay: (code: string) => string;
  renderBoardingPass?: (storagePath: string) => React.ReactNode;
}

function SortableFlightCard({
  leg,
  idx,
  totalLegs,
  startDate,
  endDate,
  isEditable,
  onMarkLeg,
  getAirportDisplay,
  renderBoardingPass,
}: {
  leg: FlightLegDisplay;
  idx: number;
  totalLegs: number;
  startDate: string;
  endDate: string;
  isEditable: boolean;
  onMarkLeg: (legIndex: number, field: 'isDestinationArrival' | 'isDestinationDeparture') => void;
  getAirportDisplay: (code: string) => string;
  renderBoardingPass?: (storagePath: string) => React.ReactNode;
}) {
  const sortableId = `flight-leg-${leg.flightNumber || ''}-${leg.departure?.airport || ''}-${leg.arrival?.airport || ''}-${idx}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, disabled: !isEditable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const isFirst = idx === 0;
  const isLast = idx === totalLegs - 1;
  const legLabel = totalLegs <= 2
    ? (isFirst ? 'Outbound' : 'Return')
    : `Leg ${idx + 1}`;
  const accentColor = isLast && totalLegs > 1 ? 'accent' : 'primary';
  const defaultDate = isFirst ? startDate : isLast ? endDate : undefined;
  const isMarkedArrival = !!leg.isDestinationArrival;
  const isMarkedDeparture = !!leg.isDestinationDeparture;

  return (
    <div ref={setNodeRef} style={style}>
      <div className={cn(
        "group rounded-xl border bg-card overflow-hidden hover:shadow-soft transition-shadow",
        isMarkedArrival ? "border-primary/40 ring-1 ring-primary/20" : isMarkedDeparture ? "border-accent/40 ring-1 ring-accent/20" : "border-border"
      )}>
        <div className="flex items-stretch">
          {/* Color strip */}
          <div className={`w-1.5 bg-gradient-to-b from-${accentColor} to-${accentColor}/50 shrink-0`} />
          
          {/* Drag handle */}
          {isEditable && (
            <div
              {...attributes}
              {...listeners}
              className="flex items-center px-1.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          <div className="flex-1 p-3 sm:p-4">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3 gap-1.5 sm:gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={isFirst ? 'secondary' : 'outline'} className={cn("text-xs font-medium", !isFirst && `border-${accentColor}/30 text-${accentColor}`)}>
                  {legLabel}
                </Badge>
                {isMarkedArrival && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-0">
                    <Star className="h-2.5 w-2.5 mr-0.5 fill-primary" /> Arrives at destination
                  </Badge>
                )}
                {isMarkedDeparture && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-accent/10 text-accent border-0">
                    <Star className="h-2.5 w-2.5 mr-0.5 fill-accent" /> Departs from destination
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {leg.departure?.date || defaultDate}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AirlineLogo 
                  code={leg.airlineCode || leg.airline?.substring(0, 2) || ''} 
                  name={leg.airline}
                  size="sm"
                />
                <span className="text-sm font-medium">{leg.airline}</span>
                <span className="text-xs text-muted-foreground">{leg.flightNumber}</span>
              </div>
            </div>
            
            {/* Route visualization */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="text-center min-w-[60px]">
                <p className="text-base sm:text-xl font-semibold tracking-tight">{leg.departure?.time || '--:--'}</p>
                <p className={`text-xs font-medium text-${accentColor}`}>{getAirportDisplay(leg.departure?.airport || '')}</p>
              </div>
              
              <div className="flex-1 flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full bg-${accentColor}`} />
                <div className="flex-1 relative">
                  <div className={`h-px bg-gradient-to-r from-${accentColor}/60 via-border to-${accentColor}/60`} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2">
                    {leg.duration ? (
                      <span className="text-[10px] text-muted-foreground">{leg.duration}</span>
                    ) : (
                      <Plane className={cn("h-3 w-3 text-muted-foreground", isLast && totalLegs > 1 && "rotate-180")} />
                    )}
                  </div>
                </div>
                <div className={`h-1.5 w-1.5 rounded-full bg-${accentColor}`} />
              </div>
              
              <div className="text-center min-w-[60px]">
                <p className="text-base sm:text-xl font-semibold tracking-tight">{leg.arrival?.time || '--:--'}</p>
                <p className={`text-xs font-medium text-${accentColor}`}>{getAirportDisplay(leg.arrival?.airport || '')}</p>
              </div>
            </div>
            
            {/* Details row */}
            {(leg.cabinClass || leg.seat || leg.confirmationCode || leg.terminal || leg.gate || leg.baggageInfo || leg.frequentFlyerNumber || leg.boardingPassUrl) && (
              <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50 space-y-1.5 sm:space-y-2">
                {(leg.confirmationCode || leg.seat || leg.cabinClass) && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {leg.confirmationCode && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold tracking-wider">
                        {leg.confirmationCode}
                      </span>
                    )}
                    {leg.cabinClass && (
                      <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">{leg.cabinClass}</span>
                    )}
                    {leg.seat && (
                      <span className="text-xs text-muted-foreground">Seat {leg.seat}</span>
                    )}
                  </div>
                )}
                {(leg.terminal || leg.gate || leg.baggageInfo) && (
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    {leg.terminal && <span>{leg.terminal}</span>}
                    {leg.gate && <span>Gate {leg.gate}</span>}
                    {leg.baggageInfo && <span>🧳 {leg.baggageInfo}</span>}
                  </div>
                )}
                {(leg.frequentFlyerNumber || leg.boardingPassUrl) && (
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    {leg.frequentFlyerNumber && (
                      <span className="font-mono">FF# {leg.frequentFlyerNumber}</span>
                    )}
                    {leg.boardingPassUrl && renderBoardingPass?.(leg.boardingPassUrl)}
                  </div>
                )}
              </div>
            )}

            {/* Mark buttons */}
            {totalLegs > 1 && (
              <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onMarkLeg(idx, 'isDestinationArrival')}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border transition-colors",
                    isMarkedArrival
                      ? "bg-primary/10 border-primary/30 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <MapPin className={cn("h-3 w-3", isMarkedArrival && "text-primary")} />
                  {isMarkedArrival ? '✓ Arrives at destination' : 'Mark as destination arrival'}
                </button>
                <button
                  type="button"
                  onClick={() => onMarkLeg(idx, 'isDestinationDeparture')}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border transition-colors",
                    isMarkedDeparture
                      ? "bg-accent/10 border-accent/30 text-accent font-medium"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Plane className="h-3 w-3" />
                  {isMarkedDeparture ? '✓ Departs from destination' : 'Mark as departure from destination'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SortableFlightLegCards({
  legs,
  startDate,
  endDate,
  isEditable,
  onReorder,
  onMarkLeg,
  getAirportDisplay,
  renderBoardingPass,
}: SortableFlightLegCardsProps) {
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors = useSensors(pointerSensor, keyboardSensor);
  const sortableIds = useMemo(() => legs.map((leg, i) => `flight-leg-${leg.flightNumber || ''}-${leg.departure?.airport || ''}-${leg.arrival?.airport || ''}-${i}`), [legs]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove([...legs], oldIndex, newIndex);
    onReorder(reordered);
  }, [legs, sortableIds, onReorder]);

  if (!isEditable) {
    // Non-editable: render without DnD
    return (
      <div className="space-y-3">
         {legs.map((leg, idx) => (
          <SortableFlightCard
            key={`${leg.flightNumber || ''}-${leg.departure?.airport || ''}-${leg.arrival?.airport || ''}-${idx}`}
            leg={leg}
            idx={idx}
            totalLegs={legs.length}
            startDate={startDate}
            endDate={endDate}
            isEditable={false}
            onMarkLeg={onMarkLeg}
            getAirportDisplay={getAirportDisplay}
            renderBoardingPass={renderBoardingPass}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {legs.map((leg, idx) => (
            <SortableFlightCard
              key={`${leg.flightNumber || ''}-${leg.departure?.airport || ''}-${leg.arrival?.airport || ''}-${idx}`}
              leg={leg}
              idx={idx}
              totalLegs={legs.length}
              startDate={startDate}
              endDate={endDate}
              isEditable={true}
              onMarkLeg={onMarkLeg}
              getAirportDisplay={getAirportDisplay}
              renderBoardingPass={renderBoardingPass}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
