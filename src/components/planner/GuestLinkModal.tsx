import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Users, Search, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useUsersSearch, type UserSearchResult } from '@/services/usersSearchAPI';
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

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function GuestLinkModal({
  open,
  onOpenChange,
  maxGuests,
  currentTravelers,
  onGuestsConfirmed,
}: GuestLinkModalProps) {
  const [activeTab, setActiveTab] = useState<'invite' | 'search'>('invite');
  const [email, setEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedGuests, setLinkedGuests] = useState<LinkedGuest[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  // Calculate max guests allowed (travelers count minus 1 for the primary traveler)
  const maxLinkedGuests = Math.max(0, currentTravelers - 1);
  const remainingSlots = maxLinkedGuests - linkedGuests.length;

  // Debounced search query for API
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: searchResults, isLoading: isSearching } = useUsersSearch(debouncedSearch, open);

  // Filter out already linked guests from search results
  const filteredResults = (searchResults || []).filter(
    (user) => !linkedGuests.some((g) => g.id === user.id)
  );

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
    
    // TODO: In production, this would send an actual invite email
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

  const handleSelectUser = (user: UserSearchResult) => {
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxLinkedGuests} additional travelers allowed`);
      return;
    }

    const newGuest: LinkedGuest = {
      id: user.id,
      name: user.name,
      email: user.email || '',
      avatar: user.avatar,
      preferencesMatch: Math.floor(Math.random() * 30) + 70, // TODO: Calculate from actual preferences
      isVoyanceUser: true,
    };

    setLinkedGuests(prev => [...prev, newGuest]);
    setSearchQuery('');
    toast.success(`${user.name} linked to your trip`);
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
      setSearchQuery('');
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
            Invite {maxLinkedGuests > 0 ? `up to ${maxLinkedGuests}` : 'no'} additional traveler{maxLinkedGuests !== 1 ? 's' : ''} for your group of {currentTravelers}.
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
                          {guest.isVoyanceUser ? 'Voyance member' : guest.email}
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
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'invite' | 'search')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invite" className="gap-1.5">
                  <Mail className="h-4 w-4" />
                  Invite by Email
                </TabsTrigger>
                <TabsTrigger value="search" className="gap-1.5">
                  <Search className="h-4 w-4" />
                  Search Voyance
                </TabsTrigger>
              </TabsList>

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
                  They'll receive an email to join your trip. If they have a Voyance account, their preferences will be matched.
                </p>
              </TabsContent>

              <TabsContent value="search" className="space-y-3 pt-3">
                <Input
                  placeholder="Search by name or handle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="border border-border rounded-lg overflow-hidden">
                  {isSearching ? (
                    <div className="h-32 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredResults.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto">
                      {filteredResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            {user.username && (
                              <p className="text-xs text-muted-foreground">@{user.username}</p>
                            )}
                          </div>
                          <UserPlus className="h-4 w-4 text-primary flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : searchQuery.length >= 2 ? (
                    <div className="h-32 flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No users found</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Search for Voyance users</p>
                        <p className="text-xs">Type at least 2 characters</p>
                      </div>
                    </div>
                  )}
                </div>
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
