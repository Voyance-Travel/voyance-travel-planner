/**
 * GuestLinker — Pick friends to add as trip collaborators during trip creation.
 * Shows accepted friends with avatars; selected friends will be inserted as
 * trip_collaborators right after the trip row is created.
 */

import { useState } from 'react';
import { UserPlus, X, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFriends, type Friend } from '@/services/friendsAPI';
import { cn } from '@/lib/utils';

export interface SelectedGuest {
  userId: string;
  name: string;
  avatar?: string;
}

interface GuestLinkerProps {
  selectedGuests: SelectedGuest[];
  onGuestsChange: (guests: SelectedGuest[]) => void;
  maxGuests?: number;
  className?: string;
}

export default function GuestLinker({
  selectedGuests,
  onGuestsChange,
  maxGuests = 9,
  className,
}: GuestLinkerProps) {
  const { data: friendsData, isLoading } = useFriends();
  const [isOpen, setIsOpen] = useState(false);

  const acceptedFriends = (friendsData?.friends ?? []).filter(
    (f) => f.status === 'accepted'
  );

  if (acceptedFriends.length === 0 && !isLoading) return null;

  const toggleGuest = (friend: Friend) => {
    const already = selectedGuests.find((g) => g.userId === friend.userId);
    if (already) {
      onGuestsChange(selectedGuests.filter((g) => g.userId !== friend.userId));
    } else if (selectedGuests.length < maxGuests) {
      onGuestsChange([
        ...selectedGuests,
        {
          userId: friend.userId,
          name: friend.name || friend.username,
          avatar: friend.avatar,
        },
      ]);
    }
  };

  const removeGuest = (userId: string) => {
    onGuestsChange(selectedGuests.filter((g) => g.userId !== userId));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>
              {selectedGuests.length > 0
                ? `${selectedGuests.length} friend${selectedGuests.length > 1 ? 's' : ''} linked`
                : 'Link friends to this trip'}
            </span>
            {isOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading friends…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {acceptedFriends.map((friend) => {
                const isSelected = selectedGuests.some(
                  (g) => g.userId === friend.userId
                );
                return (
                  <button
                    key={friend.userId}
                    type="button"
                    onClick={() => toggleGuest(friend)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-all min-h-[36px]',
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={friend.avatar} />
                      <AvatarFallback className="text-[8px]">
                        {(friend.name || friend.username || '?')
                          .charAt(0)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {friend.name || friend.username}
                    {isSelected && <X className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          )}

          {acceptedFriends.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Their travel DNA will blend into your itinerary
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Compact selected pills when collapsed */}
      {!isOpen && selectedGuests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedGuests.map((g) => (
            <Badge
              key={g.userId}
              variant="secondary"
              className="gap-1 pr-1 text-[10px]"
            >
              <Avatar className="h-4 w-4">
                <AvatarImage src={g.avatar} />
                <AvatarFallback className="text-[7px]">
                  {g.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {g.name}
              <button
                type="button"
                onClick={() => removeGuest(g.userId)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
