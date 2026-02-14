/**
 * Memory Lane Component
 * Displays past trip reviews with ratings and learnings
 */

import { motion } from 'framer-motion';
import { 
  Calendar, 
  Camera, 
  Star, 
  Heart, 
  MapPin, 
  Edit3,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MessageSquare,
  BookOpen
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';

interface TripMemory {
  id: string;
  name: string;
  destination: string;
  destination_country?: string;
  start_date: string;
  end_date: string;
  status: string;
  metadata?: {
    tagline?: string;
    imageUrl?: string;
    overallRating?: number;
    experience?: {
      accommodation?: number;
      food?: number;
      activities?: number;
      transportation?: number;
    };
    highlights?: string[];
    notes?: string;
    wouldRecommend?: boolean;
    learnings?: string[];
  };
}

interface MemoryLaneProps {
  className?: string;
}

const StarRating = ({ 
  rating, 
  onRate, 
  readonly = false,
}: { 
  rating: number; 
  onRate?: (rating: number) => void; 
  readonly?: boolean;
}) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !readonly && onRate?.(star)}
          disabled={readonly}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
        >
          <Star 
            className={`w-4 h-4 ${
              star <= rating 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-muted-foreground/30'
            }`} 
          />
        </button>
      ))}
    </div>
  );
};

const MemoryCard = ({ memory, onUpdate }: { memory: TripMemory; onUpdate: () => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState(memory.metadata || {});
  const [saving, setSaving] = useState(false);

  const tripDuration = () => {
    const start = parseLocalDate(memory.start_date);
    const end = parseLocalDate(memory.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('trips')
        .update({ metadata: editedMetadata })
        .eq('id', memory.id);
      
      if (error) throw error;
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error('Error saving memory:', err);
    } finally {
      setSaving(false);
    }
  };

  const metadata = memory.metadata || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden hover:shadow-lg transition-all"
    >
      {/* Image header */}
      <div className="relative h-48 bg-gradient-to-br from-muted to-muted/50">
        {metadata.imageUrl ? (
          <img 
            src={metadata.imageUrl} 
            alt={memory.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <MapPin className="w-12 h-12 text-primary/50" />
          </div>
        )}
        
        {/* Rating overlay */}
        {metadata.overallRating && (
          <div className="absolute top-3 right-3 bg-background/90 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium text-foreground">{metadata.overallRating}/5</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="absolute top-3 left-3 flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="bg-background/90 backdrop-blur p-2 rounded-full hover:bg-background transition-colors"
          >
            <Edit3 className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-light text-foreground mb-1">{memory.name}</h3>
          <p className="text-sm text-muted-foreground">{memory.destination}{memory.destination_country ? `, ${memory.destination_country}` : ''}</p>
          {metadata.tagline && (
            <p className="text-sm text-muted-foreground italic mt-1">&ldquo;{metadata.tagline}&rdquo;</p>
          )}
        </div>

        {/* Trip details */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(parseLocalDate(memory.start_date), 'MMM yyyy')} • {tripDuration()}</span>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-6">
            {/* Rating categories */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-foreground mb-2">Overall Rating</span>
                <StarRating
                  rating={editedMetadata.overallRating || 0}
                  onRate={(rating) => setEditedMetadata({
                    ...editedMetadata,
                    overallRating: rating
                  })}
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-foreground mb-2">Accommodation</span>
                <StarRating 
                  rating={editedMetadata.experience?.accommodation || 0}
                  onRate={(rating) => setEditedMetadata({
                    ...editedMetadata,
                    experience: { ...editedMetadata.experience, accommodation: rating }
                  })}
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-foreground mb-2">Food & Dining</span>
                <StarRating 
                  rating={editedMetadata.experience?.food || 0}
                  onRate={(rating) => setEditedMetadata({
                    ...editedMetadata,
                    experience: { ...editedMetadata.experience, food: rating }
                  })}
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-foreground mb-2">Activities</span>
                <StarRating 
                  rating={editedMetadata.experience?.activities || 0}
                  onRate={(rating) => setEditedMetadata({
                    ...editedMetadata,
                    experience: { ...editedMetadata.experience, activities: rating }
                  })}
                />
              </div>
            </div>

            {/* Tagline */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Trip Tagline</label>
              <input
                type="text"
                value={editedMetadata.tagline || ''}
                onChange={(e) => setEditedMetadata({ ...editedMetadata, tagline: e.target.value })}
                placeholder="Sum up your trip in a few words..."
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Favorite Memory</label>
              <textarea
                value={editedMetadata.notes || ''}
                onChange={(e) => setEditedMetadata({ ...editedMetadata, notes: e.target.value })}
                placeholder="What was your favorite moment from this trip?"
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
              />
            </div>

            {/* Would recommend */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editedMetadata.wouldRecommend || false}
                onChange={(e) => setEditedMetadata({ ...editedMetadata, wouldRecommend: e.target.checked })}
                className="w-4 h-4 text-primary rounded focus:ring-primary"
              />
              <span className="text-sm text-foreground">I would recommend this destination</span>
            </label>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Review'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedMetadata(memory.metadata || {});
                }}
                className="flex-1 bg-muted text-foreground py-2 px-4 rounded-lg hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overall experience */}
            {metadata.experience && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {metadata.experience.accommodation && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Accommodation</span>
                    <StarRating rating={metadata.experience.accommodation} readonly />
                  </div>
                )}
                {metadata.experience.food && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Food & Dining</span>
                    <StarRating rating={metadata.experience.food} readonly />
                  </div>
                )}
                {metadata.experience.activities && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Activities</span>
                    <StarRating rating={metadata.experience.activities} readonly />
                  </div>
                )}
              </div>
            )}

            {/* Highlights */}
            {metadata.highlights && metadata.highlights.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Trip Highlights</h4>
                <div className="flex flex-wrap gap-2">
                  {metadata.highlights.map((highlight, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Personal note */}
            {metadata.notes && (
              <div className="p-4 bg-muted rounded-xl">
                <h4 className="text-sm font-medium text-foreground mb-2">Favorite Memory</h4>
                <p className="text-sm text-muted-foreground italic">&ldquo;{metadata.notes}&rdquo;</p>
              </div>
            )}

            {/* System Learnings */}
            {metadata.learnings && metadata.learnings.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  What We Learned About Your Preferences
                </h4>
                <ul className="space-y-1">
                  {metadata.learnings.map((learning, index) => (
                    <li key={index} className="text-sm text-blue-700 dark:text-blue-400 flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>{learning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendation */}
            {metadata.wouldRecommend !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <Heart className={`w-4 h-4 ${metadata.wouldRecommend ? 'fill-red-400 text-red-400' : 'text-muted-foreground'}`} />
                <span className="text-muted-foreground">
                  {metadata.wouldRecommend ? 'Would recommend to others' : 'Mixed feelings about this trip'}
                </span>
              </div>
            )}

            {/* Prompt to add review if no data */}
            {!metadata.overallRating && !metadata.notes && (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                + Add your trip review
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function MemoryLane({ className = '' }: MemoryLaneProps) {
  const { user } = useAuth();
  const [memories, setMemories] = useState<TripMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerView = 2;

  const loadMemories = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('id, name, destination, destination_country, start_date, end_date, status, metadata')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('end_date', { ascending: false });
      
      if (error) throw error;
      setMemories((data || []) as TripMemory[]);
    } catch (err) {
      console.error('Error loading memories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, [user?.id]);

  const maxIndex = Math.max(0, memories.length - itemsPerView);

  const nextSlide = () => {
    setCurrentIndex(prev => Math.min(prev + 1, maxIndex));
  };

  const prevSlide = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  };

  if (loading) {
    return (
      <div className={`space-y-8 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-light text-foreground mb-2">Memory Lane</h3>
            <p className="text-muted-foreground">Loading your past adventures...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2].map(i => (
            <div key={i} className="bg-card rounded-2xl h-96 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-light text-foreground mb-2">Memory Lane</h3>
          <p className="text-muted-foreground">
            Rate your experiences to help us learn your preferences
          </p>
        </div>
        
        {memories.length > itemsPerView && (
          <div className="flex items-center gap-2">
            <button
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentIndex >= maxIndex}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Memory cards */}
      {memories.length > 0 ? (
        <div className="overflow-hidden">
          <motion.div
            className="flex gap-8"
            animate={{ x: -currentIndex * (100 / itemsPerView) + '%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ width: `${Math.max(1, memories.length / itemsPerView) * 100}%` }}
          >
            {memories.map((memory) => (
              <div key={memory.id} style={{ flex: `0 0 ${100 / Math.max(itemsPerView, memories.length)}%` }}>
                <MemoryCard memory={memory} onUpdate={loadMemories} />
              </div>
            ))}
          </motion.div>
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/50 rounded-2xl">
          <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-lg font-medium text-foreground mb-2">No memories yet</h4>
          <p className="text-muted-foreground">Complete your first trip to start building your memory lane</p>
        </div>
      )}
    </div>
  );
}
