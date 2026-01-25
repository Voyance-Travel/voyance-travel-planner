import { motion } from 'framer-motion';
import { MapPin, Clock, DollarSign, Info, Star, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Activity } from '@/lib/destinations';

interface ActivityModalProps {
  activity: Activity | null;
  isOpen: boolean;
  onClose: () => void;
  destinationImage?: string;
  destinationName?: string;
  onViewReviews?: (activityName: string, category: string) => void;
}

const categoryColors: Record<string, string> = {
  culture: 'bg-accent/10 text-accent',
  food: 'bg-gold/10 text-gold',
  nature: 'bg-green-500/10 text-green-600',
  adventure: 'bg-orange-500/10 text-orange-600',
  wellness: 'bg-purple-500/10 text-purple-600',
  nightlife: 'bg-pink-500/10 text-pink-600',
};

const priceTierLabels: Record<string, string> = {
  budget: '$',
  moderate: '$$',
  premium: '$$$',
  luxury: '$$$$',
};

export function ActivityModal({ 
  activity, 
  isOpen, 
  onClose, 
  destinationImage,
  destinationName,
  onViewReviews,
}: ActivityModalProps) {
  if (!activity) return null;

  const handleViewReviews = () => {
    if (onViewReviews) {
      onViewReviews(activity.title, activity.category);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Image */}
        <div className="relative h-48 w-full">
          <img 
            src={destinationImage || 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=80'} 
            alt={activity.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <Badge className={categoryColors[activity.category]}>
              {activity.category.charAt(0).toUpperCase() + activity.category.slice(1)}
            </Badge>
          </div>
        </div>

        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="font-serif text-2xl">
              {activity.title}
            </DialogTitle>
          </DialogHeader>

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm text-muted-foreground">
            {activity.neighborhood && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{activity.neighborhood}</span>
              </div>
            )}
            {activity.duration && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{activity.duration}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              <span>{priceTierLabels[activity.priceTier]}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-muted-foreground mb-6 leading-relaxed">
            {activity.description}
          </p>

          {/* What to know */}
          <div className="bg-secondary/50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-accent shrink-0" />
              <div>
                <h4 className="font-medium mb-2">What to know</h4>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  {activity.bestTime && (
                    <li>• Best time to visit: {activity.bestTime}</li>
                  )}
                  <li>• Allow {activity.duration || '1-2 hours'} for this experience</li>
                  <li>• {activity.priceTier === 'budget' || activity.priceTier === 'moderate' 
                    ? 'No reservation typically needed' 
                    : 'Advance booking recommended'}</li>
                  <li>• Comfortable walking shoes suggested</li>
                </ul>
              </div>
            </div>
          </div>

          {/* View Reviews Button */}
          {onViewReviews && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleViewReviews}
            >
              <MessageSquare className="h-4 w-4" />
              View Reviews & Ratings
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
