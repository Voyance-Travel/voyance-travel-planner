/**
 * GuestLinkModal — Link travel companions during trip creation.
 * 
 * Features:
 * - Select from existing friends list
 * - Invite new people by email
 * - Per-guest permission control (view / edit)
 * - DNA blend toggle per guest
 * - Compatibility score display
 * - Guests must have an account to view the itinerary
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus, Mail, Users, Check, X, Sparkles, Loader2,
  Dna, Eye, Pencil, Shield, Info,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useFriends, type FriendWithProfile } from '@/services/supabase/friends';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { calculateGuestCompatibility } from '@/utils/travelDNACompatibility';
import type { CollaboratorPermission } from '@/services/tripCollaboratorsAPI';

// ============================================================================
// TYPES
// ============================================================================

export interface LinkedGuest {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferencesMatch?: number;
  isVoyanceUser?: boolean;
  permission: CollaboratorPermission;
  includePreferences: boolean;
}

interface GuestLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxGuests: number;
  currentTravelers: number;
  /** Called when user confirms selections */
  onGuestsConfirmed?: (guests: LinkedGuest[]) => void;
  /** Pre-populate from previous selection */
  initialGuests?: LinkedGuest[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function GuestLinkModal({
  open,
  onOpenChange,
  maxGuests,
  currentTravelers,
  onGuestsConfirmed,
  initialGuests,
}: GuestLinkModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'friends' | 'invite'>('friends');
  const [email, setEmail] = useState('');
  const [linkedGuests, setLinkedGuests] = useState<LinkedGuest[]>(initialGuests || []);
  const [isInviting, setIsInviting] = useState(false);
  const [compatibilityScores, setCompatibilityScores] = useState<Record<string, number | null>>({});

  // Fetch approved friends
  const { data: friendsData, isLoading: isLoadingFriends } = useFriends();
  const friends = friendsData || [];

  const suggestedSlots = Math.max(0, currentTravelers - 1);
  const isOverSuggested = linkedGuests.length >= suggestedSlots;
  // No hard cap — allow adding beyond traveler count (count auto-adjusts)
  const remainingSlots = Infinity;

  const availableFriends = friends.filter(
    (f) => !linkedGuests.some((g) => g.id === f.friend.id)
  );

  // Sync initial guests when modal opens
  useEffect(() => {
    if (open && initialGuests) {
      setLinkedGuests(initialGuests);
    }
  }, [open]);

  // Calculate compatibility scores
  useEffect(() => {
    if (!open || !user?.id || friends.length === 0) return;

    const calculateScores = async () => {
      const scores: Record<string, number | null> = {};
      await Promise.all(
        friends.map(async (friend) => {
          const score = await calculateGuestCompatibility(user.id, friend.friend.id);
          scores[friend.friend.id] = score;
        })
      );
      setCompatibilityScores(scores);
    };
    calculateScores();
  }, [open, user?.id, friends]);

  const handleSelectFriend = useCallback(async (friend: FriendWithProfile) => {

    let matchScore = compatibilityScores[friend.friend.id];
    if (matchScore === undefined && user?.id) {
      matchScore = await calculateGuestCompatibility(user.id, friend.friend.id);
    }

    const newGuest: LinkedGuest = {
      id: friend.friend.id,
      name: friend.friend.display_name || friend.friend.handle || 'Friend',
      email: '',
      avatar: friend.friend.avatar_url || undefined,
      preferencesMatch: matchScore ?? undefined,
      isVoyanceUser: true,
      permission: 'edit',
      includePreferences: true,
    };

    setLinkedGuests((prev) => [...prev, newGuest]);
    toast.success(`${newGuest.name} added`);
  }, [compatibilityScores, user?.id]);

  const handleInviteByEmail = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (linkedGuests.some((g) => g.email.toLowerCase() === email.toLowerCase())) {
      toast.error('This email is already linked');
      return;
    }

    setIsInviting(true);
    // TODO: Send actual invite via edge function
    await new Promise((r) => setTimeout(r, 400));

    const newGuest: LinkedGuest = {
      id: `email-${Date.now()}`,
      name: email.split('@')[0],
      email,
      isVoyanceUser: false,
      permission: 'edit',
      includePreferences: false, // Can't blend DNA for non-users
    };

    setLinkedGuests((prev) => [...prev, newGuest]);
    setEmail('');
    setIsInviting(false);
    toast.success(`Invitation will be sent to ${email}`);
  };

  const handleRemoveGuest = (guestId: string) => {
    setLinkedGuests((prev) => prev.filter((g) => g.id !== guestId));
  };

  const updateGuestPermission = (guestId: string, permission: CollaboratorPermission) => {
    setLinkedGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, permission } : g))
    );
  };

  const updateGuestDNA = (guestId: string, includePreferences: boolean) => {
    setLinkedGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, includePreferences } : g))
    );
  };

  const handleConfirm = () => {
    onGuestsConfirmed?.(linkedGuests);
    if (linkedGuests.length > 0) {
      toast.success(`${linkedGuests.length} companion${linkedGuests.length > 1 ? 's' : ''} linked!`);
    }
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) setEmail('');
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
            {suggestedSlots > 0
              ? `${suggestedSlots} companion spot${suggestedSlots !== 1 ? 's' : ''} based on your traveler count. Add more and we'll adjust automatically.`
              : 'Add companions and the traveler count will adjust automatically.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Linked guests with controls ── */}
          {linkedGuests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Linked ({linkedGuests.length}{suggestedSlots > 0 ? `/${suggestedSlots} suggested` : ''})
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {linkedGuests.map((guest) => (
                  <motion.div
                    key={guest.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-muted/50 rounded-lg border border-border space-y-2"
                  >
                    {/* Row 1: Avatar + name + remove */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={guest.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                            {guest.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-tight">{guest.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {guest.isVoyanceUser ? 'Voyance friend' : guest.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {guest.preferencesMatch != null && guest.isVoyanceUser && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Sparkles className="h-3 w-3" />
                            {guest.preferencesMatch}%
                          </Badge>
                        )}
                        <button
                          onClick={() => handleRemoveGuest(guest.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Permission + DNA blend */}
                    <div className="flex items-center gap-3 pl-10">
                      {/* Permission selector */}
                      <Select
                        value={guest.permission}
                        onValueChange={(v) => updateGuestPermission(guest.id, v as CollaboratorPermission)}
                      >
                        <SelectTrigger className="h-7 w-[110px] text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">
                            <span className="flex items-center gap-1.5">
                              <Eye className="h-3 w-3" /> View only
                            </span>
                          </SelectItem>
                          <SelectItem value="edit">
                            <span className="flex items-center gap-1.5">
                              <Pencil className="h-3 w-3" /> Can edit
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* DNA blend toggle */}
                      {guest.isVoyanceUser && (
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={guest.includePreferences}
                            onCheckedChange={(v) => updateGuestDNA(guest.id, v)}
                            className="scale-75"
                            id={`dna-${guest.id}`}
                          />
                          <Label htmlFor={`dna-${guest.id}`} className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer">
                            <Dna className="h-3 w-3" />
                            Blend DNA
                          </Label>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── Add guests ── */}
          {(
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'friends' | 'invite')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="friends" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  My Friends
                </TabsTrigger>
                <TabsTrigger value="invite" className="gap-1.5">
                  <Mail className="h-4 w-4" />
                  Invite
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
                          {compatibilityScores[friendship.friend.id] != null && (
                            <Badge variant="secondary" className="text-[10px] gap-0.5">
                              <Sparkles className="h-2.5 w-2.5" />
                              {compatibilityScores[friendship.friend.id]}%
                            </Badge>
                          )}
                          <UserPlus className="h-4 w-4 text-primary flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : friends.length === 0 ? (
                    <div className="h-40 flex items-center justify-center">
                      <div className="text-center text-muted-foreground px-4">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">No friends yet</p>
                        <p className="text-xs mt-1">Add friends from your profile to link them to trips</p>
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
                  <Button onClick={handleInviteByEmail} disabled={isInviting || !email} size="sm">
                    {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  They'll receive an invite to join your trip. They must create an account to view the itinerary.
                </p>
              </TabsContent>
            </Tabs>
          )}

          {/* Info note */}
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <p>
              Guests must sign in to see the itinerary. They can edit if permitted, but spending actions use <strong>their own credits</strong>.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {linkedGuests.length === 0
                ? 'No companions linked'
                : `${linkedGuests.length} companion${linkedGuests.length !== 1 ? 's' : ''} linked`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm}>
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
