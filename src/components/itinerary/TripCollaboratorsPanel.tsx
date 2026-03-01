/**
 * Trip Collaborators Panel
 * 
 * Compact avatar stack for large groups, expandable for detail management.
 * Shows owner + collaborators with permission management, DNA status, and blend toggle.
 * Supports adding existing friends directly or inviting by link.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, Users, Eye, Edit3, UserPlus, MoreVertical, 
  X, Shield, ChevronDown, ChevronUp, Dna, Loader2, Sparkles, Link2, UserMinus, LogOut
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  useTripCollaborators, 
  useTripPermission,
  useUpdateCollaboratorPermission,
  useRemoveTripCollaborator,
  useAddTripCollaborator,
  type TripCollaborator,
  type CollaboratorPermission,
} from '@/services/tripCollaboratorsAPI';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchTravelDNA, calculateGuestCompatibility } from '@/utils/travelDNACompatibility';
import { DNAQuizPrompt } from './DNAQuizPrompt';
import { useFriends, type FriendWithProfile } from '@/services/supabase/friends';

interface TripCollaboratorsPanelProps {
  tripId: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerAvatarUrl?: string;
  onInviteClick?: () => void;
  onMemberAdded?: (memberName: string) => void;
  compact?: boolean;
}

const permissionLabels: Record<CollaboratorPermission, { label: string; icon: typeof Eye; description: string }> = {
  view: { label: 'Viewer', icon: Eye, description: 'Can view the itinerary only' },
  edit: { label: 'Editor', icon: Edit3, description: 'Can edit activities and make changes' },
  admin: { label: 'Admin', icon: Edit3, description: 'Full access to trip settings' },
};

const MAX_VISIBLE_AVATARS = 5;

export function TripCollaboratorsPanel({
  tripId,
  ownerName,
  ownerEmail,
  ownerAvatarUrl,
  onInviteClick,
  onMemberAdded,
  compact = false,
}: TripCollaboratorsPanelProps) {
  const { data: collaborators = [], isLoading } = useTripCollaborators(tripId);
  const { data: permission } = useTripPermission(tripId);
  const updatePermission = useUpdateCollaboratorPermission();
  const removeCollaborator = useRemoveTripCollaborator();
  const addCollaborator = useAddTripCollaborator();
  const [showDetails, setShowDetails] = useState(!compact);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [collaboratorDNA, setCollaboratorDNA] = useState<Record<string, { hasDNA: boolean; compatibility: number | null }>>({});
  const [updatingPreferences, setUpdatingPreferences] = useState<string | null>(null);
  const [removingCollaborator, setRemovingCollaborator] = useState<TripCollaborator | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const navigate = useNavigate();

  const isOwner = permission?.isOwner ?? false;

  // Fetch trip owner's profile when user is a guest (not the owner)
  const [ownerInfo, setOwnerInfo] = useState<{ name?: string; email?: string; avatarUrl?: string } | null>(null);
  useEffect(() => {
    if (isOwner || ownerName) return; // Skip if we're the owner or name is provided
    
    async function fetchOwnerProfile() {
      try {
        // Get the trip to find the owner's user_id
        const { data: trip } = await supabase
          .from('trips')
          .select('user_id')
          .eq('id', tripId)
          .single();
        
        if (!trip?.user_id) return;
        
        // Get the owner's profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, handle')
          .eq('id', trip.user_id)
          .single();
        
        if (profile) {
          setOwnerInfo({
            name: profile.display_name || profile.handle || undefined,
            avatarUrl: profile.avatar_url || undefined,
          });
        }
      } catch (e) {
        console.warn('[TripCollaboratorsPanel] Failed to fetch owner profile:', e);
      }
    }
    
    fetchOwnerProfile();
  }, [tripId, isOwner, ownerName]);

  const totalMembers = 1 + collaborators.length;
  const resolvedOwnerName = ownerName || ownerInfo?.name || ownerEmail?.split('@')[0] || 'Trip Owner';
  const resolvedOwnerAvatar = ownerAvatarUrl || ownerInfo?.avatarUrl;

  // Fetch DNA status for all collaborators
  useEffect(() => {
    async function fetchDNAStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dnaStatus: Record<string, { hasDNA: boolean; compatibility: number | null }> = {};
      
      for (const collab of collaborators) {
        const dna = await fetchTravelDNA(collab.user_id);
        const hasDNA = !!dna?.trait_scores;
        let compatibility: number | null = null;
        
        if (hasDNA) {
          compatibility = await calculateGuestCompatibility(user.id, collab.user_id);
        }
        
        dnaStatus[collab.user_id] = { hasDNA, compatibility };
      }
      
      setCollaboratorDNA(dnaStatus);
    }
    
    if (collaborators.length > 0) {
      fetchDNAStatus();
    }
  }, [collaborators]);

  const handlePermissionChange = async (collaborator: TripCollaborator, newPermission: CollaboratorPermission) => {
    updatePermission.mutate({ collaboratorId: collaborator.id, permission: newPermission });
  };

  const handleRemove = async (collaborator: TripCollaborator) => {
    setRemovingCollaborator(collaborator);
  };

  const confirmRemove = async () => {
    if (!removingCollaborator) return;
    removeCollaborator.mutate(removingCollaborator.id, {
      onSuccess: () => {
        toast.success('Member removed. You can re-send the invite link to let them rejoin.');
      },
    });
    setRemovingCollaborator(null);
  };

  // Find current user's collaborator record (for leave functionality)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);
  const myCollaboratorRecord = collaborators.find(c => c.user_id === currentUserId);

  const handleLeaveTrip = async () => {
    if (!myCollaboratorRecord) return;
    removeCollaborator.mutate(myCollaboratorRecord.id, {
      onSuccess: () => {
        toast.success('You left the trip. Ask the owner for the invite link to rejoin.');
        navigate('/');
      },
    });
    setShowLeaveConfirm(false);
  };

  const handleTogglePreferences = async (collaborator: TripCollaborator) => {
    setUpdatingPreferences(collaborator.id);
    const newValue = !(collaborator.include_preferences ?? true);
    const { error } = await supabase
      .from('trip_collaborators')
      .update({ include_preferences: newValue })
      .eq('id', collaborator.id);
    if (error) {
      toast.error('Failed to update preference setting');
    } else {
      toast.success(newValue ? 'Preferences will be included' : 'Preferences excluded from blend');
    }
    setUpdatingPreferences(null);
  };

  const handleAddFriend = async (friend: FriendWithProfile) => {
    try {
      await addCollaborator.mutateAsync({
        tripId,
        userId: friend.friend.id,
        permission: 'edit',
      });
      const memberName = friend.friend.display_name || friend.friend.handle || 'New member';
      onMemberAdded?.(memberName);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email?.charAt(0).toUpperCase() || '?';
  };

  const getShortName = (name?: string, email?: string) => {
    if (name) return name.split(' ')[0];
    if (email) return email.split('@')[0];
    return 'Guest';
  };

  // Build all members array for the avatar stack
  const allMembers = [
    { id: '__owner__', name: resolvedOwnerName, email: ownerEmail, avatarUrl: resolvedOwnerAvatar, isOwner: true },
    ...collaborators.map(c => ({
      id: c.id,
      name: c.profile?.display_name || c.profile?.handle || undefined,
      email: undefined as string | undefined,
      avatarUrl: c.profile?.avatar_url || undefined,
      isOwner: false,
    })),
  ];

  const visibleMembers = allMembers.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = Math.max(0, allMembers.length - MAX_VISIBLE_AVATARS);

  // Get collaborator user IDs for filtering friends
  const collaboratorUserIds = new Set(collaborators.map(c => c.user_id));

  return (
    <>
    <Card className={cn(compact && "border-0 shadow-none bg-transparent")}>
      {!compact && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Trip Members
              <Badge variant="secondary" className="text-xs ml-1">{totalMembers}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn(compact && "p-0")}>
        <div className="space-y-3">
          {/* Compact Avatar Stack - always visible */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-3 w-full py-2 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors"
          >
            {/* Avatar row */}
            <div className="flex -space-x-2.5">
              {visibleMembers.map((member) => (
                <Tooltip key={member.id}>
                  <TooltipTrigger asChild>
                    <Avatar className={cn(
                      "h-8 w-8 border-2 border-background ring-0 transition-transform hover:scale-110 hover:z-10",
                      member.isOwner && "ring-2 ring-primary/30"
                    )}>
                      {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                      <AvatarFallback className={cn(
                        "text-xs",
                        member.isOwner ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {getInitials(member.name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {member.name || member.email?.split('@')[0] || 'Guest'}
                    {member.isOwner && ' (Owner)'}
                  </TooltipContent>
                </Tooltip>
              ))}
              {overflowCount > 0 && (
                <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium text-muted-foreground">
                  +{overflowCount}
                </div>
              )}
            </div>

            {/* Names summary */}
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm text-muted-foreground truncate">
                {allMembers.length <= 3
                  ? allMembers.map(m => getShortName(m.name, m.email)).join(', ')
                  : `${allMembers.slice(0, 2).map(m => getShortName(m.name, m.email)).join(', ')} & ${allMembers.length - 2} more`
                }
              </p>
            </div>

            {showDetails
              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            }
          </button>

          {/* Expanded Details */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1 pt-1">
                  {/* Owner Row */}
                  <div className="flex items-center justify-between py-2 px-2 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 ring-2 ring-primary/30">
                        {ownerAvatarUrl && <AvatarImage src={ownerAvatarUrl} />}
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(resolvedOwnerName, ownerEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{resolvedOwnerName}</span>
                          <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                            <Crown className="h-2.5 w-2.5" />
                            Owner
                          </Badge>
                        </div>
                        {ownerEmail && resolvedOwnerName !== ownerEmail?.split('@')[0] && (
                          <p className="text-xs text-muted-foreground">{ownerEmail}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collaborators */}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    collaborators.map(collaborator => {
                      const permInfo = permissionLabels[collaborator.permission] || permissionLabels.view;
                      const PermIcon = permInfo.icon;
                      const dnaInfo = collaboratorDNA[collaborator.user_id];
                      const hasDNA = dnaInfo?.hasDNA ?? false;
                      const compatibility = dnaInfo?.compatibility;
                      const includesPrefs = collaborator.include_preferences ?? true;

                      return (
                        <div
                          key={collaborator.id}
                          className="py-2 px-2 rounded-lg border border-border/50 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                {collaborator.profile?.avatar_url && (
                                  <AvatarImage src={collaborator.profile.avatar_url} />
                                )}
                                <AvatarFallback className="bg-muted">
                                  {getInitials(collaborator.profile?.display_name, collaborator.profile?.handle)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {collaborator.profile?.display_name || collaborator.profile?.handle || 'Guest'}
                                  </span>
                                  {hasDNA && compatibility !== null && (
                                    <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                                      <Dna className="h-2.5 w-2.5" />
                                      {compatibility}%
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <PermIcon className="h-3 w-3" />
                                  <span>{permInfo.label}</span>
                                </div>
                              </div>
                            </div>

                            {isOwner && (
                              <div className="flex items-center gap-1">
                                <Select
                                  value={collaborator.permission}
                                  onValueChange={(value: CollaboratorPermission) => handlePermissionChange(collaborator, value)}
                                >
                                  <SelectTrigger className="h-7 w-[90px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="view">
                                      <div className="flex items-center gap-2">
                                        <Eye className="h-3 w-3" />
                                        Viewer
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="edit">
                                      <div className="flex items-center gap-2">
                                        <Edit3 className="h-3 w-3" />
                                        Editor
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Member options">
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleRemove(collaborator)}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Remove from trip
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>

                          {/* DNA Status and Blend Toggle */}
                          {isOwner && (
                            <div className="ml-12">
                              {hasDNA ? (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Dna className="h-3 w-3" />
                                    <span>Include in blend</span>
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Switch
                                        checked={includesPrefs}
                                        onCheckedChange={() => handleTogglePreferences(collaborator)}
                                        disabled={updatingPreferences === collaborator.id}
                                        className="scale-90"
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs">
                                        {includesPrefs
                                          ? 'Their preferences will be blended into the itinerary'
                                          : 'Preferences excluded from generation'
                                        }
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              ) : (
                                <DNAQuizPrompt
                                  guestName={collaborator.profile?.display_name || 'Guest'}
                                  compact
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Add Friends / Invite Section */}
                  {isOwner && (
                    <>
                      {showFriendPicker ? (
                        <FriendPickerInline
                          tripId={tripId}
                          excludeUserIds={collaboratorUserIds}
                          onAddFriend={handleAddFriend}
                          isAdding={addCollaborator.isPending}
                          onClose={() => setShowFriendPicker(false)}
                          onInviteClick={onInviteClick}
                        />
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 gap-2"
                          onClick={() => setShowFriendPicker(true)}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Add Traveler
                        </Button>
                      )}
                    </>
                  )}

                  {/* Non-owner permission indicator + Leave Trip */}
                  {!isOwner && permission?.permission && (
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        <span>
                          You have <strong>{permission.permission}</strong> access
                          {permission.canEdit ? ' - you can edit this itinerary' : ' - view only'}
                        </span>
                      </div>
                      {myCollaboratorRecord && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                          onClick={() => setShowLeaveConfirm(true)}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Leave Trip
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>

    {/* Remove Collaborator Confirmation Dialog */}
    <AlertDialog open={!!removingCollaborator} onOpenChange={(open) => !open && setRemovingCollaborator(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-destructive" />
            Remove from trip?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Remove <strong>{removingCollaborator?.profile?.display_name || 'this guest'}</strong> from this trip? They will lose access to the itinerary and won't be able to view or edit it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmRemove}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Leave Trip Confirmation Dialog */}
    <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-destructive" />
            Leave this trip?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You'll lose access to this itinerary. The trip owner can send you the invite link to rejoin anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeaveTrip}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Leave Trip
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ============================================================================
// Inline Friend Picker Sub-component
// ============================================================================

function FriendPickerInline({
  tripId,
  excludeUserIds,
  onAddFriend,
  isAdding,
  onClose,
  onInviteClick,
}: {
  tripId: string;
  excludeUserIds: Set<string>;
  onAddFriend: (friend: FriendWithProfile) => void;
  isAdding: boolean;
  onClose: () => void;
  onInviteClick?: () => void;
}) {
  const { data: friendsData, isLoading } = useFriends();
  const friends = friendsData || [];
  const availableFriends = friends.filter(f => !excludeUserIds.has(f.friend.id));

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-2 rounded-lg border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Add from friends</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-muted transition-colors">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Friends list */}
      <div className="max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : availableFriends.length > 0 ? (
          availableFriends.map((friendship) => (
            <button
              key={friendship.id}
              onClick={() => onAddFriend(friendship)}
              disabled={isAdding}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0 disabled:opacity-50"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={friendship.friend.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {(friendship.friend.display_name || friendship.friend.handle || 'F').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {friendship.friend.display_name || friendship.friend.handle || 'Friend'}
                </p>
                {friendship.friend.handle && (
                  <p className="text-[11px] text-muted-foreground">@{friendship.friend.handle}</p>
                )}
              </div>
              <UserPlus className="h-4 w-4 text-primary flex-shrink-0" />
            </button>
          ))
        ) : friends.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground px-4">
            <Users className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
            <p className="text-xs font-medium">No friends yet</p>
            <p className="text-[11px] mt-0.5">Add friends from your profile first</p>
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <Sparkles className="h-6 w-6 mx-auto mb-1.5 text-primary/50" />
            <p className="text-xs">All friends already added!</p>
          </div>
        )}
      </div>

      {/* Invite by link fallback */}
      {onInviteClick && (
        <div className="px-3 py-2 border-t border-border bg-muted/20">
          <button
            onClick={() => {
              onClose();
              onInviteClick();
            }}
            className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Or invite by link instead</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}
