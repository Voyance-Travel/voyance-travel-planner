import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Users, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFriends, type FriendWithProfile } from '@/services/supabase/friends';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface GuestLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxGuests: number;
  currentTravelers: number;
  onGuestsConfirmed?: (guests: LinkedGuest[]) => void;
}

export interface LinkedGuest {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferencesMatch?: number;
  isVoyanceUser?: boolean;
}

export default function GuestLinkModal({
  open,
  onOpenChange,
  maxGuests,
  currentTravelers,
  onGuestsConfirmed,
}: GuestLinkModalProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'invite'>('friends');
  const [email, setEmail] = useState('');
  const [linkedGuests, setLinkedGuests] = useState<LinkedGuest[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  // Fetch approved friends
  const { data: friendsData, isLoading: isLoadingFriends } = useFriends();
  const friends = friendsData || [];

  // Calculate max guests allowed (travelers count minus 1 for the primary traveler)
  const maxLinkedGuests = Math.max(0, currentTravelers - 1);
  const remainingSlots = maxLinkedGuests - linkedGuests.length;

  // Filter out already linked friends
  const availableFriends = friends.filter(
    (f) => !linkedGuests.some((g) => g.id === f.friend.id)
  );

  const handleSelectFriend = (friend: FriendWithProfile) => {
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxLinkedGuests} additional travelers allowed`);
      return;
    }

    const newGuest: LinkedGuest = {
      id: friend.friend.id,
      name: friend.friend.display_name || friend.friend.handle || 'Friend',
      email: '', // Email not exposed for privacy
      avatar: friend.friend.avatar_url || undefined,
      // preferencesMatch calculated when Travel DNA is available for both users
      isVoyanceUser: true,
    };

    setLinkedGuests(prev => [...prev, newGuest]);
    toast.success(`${newGuest.name} added to your trip`);
  };

  const handleInviteByEmail = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxLinkedGuests} additional travelers allowed for a group of ${currentTravelers}`);
      return;
    }

    // Check if email already linked
    if (linkedGuests.some(g => g.email.toLowerCase() === email.toLowerCase())) {
      toast.error('This email is already linked');
      return;
    }

    setIsInviting(true);
    
    // TODO: In production, this would send an actual invite email via edge function
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newGuest: LinkedGuest = {
      id: `email-${Date.now()}`,
      name: email.split('@')[0],
      email,
      isVoyanceUser: false,
    };
    
    setLinkedGuests(prev => [...prev, newGuest]);
    setEmail('');
    setIsInviting(false);
    toast.success(`Invitation will be sent to ${email}`);
  };

  const handleRemoveGuest = (guestId: string) => {
    setLinkedGuests(prev => prev.filter(g => g.id !== guestId));
    toast.info('Guest removed');
  };

  const handleConfirm = () => {
    if (onGuestsConfirmed) {
      onGuestsConfirmed(linkedGuests);
    }
    if (linkedGuests.length > 0) {
      toast.success(`${linkedGuests.length} guest${linkedGuests.length > 1 ? 's' : ''} linked to your trip!`);
    }
    onOpenChange(false);
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setEmail('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Link Travel Companions
          </DialogTitle>
          <DialogDescription>
            Add {maxLinkedGuests > 0 ? `up to ${maxLinkedGuests}` : 'no'} companion{maxLinkedGuests !== 1 ? 's' : ''} from your friends or invite by email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Linked Guests List */}
          {linkedGuests.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Linked guests ({linkedGuests.length}/{maxLinkedGuests})</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {linkedGuests.map((guest) => (
                  <motion.div
                    key={guest.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={guest.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {guest.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{guest.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {guest.isVoyanceUser ? 'Voyance friend' : guest.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {guest.preferencesMatch && guest.isVoyanceUser && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Sparkles className="h-3 w-3" />
                          {guest.preferencesMatch}% match
                        </Badge>
                      )}
                      <button
                        onClick={() => handleRemoveGuest(guest.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {maxLinkedGuests === 0 ? (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                Solo trip selected. Increase travelers to add companions.
              </p>
            </div>
          ) : remainingSlots > 0 ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'friends' | 'invite')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="friends" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  My Friends
                </TabsTrigger>
                <TabsTrigger value="invite" className="gap-1.5">
                  <Mail className="h-4 w-4" />
                  Invite by Email
                </TabsTrigger>
              </TabsList>

              <TabsContent value="friends" className="space-y-3 pt-3">
                <div className="border border-border rounded-lg overflow-hidden">
                  {isLoadingFriends ? (
                    <div className="h-40 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : availableFriends.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto">
                      {availableFriends.map((friendship) => (
                        <button
                          key={friendship.id}
                          onClick={() => handleSelectFriend(friendship)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={friendship.friend.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {(friendship.friend.display_name || friendship.friend.handle || 'F').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {friendship.friend.display_name || friendship.friend.handle || 'Friend'}
                            </p>
                            {friendship.friend.handle && (
                              <p className="text-xs text-muted-foreground">@{friendship.friend.handle}</p>
                            )}
                          </div>
                          <UserPlus className="h-4 w-4 text-primary flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : friends.length === 0 ? (
                    <div className="h-40 flex items-center justify-center">
                      <div className="text-center text-muted-foreground px-4">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">No friends yet</p>
                        <p className="text-xs mt-1">Add friends from your profile to invite them to trips</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Check className="h-8 w-8 mx-auto mb-2 text-primary opacity-70" />
                        <p className="text-sm">All friends already added</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="invite" className="space-y-3 pt-3">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="friend@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInviteByEmail()}
                    className="flex-1"
                  />
                  <Button onClick={handleInviteByEmail} disabled={isInviting || !email}>
                    {isInviting ? 'Sending...' : 'Invite'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  They'll receive an email invitation to join your trip. If they create a Voyance account, their preferences will be matched automatically.
                </p>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                All {maxLinkedGuests} companion slots filled
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {remainingSlots > 0 
                ? `${remainingSlots} spot${remainingSlots !== 1 ? 's' : ''} remaining` 
                : maxLinkedGuests === 0 
                  ? 'Solo trip' 
                  : 'All spots filled'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>
                {linkedGuests.length > 0 ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5" />
                    Confirm ({linkedGuests.length})
                  </>
                ) : (
                  'Done'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
