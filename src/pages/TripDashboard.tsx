import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SafeImage from '@/components/SafeImage';
import { 
  Plus, 
  Plane, 
  Calendar, 
  Users, 
  Clock, 
  Sparkles,
  Globe,
  CheckCircle,
  Edit3,
  Hotel,
  MapPin,
  Eye,
  ArrowRight,
  Compass,
  Loader2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
   Zap,
   Trash2,
   UserPlus,
   AlertTriangle,
   RotateCcw
} from 'lucide-react';
import ActiveTripCard from '@/components/trips/ActiveTripCard';
import { PastTripCard } from '@/components/trips/PastTripCard';
import JourneyPlaylist from '@/components/trips/JourneyPlaylist';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { DraftLimitBanner } from '@/components/common/DraftLimitBanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftLimitCheck } from '@/hooks/useDraftLimitCheck';
import { supabase } from '@/integrations/supabase/client';
import { useTripHeroImage } from '@/hooks/useTripHeroImage';
import { getDestinationImage } from '@/utils/destinationImages';
 import { toast } from 'sonner';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger,
 } from '@/components/ui/alert-dialog';
 import { Lock } from 'lucide-react';

// Extract base destination name (e.g., "Rome (FCO)" -> "Rome", "Paris, France" -> "Paris")
function getBaseDestination(destination: string): string {
  // Remove parenthetical suffixes like (FCO), (JFK)
  let base = destination.replace(/\s*\([^)]*\)\s*$/, '').trim();
  // Take first part before comma (city name)
  base = base.split(',')[0].trim();
  return base;
}

// Map IATA airport codes to city names for display
const AIRPORT_TO_CITY: Record<string, string> = {
  // United States
  'ATL': 'Atlanta', 'LAX': 'Los Angeles', 'ORD': 'Chicago', 'DFW': 'Dallas',
  'DEN': 'Denver', 'JFK': 'New York', 'SFO': 'San Francisco', 'SEA': 'Seattle',
  'LAS': 'Las Vegas', 'MCO': 'Orlando', 'EWR': 'Newark', 'MIA': 'Miami',
  'PHX': 'Phoenix', 'IAH': 'Houston', 'BOS': 'Boston', 'MSP': 'Minneapolis',
  'DTW': 'Detroit', 'FLL': 'Fort Lauderdale', 'PHL': 'Philadelphia', 'LGA': 'New York',
  'BWI': 'Baltimore', 'SLC': 'Salt Lake City', 'DCA': 'Washington DC', 'IAD': 'Washington DC',
  'SAN': 'San Diego', 'TPA': 'Tampa', 'AUS': 'Austin', 'BNA': 'Nashville',
  // Europe
  'LHR': 'London', 'CDG': 'Paris', 'FCO': 'Rome', 'AMS': 'Amsterdam',
  'FRA': 'Frankfurt', 'MAD': 'Madrid', 'BCN': 'Barcelona', 'MUC': 'Munich',
  'LGW': 'London', 'ORY': 'Paris', 'DUB': 'Dublin', 'ZRH': 'Zurich',
  'VIE': 'Vienna', 'LIS': 'Lisbon', 'CPH': 'Copenhagen', 'OSL': 'Oslo',
  'ARN': 'Stockholm', 'HEL': 'Helsinki', 'PRG': 'Prague', 'BRU': 'Brussels',
  'ATH': 'Athens', 'IST': 'Istanbul', 'MXP': 'Milan', 'VCE': 'Venice',
  'BER': 'Berlin', 'EDI': 'Edinburgh', 'MAN': 'Manchester',
  // Asia Pacific
  'HND': 'Tokyo', 'NRT': 'Tokyo', 'SIN': 'Singapore', 'HKG': 'Hong Kong',
  'ICN': 'Seoul', 'BKK': 'Bangkok', 'KUL': 'Kuala Lumpur', 'SYD': 'Sydney',
  'MEL': 'Melbourne', 'DEL': 'Delhi', 'BOM': 'Mumbai', 'PEK': 'Beijing',
  'PVG': 'Shanghai', 'TPE': 'Taipei', 'MNL': 'Manila', 'CGK': 'Jakarta',
  // Middle East
  'DXB': 'Dubai', 'DOH': 'Doha', 'AUH': 'Abu Dhabi', 'TLV': 'Tel Aviv',
  // Americas
  'YYZ': 'Toronto', 'YVR': 'Vancouver', 'YUL': 'Montreal', 'MEX': 'Mexico City',
  'CUN': 'Cancun', 'GRU': 'São Paulo', 'GIG': 'Rio de Janeiro', 'EZE': 'Buenos Aires',
  'BOG': 'Bogotá', 'LIM': 'Lima', 'SCL': 'Santiago',
};

// Convert airport code or city name to displayable city name
function getDisplayCity(departureCityOrCode: string): string {
  const upper = departureCityOrCode.toUpperCase().trim();
  // Check if it's a 3-letter IATA code
  if (/^[A-Z]{3}$/.test(upper) && AIRPORT_TO_CITY[upper]) {
    return AIRPORT_TO_CITY[upper];
  }
  // Otherwise return as-is (already a city name)
  return departureCityOrCode;
}

// Region mapping for grouping
const REGION_MAP: Record<string, string> = {
  // Europe
  'Paris': 'Europe', 'London': 'Europe', 'Rome': 'Europe', 'Barcelona': 'Europe',
  'Amsterdam': 'Europe', 'Berlin': 'Europe', 'Vienna': 'Europe', 'Prague': 'Europe',
  'Lisbon': 'Europe', 'Madrid': 'Europe', 'Athens': 'Europe', 'Dublin': 'Europe',
  'Munich': 'Europe', 'Venice': 'Europe', 'Florence': 'Europe', 'Milan': 'Europe',
  'Zurich': 'Europe', 'Brussels': 'Europe', 'Copenhagen': 'Europe', 'Stockholm': 'Europe',
  // Asia
  'Tokyo': 'Asia', 'Kyoto': 'Asia', 'Bangkok': 'Asia', 'Singapore': 'Asia',
  'Hong Kong': 'Asia', 'Seoul': 'Asia', 'Bali': 'Asia', 'Dubai': 'Middle East',
  'Mumbai': 'Asia', 'Delhi': 'Asia', 'Shanghai': 'Asia', 'Beijing': 'Asia',
  // Americas
  'New York': 'North America', 'Los Angeles': 'North America', 'Miami': 'North America',
  'San Francisco': 'North America', 'Chicago': 'North America', 'Las Vegas': 'North America',
  'Toronto': 'North America', 'Vancouver': 'North America', 'Mexico City': 'North America',
  'Cancun': 'North America', 'Rio de Janeiro': 'South America', 'Buenos Aires': 'South America',
  // Africa & Oceania
  'Cape Town': 'Africa', 'Marrakech': 'Africa', 'Cairo': 'Africa',
  'Sydney': 'Oceania', 'Melbourne': 'Oceania', 'Auckland': 'Oceania',
};

function getRegion(destination: string): string {
  const base = getBaseDestination(destination);
  return REGION_MAP[base] || 'Other';
}

interface TripGroup {
  key: string;
  label: string;
  trips: Trip[];
  region: string;
}

type TabValue = 'all' | 'active' | 'upcoming' | 'completed';
type TripStatus = 'draft' | 'planning' | 'booked' | 'active' | 'completed' | 'cancelled';
type DisplayStatus = 'upcoming' | 'active' | 'completed' | 'canceled';

interface TripCollaboratorInfo {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  handle: string | null;
}

interface Trip {
  id: string;
  destination: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  travelers: number;
  departureCity: string | null;
  flightSelection: any;
  hotelSelection: any;
  metadata: Record<string, any> | null;
  hasItineraryData: boolean;
  itineraryStatus: string | null;
   isPaid?: boolean;
  isCollaborator?: boolean;
  ownerName?: string | null;
  collaborators?: TripCollaboratorInfo[];
  // Journey fields
  journeyId: string | null;
  journeyName: string | null;
  journeyOrder: number | null;
  journeyTotalLegs: number | null;
  transitionMode: string | null;
}

// Simplified status mapping - no more "draft" display, all future trips are "upcoming"
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function mapToDisplayStatus(status: TripStatus, startDate: string | null, endDate: string | null): DisplayStatus {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Completed or past trips
  if (status === 'completed' || (endDate && parseLocalDate(endDate) < today)) {
    return 'completed';
  }
  
  // Cancelled trips
  if (status === 'cancelled') {
    return 'canceled';
  }
  
  // Active trips (currently happening)
  if (status === 'active' || (startDate && endDate && parseLocalDate(startDate) <= today && parseLocalDate(endDate) >= today)) {
    return 'active';
  }
  
  // Everything else (draft, planning, booked with future dates) = upcoming
  return 'upcoming';
}

const statusConfig: Record<DisplayStatus, { label: string; color: string; icon: typeof Edit3 }> = {
  upcoming: { label: 'Upcoming', color: 'bg-primary/20 text-primary border border-primary/30', icon: Clock },
  active: { label: 'In Progress', color: 'bg-green-500/20 text-green-700 border border-green-500/30', icon: Plane },
  completed: { label: 'Completed', color: 'bg-muted text-muted-foreground border border-border', icon: CheckCircle },
  canceled: { label: 'Cancelled', color: 'bg-destructive/20 text-destructive border border-destructive/30', icon: Edit3 },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return 'TBD';
  const d = parseLocalDate(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return 'Dates not set';
  if (!startDate) return `Until ${formatDate(endDate)}`;
  if (!endDate) return `From ${formatDate(startDate)}`;
  
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return `${formatDate(startDate)} – ${formatDate(endDate)} (${diffDays} days)`;
}

// Helper to check if a trip can be deleted
function canDeleteTrip(trip: Trip): { canDelete: boolean; reason?: string } {
   
   // Check if trip has a paid reservation
   if (trip.isPaid) {
     return { canDelete: false, reason: 'Trips with paid reservations cannot be deleted' };
   }
   
   // Check hotel selection for paid bookings (Amadeus source indicates paid)
   if (trip.hotelSelection) {
     const hotels = Array.isArray(trip.hotelSelection) ? trip.hotelSelection : [trip.hotelSelection];
     const hasPaidHotel = hotels.some((h: any) => 
       h?.source === 'amadeus' || 
       h?.isPaid === true || 
       h?.bookingConfirmation ||
       h?.confirmationNumber
     );
     if (hasPaidHotel) {
       return { canDelete: false, reason: 'Trips with paid hotel bookings cannot be deleted' };
     }
   }
   
   return { canDelete: true };
}

function TripCard({ trip, index = 0, onDelete, isAdmin, onClone }: { trip: Trip; index?: number; onDelete?: (tripId: string) => void; isAdmin?: boolean; onClone?: (tripId: string) => void }) {
  const navigate = useNavigate();
  const displayStatus = mapToDisplayStatus(trip.status, trip.startDate, trip.endDate);
  const deleteCheck = canDeleteTrip(trip);
  const [isDeleting, setIsDeleting] = useState(false);

  // Use smart hero image hook with API fallback for uncurated destinations
  const seededHero = (trip.metadata && typeof trip.metadata === 'object')
    ? (trip.metadata as Record<string, unknown>).hero_image
    : null;
  const seededHeroUrl = typeof seededHero === 'string' && seededHero.length > 0 ? seededHero : null;

  const { imageUrl, onError: onImageError, onLoad: onImageLoad } = useTripHeroImage({
    destination: trip.destination,
    seededHeroUrl,
    tripId: trip.id,
  });

  // Use PastTripCard for completed trips (after all hooks)
  if (displayStatus === 'completed') {
    return <PastTripCard trip={trip} index={index} />;
  }

  const status = statusConfig[displayStatus];
  const StatusIcon = status.icon;
  
  // Check for booking status - use direct properties
  const hasItinerary = !!trip.hasItineraryData;
  const hasFlight = !!trip.flightSelection;
  const hasHotel = !!trip.hotelSelection;
  const travelersCount = typeof trip.travelers === 'number' ? trip.travelers : 1;

  const handleCardClick = () => {
    if (displayStatus === 'active') {
      navigate(`/trip/${trip.id}/active`);
    } else {
      navigate(`/trip/${trip.id}`);
    }
  };

   const handleDelete = async () => {
     if (!deleteCheck.canDelete) {
       toast.error(deleteCheck.reason);
       return;
     }
     
     setIsDeleting(true);
     try {
       const { error } = await supabase
         .from('trips')
         .delete()
         .eq('id', trip.id);
       
       if (error) throw error;
       toast.success('Trip deleted');
       onDelete?.(trip.id);
     } catch (err: any) {
       console.error('Failed to delete trip:', err);
       toast.error('Failed to delete trip');
     } finally {
       setIsDeleting(false);
     }
   };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative bg-card rounded-xl sm:rounded-2xl overflow-hidden border border-border shadow-soft hover:shadow-elevated transition-all duration-500"
    >
       {/* Delete button - only show if deletable */}
        {deleteCheck.canDelete ? (
         <AlertDialog>
           <AlertDialogTrigger asChild>
             <button
               className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-destructive/80 active:bg-destructive/80"
               title="Delete trip"
             >
               <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-white" />
             </button>
           </AlertDialogTrigger>
           <AlertDialogContent>
             <AlertDialogHeader>
               <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
               <AlertDialogDescription>
                 This will permanently delete your trip to {trip.destination}. This action cannot be undone.
               </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
               <AlertDialogCancel>Cancel</AlertDialogCancel>
               <AlertDialogAction
                 onClick={handleDelete}
                 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                 disabled={isDeleting}
               >
                 {isDeleting ? (
                   <Loader2 className="h-4 w-4 animate-spin mr-2" />
                 ) : (
                   <Trash2 className="h-4 w-4 mr-2" />
                 )}
                 Delete
               </AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
         </AlertDialog>
        ) : (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-not-allowed"
                  disabled
                >
                  <Lock className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-white/70" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px]">
                <p className="text-xs">{deleteCheck.reason}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

      {/* Image Section - mobile optimized height */}
      <div className="relative h-40 sm:h-52 overflow-hidden cursor-pointer" onClick={handleCardClick}>
        <img 
          src={imageUrl} 
          alt={trip.destination} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          onError={onImageError}
          onLoad={onImageLoad}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        {/* Status Badge */}
        {trip.itineraryStatus === 'failed' ? (
          <Badge className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-destructive/20 text-destructive border border-destructive/30 gap-1 sm:gap-1.5 backdrop-blur-sm text-[10px] sm:text-xs">
            <AlertTriangle className="h-3 w-3" />
            <span className="hidden sm:inline">Failed</span>
          </Badge>
        ) : (
          <Badge className={`absolute top-3 right-3 sm:top-4 sm:right-4 ${status.color} gap-1 sm:gap-1.5 backdrop-blur-sm text-[10px] sm:text-xs`}>
            <StatusIcon className="h-3 w-3" />
            <span className="hidden sm:inline">{status.label}</span>
          </Badge>
        )}
        
        {/* Destination Name */}
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4">
          <h3 className="font-serif text-xl sm:text-2xl font-semibold text-white drop-shadow-lg mb-0.5 sm:mb-1 line-clamp-1">
            {trip.destination}
          </h3>
          {trip.name && trip.name !== trip.destination && (
            <p className="text-white/80 text-xs sm:text-sm truncate">{trip.name}</p>
          )}
        </div>
      </div>

      {/* Content Section - mobile optimized */}
      <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
        {/* Trip Details - scrollable on mobile */}
        <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1.5 sm:gap-y-2 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary/70 shrink-0" />
            <span className="truncate">{formatDateRange(trip.startDate, trip.endDate)}</span>
          </div>
          {travelersCount > 0 && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary/70 shrink-0" />
              <span>{travelersCount}</span>
            </div>
          )}
          {trip.departureCity && (
            <div className="flex items-center gap-1 sm:gap-1.5 hidden sm:flex">
              <MapPin className="h-4 w-4 text-primary/70 shrink-0" />
              <span className="truncate">From {getDisplayCity(trip.departureCity)}</span>
            </div>
          )}
        </div>

        {/* Failed generation banner */}
        {trip.itineraryStatus === 'failed' && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-destructive">Generation failed</span>
          </div>
        )}

        {/* Generating indicator */}
        {(trip.itineraryStatus === 'generating' || trip.itineraryStatus === 'queued') && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-primary">Generating itinerary…</span>
          </div>
        )}

        {/* Booking Status - horizontal scroll on mobile (hide for failed) */}
        {trip.itineraryStatus !== 'failed' && (
          <div className="flex gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto pb-1 scrollbar-hide">
            {hasFlight && (
              <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs shrink-0">
                <Plane className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> <span className="hidden sm:inline">Flight</span>
              </Badge>
            )}
            {hasHotel && (
              <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs shrink-0">
                <Hotel className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> <span className="hidden sm:inline">Hotel</span>
              </Badge>
            )}
            {hasItinerary && (
              <Badge variant="secondary" className={`gap-1 text-[10px] sm:text-xs shrink-0 ${
                trip.itineraryStatus === 'partial' 
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : trip.status === 'draft' 
                    ? 'bg-muted text-muted-foreground border-border'
                    : 'bg-primary/10 text-primary border-primary/20'
              }`}>
                <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> 
                {trip.itineraryStatus === 'partial' ? 'Partial' : trip.status === 'draft' ? 'Draft' : 'Ready'}
              </Badge>
            )}
          </div>
        )}

        {/* Collaborator indicator badge for linked trips */}
        {trip.isCollaborator && trip.ownerName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5 text-pink-500 shrink-0" />
            <span>Invited by <span className="font-medium text-foreground">{trip.ownerName}</span></span>
          </div>
        )}

        {/* Trip companions - avatar stack */}
        {trip.collaborators && trip.collaborators.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {trip.collaborators.slice(0, 4).map((collab) => (
                <TooltipProvider key={collab.id} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-7 w-7 border-2 border-card">
                        <AvatarImage src={collab.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] bg-pink-500/10 text-pink-600">
                          {(collab.display_name || collab.handle || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {collab.display_name || `@${collab.handle}`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {trip.collaborators.length > 4 && (
                <div className="h-7 w-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                  +{trip.collaborators.length - 4}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {trip.collaborators.length} companion{trip.collaborators.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Actions - mobile optimized touch targets */}
        <div className="flex gap-2 pt-1 sm:pt-2">
          {/* Admin-only Re-run button */}
          {isAdmin && onClone && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => onClone(trip.id)}
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 sm:h-11 sm:w-11 shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Re-run (clone &amp; regenerate)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {trip.itineraryStatus === 'failed' ? (
            <>
              <Button 
                onClick={() => navigate(`/trip/${trip.id}?generate=true`)} 
                variant="default" 
                className="flex-1 gap-1.5 sm:gap-2 h-10 sm:h-11 text-xs sm:text-sm"
              >
                <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Retry
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="gap-1.5 h-10 sm:h-11 text-xs sm:text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your failed trip to {trip.destination}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : hasItinerary ? (
            <Button 
              onClick={handleCardClick} 
              variant="default" 
              className="flex-1 gap-1.5 sm:gap-2 h-10 sm:h-11 text-xs sm:text-sm"
            >
              <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              View Itinerary
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleCardClick} 
                variant="default" 
                className="flex-1 gap-1.5 sm:gap-2 h-10 sm:h-11 text-xs sm:text-sm"
              >
                <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Continue
              </Button>
              <Button 
                onClick={() => navigate(`/trip/${trip.id}/itinerary`)} 
                variant="outline" 
                size="icon"
                title="Generate Itinerary"
                className="h-10 w-10 sm:h-11 sm:w-11"
              >
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ tab }: { tab: TabValue }) {
  const navigate = useNavigate();
  
  const inspirationDestinations = [
    { name: 'Paris', image: getDestinationImage('paris') },
    { name: 'Tokyo', image: getDestinationImage('tokyo') },
    { name: 'Bali', image: getDestinationImage('bali') },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="py-8 sm:py-12"
    >
      <div className="max-w-2xl mx-auto text-center mb-8 sm:mb-12 px-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 sm:mb-6 mx-auto"
        >
          <Compass className="h-8 w-8 sm:h-12 sm:w-12 text-primary" />
        </motion.div>
        
        <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">
          {tab === 'all' 
            ? "Your Next Adventure Awaits" 
            : tab === 'active'
            ? "No Active Trips Right Now"
            : tab === 'upcoming' 
            ? "No Upcoming Trips Yet"
            : "No Past Adventures"}
        </h2>
        
        <p className="text-muted-foreground text-base sm:text-lg mb-6 sm:mb-8 max-w-md mx-auto">
          {tab === 'all' 
            ? "Start planning your dream vacation with personalized itineraries."
            : tab === 'active'
            ? "You're not on a trip at the moment."
            : tab === 'upcoming'
            ? "All your planned trips will appear here."
            : "Completed adventures will be stored here."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Button 
            onClick={() => navigate('/start')} 
            size="lg" 
            className="gap-2 text-base sm:text-lg px-6 sm:px-8 h-12 sm:h-auto"
          >
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            Plan a Trip
          </Button>
          <Button 
            onClick={() => navigate('/explore')} 
            variant="outline" 
            size="lg" 
            className="gap-2 h-12 sm:h-auto"
          >
            <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
            Explore Destinations
          </Button>
        </div>
      </div>

      {/* Inspiration Section */}
      {tab === 'all' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-16"
        >
          <h3 className="font-serif text-xl font-semibold text-center mb-6">
            Need Inspiration?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {inspirationDestinations.map((dest, i) => (
              <motion.div
                key={dest.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                onClick={() => navigate(`/explore?destination=${encodeURIComponent(dest.name)}`)}
                className="group relative h-48 rounded-2xl overflow-hidden cursor-pointer shadow-soft hover:shadow-elevated transition-all"
              >
                <SafeImage 
                  src={dest.image} 
                  alt={dest.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  fallbackCategory="sightseeing"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <span className="font-serif text-xl text-white font-semibold">{dest.name}</span>
                  <ArrowRight className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function TripDashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  // Admin role check
  useEffect(() => {
    async function checkAdmin() {
      if (!user?.id) return;
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');
      setIsAdmin((roles?.length ?? 0) > 0);
    }
    checkAdmin();
  }, [user?.id]);

  // Clone trip handler (admin only)
  const handleCloneTrip = useCallback(async (sourceId: string) => {
    if (!user?.id) return;
    try {
      toast.info('Cloning trip…');
      const { data: source, error: fetchErr } = await supabase
        .from('trips')
        .select('*')
        .eq('id', sourceId)
        .single();
      if (fetchErr || !source) throw fetchErr || new Error('Trip not found');

      const { id, created_at, updated_at, share_token, itinerary_data, itinerary_status, itinerary_version, ...cloneData } = source as any;
      const { data: newTrip, error: insertErr } = await supabase
        .from('trips')
        .insert([{
          ...cloneData,
          user_id: user.id,
          status: 'draft',
          itinerary_data: null,
          itinerary_status: null,
          itinerary_version: 0,
          name: `${source.name || source.destination} (re-run)`,
        }])
        .select()
        .single();
      if (insertErr || !newTrip) throw insertErr || new Error('Failed to create trip');

      // Copy trip_cities if multi-city
      const { data: cities } = await supabase
        .from('trip_cities')
        .select('*')
        .eq('trip_id', sourceId);
      if (cities && cities.length > 0) {
        const cityInserts = cities.map(({ id: _id, trip_id: _tid, created_at: _ca, ...rest }: any) => ({
          ...rest,
          trip_id: newTrip.id,
        }));
        await supabase.from('trip_cities').insert(cityInserts);
      }

      toast.success('Trip cloned! Navigating…');
      navigate(`/trip/${newTrip.id}?generate=true`);
    } catch (err: any) {
      console.error('Clone failed:', err);
      toast.error('Failed to clone trip');
    }
  }, [user?.id, navigate]);

  // Fetch trips directly from Supabase
  useEffect(() => {
    async function loadTrips() {
      if (!isAuthenticated || !user?.id) {
        setTrips([]);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch owned trips
        const { data: ownedData, error: fetchError } = await supabase
          .from('trips')
          .select(`
            id, user_id, name, origin_city, destination, destination_country,
            start_date, end_date, travelers, trip_type, budget_tier, status,
            itinerary_status, flight_selection, hotel_selection, price_lock_expires_at,
            metadata, journey_id, journey_name, journey_order, journey_total_legs,
            transition_mode, creation_source, is_multi_city, created_at, updated_at
          `)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (fetchError) throw fetchError;

        // Fetch trips where user is a collaborator
        const { data: collabData } = await supabase
          .from('trip_collaborators')
          .select(`
            trip_id,
            permission,
            trip:trips!trip_collaborators_trip_id_fkey(
              id, user_id, name, origin_city, destination, destination_country,
              start_date, end_date, travelers, trip_type, budget_tier, status,
              itinerary_status, flight_selection, hotel_selection, price_lock_expires_at,
              metadata, journey_id, journey_name, journey_order, journey_total_legs,
              transition_mode, creation_source, is_multi_city, created_at, updated_at
            )
          `)
          .eq('user_id', user.id)
          .not('accepted_at', 'is', null);

        // Get all trip IDs to fetch collaborators for
        const ownedIds = (ownedData || []).map(r => r.id);
        const collabTripIds = (collabData || [])
          .filter(c => (c.trip as any)?.id)
          .map(c => (c.trip as any).id);
        const allTripIds = [...new Set([...ownedIds, ...collabTripIds])];

        // Fetch collaborators + profiles for all trips
        const { data: allCollaborators } = allTripIds.length > 0 
          ? await supabase
              .from('trip_collaborators')
              .select(`
                trip_id,
                user_id,
                profile:profiles!trip_collaborators_user_id_profiles_fkey(id, display_name, avatar_url, handle)
              `)
              .in('trip_id', allTripIds)
              .not('accepted_at', 'is', null)
          : { data: [] };

        // Also fetch owner profiles for collab trips
        const collabOwnerIds = (collabData || [])
          .map(c => (c.trip as any)?.user_id)
          .filter(Boolean);
        const { data: ownerProfiles } = collabOwnerIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, display_name')
              .in('id', collabOwnerIds)
          : { data: [] };

        const ownerMap = new Map((ownerProfiles || []).map(p => [p.id, p.display_name]));

        // Build collaborator map per trip
        const collabMap = new Map<string, TripCollaboratorInfo[]>();
        (allCollaborators || []).forEach((c: any) => {
          const list = collabMap.get(c.trip_id) || [];
          if (c.profile) {
            list.push({
              id: c.profile.id,
              display_name: c.profile.display_name,
              avatar_url: c.profile.avatar_url,
              handle: c.profile.handle,
            });
          }
          collabMap.set(c.trip_id, list);
        });

        // Map owned trips
        const mappedOwned: Trip[] = (ownedData || [])
          .filter(row => !((row.metadata as any)?.splitIntoJourney))
          .map(row => ({
          id: row.id,
          destination: row.destination,
          name: row.name,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status as TripStatus,
          travelers: row.travelers || 1,
          departureCity: row.origin_city,
          flightSelection: row.flight_selection,
          hotelSelection: row.hotel_selection,
          metadata: row.metadata as Record<string, any> | null,
          hasItineraryData: row.itinerary_status === 'ready' || row.itinerary_status === 'partial',
          itineraryStatus: row.itinerary_status as string | null,
          isPaid: (row.metadata as Record<string, any>)?.is_paid || row.status === 'booked' || false,
          isCollaborator: false,
          collaborators: collabMap.get(row.id) || [],
          journeyId: (row as any).journey_id || null,
          journeyName: (row as any).journey_name || null,
          journeyOrder: (row as any).journey_order || null,
          journeyTotalLegs: (row as any).journey_total_legs || null,
          transitionMode: (row as any).transition_mode || null,
        }));

        // Map collab trips (exclude any already owned)
        const ownedIdSet = new Set(ownedIds);
        const mappedCollab: Trip[] = (collabData || [])
          .filter(c => (c.trip as any)?.id && !ownedIdSet.has((c.trip as any).id))
          .map(c => {
            const row = c.trip as any;
            return {
              id: row.id,
              destination: row.destination,
              name: row.name,
              startDate: row.start_date,
              endDate: row.end_date,
              status: row.status as TripStatus,
              travelers: row.travelers || 1,
              departureCity: row.origin_city,
              flightSelection: row.flight_selection,
              hotelSelection: row.hotel_selection,
              metadata: row.metadata as Record<string, any> | null,
              hasItineraryData: row.itinerary_status === 'ready' || row.itinerary_status === 'partial',
              itineraryStatus: row.itinerary_status as string | null,
              isPaid: false,
              isCollaborator: true,
              ownerName: ownerMap.get(row.user_id) || null,
              collaborators: collabMap.get(row.id) || [],
              journeyId: row.journey_id || null,
              journeyName: row.journey_name || null,
              journeyOrder: row.journey_order || null,
              journeyTotalLegs: row.journey_total_legs || null,
              transitionMode: row.transition_mode || null,
            };
          });

        setTrips([...mappedOwned, ...mappedCollab]);
      } catch (err: any) {
        console.error('Failed to load trips:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTrips();
  }, [isAuthenticated, user?.id]);

  // =========================================================================
  // REALTIME: Listen for trip_collaborators changes so guests see deletions
  // =========================================================================
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const channel = supabase
      .channel('dashboard-collab-changes')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'trip_collaborators',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const deletedTripId = (payload.old as any)?.trip_id;
          if (deletedTripId) {
            setTrips(prev => prev.filter(t => t.id !== deletedTripId));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_collaborators',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // New collaboration — reload trips to pick it up
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id]);

  // =========================================================================
  // WELCOME-BACK NOTIFICATION: Show toast when user returns and their
  // itinerary has progressed, completed, or is partially done
  // =========================================================================
  useEffect(() => {
    if (!trips.length) return;

    // Find the most recently updated trip that's in a notable generation state
    const generatingTrips = trips.filter(t =>
      t.itineraryStatus === 'ready' ||
      t.itineraryStatus === 'generating' ||
      t.itineraryStatus === 'partial'
    );

    if (!generatingTrips.length) return;

    // Only show once per session
    const shownKey = 'voyance_welcome_back_shown';
    const alreadyShown = sessionStorage.getItem(shownKey);
    if (alreadyShown) return;

    const trip = generatingTrips[0]; // Most recently updated
    const meta = trip.metadata || {};
    const completedDays = (meta as any)?.generation_completed_days || 0;
    const totalDays = (meta as any)?.generation_total_days || 0;
    const completedAt = (meta as any)?.generation_completed_at;

    // Only show if generation completed while user was away (within last 24h)
    if (trip.itineraryStatus === 'ready' && completedAt) {
      const completedTime = new Date(completedAt).getTime();
      const hoursSinceComplete = (Date.now() - completedTime) / (1000 * 60 * 60);
      if (hoursSinceComplete < 24) {
        sessionStorage.setItem(shownKey, 'true');
        toast.success(
          `Your ${trip.destination || trip.name} itinerary is ready! 🎉`,
          {
            action: {
              label: 'View Itinerary',
              onClick: () => navigate(`/trip/${trip.id}`),
            },
            duration: 10000,
          }
        );
        return;
      }
    }

    if (trip.itineraryStatus === 'generating' && completedDays > 0) {
      sessionStorage.setItem(shownKey, 'true');
      toast.info(
        `Your ${trip.destination || trip.name} itinerary: ${completedDays} of ${totalDays} days ready`,
        {
          action: {
            label: 'Check Progress',
            onClick: () => navigate(`/trip/${trip.id}`),
          },
          duration: 8000,
        }
      );
      return;
    }

    if (trip.itineraryStatus === 'partial' && completedDays > 0) {
      sessionStorage.setItem(shownKey, 'true');
      toast.warning(
        `Your ${trip.destination || trip.name} itinerary paused at Day ${completedDays}/${totalDays}`,
        {
          action: {
            label: 'Resume',
            onClick: () => navigate(`/trip/${trip.id}`),
          },
          duration: 10000,
        }
      );
    }
  }, [trips, navigate]);

   // Handle trip deletion - remove from local state
   const handleTripDelete = useCallback((tripId: string) => {
     setTrips(prev => prev.filter(t => t.id !== tripId));
   }, []);

   // Handle journey deletion - remove all legs from local state
   const handleJourneyDelete = useCallback((tripIds: string[]) => {
     const idSet = new Set(tripIds);
     setTrips(prev => prev.filter(t => !idSet.has(t.id)));
   }, []);

  // Simplified filtering - drafts are now included in "upcoming"
  const filterTrips = (tab: TabValue): Trip[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (tab) {
      case 'active':
        // Currently happening trips
        return trips.filter(t => {
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          if (!t.startDate || !t.endDate) return false;
          const start = parseLocalDate(t.startDate);
          const end = parseLocalDate(t.endDate);
          return start <= today && end >= today;
        });
      case 'upcoming': 
        // All future trips regardless of status (draft, planning, booked)
        return trips.filter(t => {
          // Exclude completed/cancelled
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          // Exclude past trips
          if (t.endDate && parseLocalDate(t.endDate) < today) return false;
          // Exclude currently active trips (they have their own section)
          if (t.startDate && t.endDate) {
            const start = parseLocalDate(t.startDate);
            const end = parseLocalDate(t.endDate);
            if (start <= today && end >= today) return false;
          }
          return true;
        });
      case 'completed': 
        return trips.filter(t => 
          t.status === 'completed' || 
          (t.endDate && parseLocalDate(t.endDate) < today)
        );
      default: 
        return trips;
    }
  };

  const filteredTrips = filterTrips(activeTab);
  const activeCount = filterTrips('active').length;
  const upcomingCount = filterTrips('upcoming').length;
  const completedCount = filterTrips('completed').length;
  const activeTrips = filterTrips('active');

  // Build renderable items: journey groups + standalone trips, sorted by date
  type RenderItem = 
    | { type: 'journey'; journeyId: string; journeyName: string; trips: Trip[]; sortDate: string }
    | { type: 'standalone'; trip: Trip; sortDate: string };

  const renderItems = useMemo((): RenderItem[] => {
    const journeyMap = new Map<string, Trip[]>();
    const standalone: Trip[] = [];

    filteredTrips.forEach(trip => {
      if (trip.journeyId) {
        const list = journeyMap.get(trip.journeyId) || [];
        list.push(trip);
        journeyMap.set(trip.journeyId, list);
      } else {
        standalone.push(trip);
      }
    });

    const items: RenderItem[] = [];

    // Add journey groups
    journeyMap.forEach((trips, journeyId) => {
      const sorted = trips.sort((a, b) => (a.journeyOrder || 0) - (b.journeyOrder || 0));
      const firstDate = sorted[0]?.startDate || '9999-12-31';
      items.push({
        type: 'journey',
        journeyId,
        journeyName: sorted[0]?.journeyName || 'Multi-City Journey',
        trips: sorted,
        sortDate: firstDate,
      });
    });

    // Add standalone trips
    standalone.forEach(trip => {
      items.push({
        type: 'standalone',
        trip,
        sortDate: trip.startDate || '9999-12-31',
      });
    });

    // Sort by date (most recent first for upcoming, chronological for completed)
    items.sort((a, b) => b.sortDate.localeCompare(a.sortDate));

    return items;
  }, [filteredTrips]);

  const hasJourneys = renderItems.some(item => item.type === 'journey');

  // Group trips by destination (legacy grouping for non-journey trips)
  const groupedTrips = useMemo(() => {
    const groups: Record<string, TripGroup> = {};
    
    filteredTrips.forEach(trip => {
      const baseDestination = getBaseDestination(trip.destination);
      const region = getRegion(trip.destination);
      
      if (!groups[baseDestination]) {
        groups[baseDestination] = {
          key: baseDestination,
          label: baseDestination,
          trips: [],
          region,
        };
      }
      groups[baseDestination].trips.push(trip);
    });

    // Sort groups: multi-trip groups first, then alphabetically
    return Object.values(groups).sort((a, b) => {
      if (a.trips.length > 1 && b.trips.length <= 1) return -1;
      if (b.trips.length > 1 && a.trips.length <= 1) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [filteredTrips]);

  // Check if we should show grouped view (when there are destination duplicates)
  const hasMultipleSameDestination = groupedTrips.some(g => g.trips.length > 1);

  // Auto-expand groups with multiple trips on first load
  useEffect(() => {
    if (hasMultipleSameDestination && expandedGroups.size === 0) {
      const multiGroups = groupedTrips.filter(g => g.trips.length > 1).map(g => g.key);
      setExpandedGroups(new Set(multiGroups));
    }
  }, [groupedTrips, hasMultipleSameDestination]);

  return (
    <MainLayout>
      <Head title="My Trips | Voyance" description="Manage your travel adventures and plan new trips." />
      
      <section className="pt-24 pb-20 min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10"
          >
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-bold mb-2 tracking-tight">
                My Trips
              </h1>
              <p className="text-muted-foreground text-lg">
                {trips.length > 0 
                  ? `${trips.length} adventure${trips.length > 1 ? 's' : ''} in your collection`
                  : 'Your travel adventures start here'}
              </p>
              <DraftLimitBanner compact className="mt-2" />
            </div>
            <Button 
              onClick={() => navigate('/start')} 
              size="lg" 
              className="gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Plus className="h-5 w-5" />
              New Trip
            </Button>
          </motion.div>

          {/* Free tier limit banner */}
          <DraftLimitBanner className="mb-6" />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <TabsList className="bg-card border border-border p-1 h-auto flex-wrap">
                <TabsTrigger value="all" className="gap-2 px-4 py-2.5">
                  All
                  {trips.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{trips.length}</Badge>
                  )}
                </TabsTrigger>
                {activeCount > 0 && (
                  <TabsTrigger value="active" className="gap-2 px-4 py-2.5">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 font-medium">Live Now</span>
                    <Badge className="bg-green-500 text-white border-0 text-xs">{activeCount}</Badge>
                  </TabsTrigger>
                )}
                <TabsTrigger value="upcoming" className="gap-2 px-4 py-2.5">
                  <Clock className="h-4 w-4" />
                  Upcoming
                  {upcomingCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{upcomingCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2 px-4 py-2.5">
                  <CheckCircle className="h-4 w-4" />
                  Past
                  {completedCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{completedCount}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </motion.div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <Skeleton className="h-52 rounded-none" />
                      <div className="p-5 space-y-3">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </Card>
                  ))}
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-2"
                >
                  {/* If trips fail to load (often because user isn't signed in), still show an enticing empty state */}
                  <EmptyState tab="all" />
                </motion.div>
              ) : trips.length === 0 ? (
                <motion.div key="empty-all">
                  <EmptyState tab="all" />
                </motion.div>
              ) : (
                <>
                  {/* Active Trips Section - Prominent display at top when on 'all' tab */}
                  {activeTab === 'all' && activeTrips.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-8"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <h2 className="font-serif text-xl font-semibold">Happening Now</h2>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {activeTrips.map((trip) => (
                          <ActiveTripCard key={trip.id} trip={trip} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Active Tab Content - When specifically on 'active' tab */}
                  {activeTab === 'active' && (
                    <TabsContent key="active" value="active" className="mt-0">
                      {activeTrips.length > 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-6"
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {activeTrips.map((trip) => (
                              <ActiveTripCard key={trip.id} trip={trip} />
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                        <EmptyState tab={activeTab} />
                      )}
                    </TabsContent>
                  )}

                  {/* Regular Tab Content */}
                  {activeTab !== 'active' && (
                    <TabsContent key={activeTab} value={activeTab} className="mt-0">
                      {filteredTrips.length > 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-6"
                        >
                      {hasJourneys ? (
                        // Journey-aware rendering: journey playlists + standalone cards
                        <>
                          {renderItems.map((item, idx) => {
                            if (item.type === 'journey') {
                              return (
                                <JourneyPlaylist
                                  key={item.journeyId}
                                  journeyName={item.journeyName}
                                  trips={item.trips}
                                  index={idx}
                                  onDeleteJourney={handleJourneyDelete}
                                />
                              );
                            }
                            return (
                              <div key={item.trip.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <TripCard trip={item.trip} index={idx} onDelete={handleTripDelete} isAdmin={isAdmin} onClone={handleCloneTrip} />
                              </div>
                            );
                          })}
                        </>
                      ) : hasMultipleSameDestination ? (
                        // Legacy grouped view
                        groupedTrips.map((group, groupIndex) => (
                          group.trips.length > 1 ? (
                            <Collapsible
                              key={group.key}
                              open={expandedGroups.has(group.key)}
                              onOpenChange={() => toggleGroup(group.key)}
                            >
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: groupIndex * 0.05 }}
                                className="bg-card border border-border rounded-xl overflow-hidden"
                              >
                                <CollapsibleTrigger asChild>
                                  <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <FolderOpen className="h-5 w-5 text-primary" />
                                      </div>
                                      <div className="text-left">
                                        <h3 className="font-semibold text-foreground">{group.label}</h3>
                                        <p className="text-sm text-muted-foreground">
                                          {group.trips.length} trips • {group.region}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs">
                                        {group.trips.length}
                                      </Badge>
                                      {expandedGroups.has(group.key) ? (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                      )}
                                    </div>
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {group.trips.map((trip, i) => (
                                       <TripCard key={trip.id} trip={trip} index={i} onDelete={handleTripDelete} isAdmin={isAdmin} onClone={handleCloneTrip} />
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </motion.div>
                            </Collapsible>
                          ) : (
                            <motion.div
                              key={group.key}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: groupIndex * 0.05 }}
                              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                            >
                               <TripCard trip={group.trips[0]} index={0} onDelete={handleTripDelete} isAdmin={isAdmin} onClone={handleCloneTrip} />
                            </motion.div>
                          )
                        ))
                      ) : (
                        // Flat view when no duplicates
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredTrips.map((trip, i) => (
                             <TripCard key={trip.id} trip={trip} index={i} onDelete={handleTripDelete} isAdmin={isAdmin} onClone={handleCloneTrip} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <EmptyState tab={activeTab} />
                  )}
                </TabsContent>
                  )}
                </>
              )}
            </AnimatePresence>
          </Tabs>

          {/* Bottom CTA for users with trips */}
          {trips.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.5 }} 
              className="mt-16 text-center"
            >
              <div className="inline-flex items-center gap-4 p-6 rounded-2xl bg-card border border-border">
                <Globe className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Ready for your next adventure?</p>
                  <p className="text-sm text-muted-foreground">Discover new destinations tailored to your style</p>
                </div>
                <Button onClick={() => navigate('/explore')} variant="outline" className="gap-2 ml-4">
                  Explore
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
