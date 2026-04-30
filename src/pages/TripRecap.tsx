/**
 * Trip Recap Page
 * Post-trip summary with highlights, photos, stats, and sharing
 */

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  MapPin, Calendar, Users, Star, Heart, Share2, 
  Camera, MessageSquare, ChevronRight, Download,
  Sparkles, ArrowLeft, Plus, BookmarkPlus, Image as ImageIcon,
  ThumbsUp, ThumbsDown, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTrip } from '@/services/supabase/trips';
import { useTripPhotos } from '@/hooks/useTripPhotos';
import { useTripLearning } from '@/services/tripLearningsAPI';
import { TripDebriefModal } from '@/components/trip/TripDebriefModal';
import TripPhotoGallery from '@/components/trip/TripPhotoGallery';
import { TripNotes } from '@/components/post-trip/TripNotes';
import { GoBackList } from '@/components/post-trip/GoBackList';
import { TripStats } from '@/components/post-trip/TripStats';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';

export default function TripRecap() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { data: trip, isLoading: tripLoading } = useTrip(tripId);
  const { photos } = useTripPhotos(tripId || '');
  const { data: learning } = useTripLearning(tripId || '');
  
  const [showDebrief, setShowDebrief] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate trip duration
  const tripDays = trip?.start_date && trip?.end_date
    ? differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1
    : 0;

  // Get cover photo
  const coverPhoto = photos.find(p => p.isCover) || photos[0];

  // Get highlights from learning or itinerary
  const highlights = learning?.highlights || [];

  // Archetype reflection copy based on archetype
  const getArchetypeReflection = () => {
    const archetype = trip?.trip_type?.toLowerCase() || 'traveler';
    const reflections: Record<string, string> = {
      slow_traveler: "You saw less and experienced more. That's the whole point.",
      culinary_cartographer: "Every meal was a destination. That's how you travel.",
      bucket_list_conqueror: "You came, you saw, you checked it off. Mission accomplished.",
      adrenaline_architect: "The rush was real. You lived every moment.",
      romantic_curator: "You found beauty in every corner. That's the gift you have.",
      zen_seeker: "You found your stillness. The rest will follow.",
      default: "Another adventure in the books. The memories are yours forever."
    };
    return reflections[archetype] || reflections.default;
  };

  if (tripLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading your trip memories...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-semibold mb-2">Trip not found</h2>
        <p className="text-muted-foreground mb-4">This trip may have been removed.</p>
        <Link to="/trip/dashboard">
          <Button>Back to Trips</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-[40vh] min-h-[300px] overflow-hidden">
        {/* Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: coverPhoto 
              ? `url(${coverPhoto.publicUrl})` 
              : `linear-gradient(135deg, hsl(var(--primary)/0.8), hsl(var(--primary)/0.4))` 
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        {/* Navigation */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <Link to="/trip/dashboard">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white hover:bg-white/20"
            onClick={async () => {
              const { getOrCreatePublicTripShareLink, getPublicShareErrorMessage } = await import('@/services/publicShareLink');
              const result = await getOrCreatePublicTripShareLink(tripId || '');
              if (!result.success || !result.link) {
                toast.error(getPublicShareErrorMessage(result.reason));
                return;
              }
              const link = result.link;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: `My ${trip.destination} Trip`,
                    text: `Check out my trip to ${trip.destination}! Planned with Voyance.`,
                    url: link,
                  });
                } catch (e) { /* user cancelled */ }
              } else {
                navigator.clipboard.writeText(link);
                toast.success('Public link copied!');
              }
            }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {trip.destination}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {trip.start_date && format(parseISO(trip.start_date), 'MMM d')} - {trip.end_date && format(parseISO(trip.end_date), 'MMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {trip.travelers || 1} traveler{(trip.travelers || 1) > 1 ? 's' : ''}
              </span>
              <span>{tripDays} days</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10 pb-12">
        {/* Create Guide CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-4 flex items-center justify-between"
        >
          <div>
            <p className="font-semibold text-sm text-foreground">Share your trip</p>
            <p className="text-xs text-muted-foreground">Turn this trip into a travel guide for the community</p>
          </div>
          <Button size="sm" onClick={() => navigate(`/guide/create/${tripId}`)}>
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Create Guide
          </Button>
        </motion.div>

        {/* Quick Stats Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border shadow-lg p-6 mb-6"
        >
          <TripStats tripId={tripId || ''} tripDays={tripDays} />
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="next">Next Time</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Highlights Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Your Highlights
                </h2>
                {!learning && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowDebrief(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>

              {highlights.length > 0 ? (
                <div className="space-y-3">
                  {highlights.slice(0, 5).map((h, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="p-2 rounded-full bg-amber-500/10">
                        <Star className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-medium">{h.activity}</p>
                        {h.why && (
                          <p className="text-sm text-muted-foreground">"{h.why}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-3">
                    What were the best parts of your trip?
                  </p>
                  <Button onClick={() => setShowDebrief(true)}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Share Your Highlights
                  </Button>
                </div>
              )}
            </motion.div>

            {/* Travel DNA Reflection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl border p-6"
            >
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Your Travel DNA
              </h3>
              <p className="text-lg mb-2 capitalize">
                {trip.trip_type?.replace(/_/g, ' ') || 'Traveler'}
              </p>
              <p className="text-muted-foreground italic">
                "{getArchetypeReflection()}"
              </p>
            </motion.div>

            {/* Photo Preview */}
            {photos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card rounded-2xl border p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Trip Photos
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveTab('photos')}
                  >
                    View all
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {photos.slice(0, 4).map((photo) => (
                    <div 
                      key={photo.id}
                      className="aspect-square rounded-lg overflow-hidden bg-muted"
                    >
                      <img 
                        src={photo.publicUrl} 
                        alt={photo.caption || 'Trip photo'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Rating & Would Return */}
            {learning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-2 gap-4"
              >
                {learning.overall_rating && (
                  <div className="bg-card rounded-xl border p-4 text-center">
                    <div className="flex justify-center mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            'w-5 h-5',
                            star <= learning.overall_rating!
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted'
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">Your Rating</p>
                  </div>
                )}
                {learning.would_return !== null && (
                  <div className="bg-card rounded-xl border p-4 text-center">
                    <div className="flex justify-center mb-1">
                      {learning.would_return ? (
                        <ThumbsUp className="w-6 h-6 text-primary" />
                      ) : (
                        <ThumbsDown className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {learning.would_return ? "Would return" : "One-time visit"}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </TabsContent>

          {/* Photos Tab */}
          <TabsContent value="photos">
            <TripPhotoGallery tripId={tripId || ''} />
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes">
            <TripNotes tripId={tripId || ''} destination={trip.destination} />
          </TabsContent>

          {/* Next Time Tab */}
          <TabsContent value="next">
            <GoBackList tripId={tripId || ''} destination={trip.destination} />
          </TabsContent>
        </Tabs>

        {/* Bottom Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            {!learning && (
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowDebrief(true)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Share Feedback
              </Button>
            )}
            <Button 
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/trip/${tripId}/travel-guide`)}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Build Travel Guide
            </Button>
            <Button 
              className="flex-1"
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: `My ${trip.destination} Trip`,
                      text: `Check out my trip to ${trip.destination}! Planned with Voyance.`,
                      url: window.location.href,
                    });
                  } catch (e) { /* user cancelled */ }
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Link copied!');
                }
              }}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Trip
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Debrief Modal */}
      <TripDebriefModal
        isOpen={showDebrief}
        onClose={() => setShowDebrief(false)}
        tripId={tripId || ''}
        destination={trip.destination}
        tripName={trip.name}
      />

    </div>
  );
}
