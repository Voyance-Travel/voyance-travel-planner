/**
 * NewMemberSuggestionsCard
 * 
 * Appears inline after a new member is added to a trip.
 * Shows existing activities that align with the newcomer's interests
 * and offers to add personalized activities for them.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, UserPlus, Check, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCollaboratorColor, COLLABORATOR_COLORS } from '@/utils/collaboratorAttribution';
import type { EditorialDay } from './EditorialItinerary';

interface NewMemberSuggestionsCardProps {
  memberName: string;
  days: EditorialDay[];
  colorIndex?: number;
  onAddActivities?: () => void;
  onDismiss: () => void;
}

/** 
 * Find activities that might match the newcomer's interests 
 * by looking at activity tags/categories across all days 
 */
function findMatchingActivities(days: EditorialDay[]) {
  const matches: Array<{ dayNumber: number; activityName: string; category?: string }> = [];
  
  for (const day of days) {
    for (const activity of day.activities) {
      if (activity.personalization?.tags?.length || activity.category) {
        matches.push({
          dayNumber: day.dayNumber,
          activityName: activity.title,
          category: activity.category,
        });
      }
    }
  }
  
  // Return up to 5 matching activities
  return matches.slice(0, 5);
}

export function NewMemberSuggestionsCard({
  memberName,
  days,
  colorIndex = 1,
  onAddActivities,
  onDismiss,
}: NewMemberSuggestionsCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const color = getCollaboratorColor(colorIndex);
  const matchingActivities = findMatchingActivities(days);

  const handleAdd = () => {
    setIsAdding(true);
    onAddActivities?.();
    // Auto-dismiss after a beat
    setTimeout(() => onDismiss(), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -12, height: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Card className="border-primary/20 bg-primary/5 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                <h4 className="text-sm font-semibold text-foreground">
                  Activities {memberName} will love
                </h4>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  New
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={onDismiss}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Matching activities from existing itinerary */}
            {matchingActivities.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  These existing activities already match {memberName}'s interests:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchingActivities.map((match, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[11px] gap-1 bg-background/60"
                    >
                      <div className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
                      Day {match.dayNumber}: {match.activityName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleAdd}
                disabled={isAdding}
              >
                {isAdding ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    Add activities for {memberName}
                    <ChevronRight className="h-3 w-3" />
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-8"
                onClick={onDismiss}
              >
                Maybe later
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
