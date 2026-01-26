import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Crown,
  Mail,
  Check,
  X,
  MoreVertical,
  UserMinus,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useTripMembers,
  useAddTripMember,
  useRemoveTripMember,
  updateTripMember,
  type TripMember,
  type TripMemberRole,
} from '@/services/tripBudgetAPI';

interface TripMembersPanelProps {
  tripId: string;
  currentUserEmail?: string;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

export default function TripMembersPanel({ tripId, currentUserEmail }: TripMembersPanelProps) {
  const { data: members = [], isLoading, refetch } = useTripMembers(tripId);
  const addMember = useAddTripMember();
  const removeMember = useRemoveTripMember();

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');

  const primaryMember = members.find(m => m.role === 'primary');
  const attendees = members.filter(m => m.role === 'attendee');

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }

    // Basic email validation
    if (!inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check if already invited
    if (members.some(m => m.email.toLowerCase() === inviteEmail.toLowerCase())) {
      toast.error('This person is already a member');
      return;
    }

    try {
      await addMember.mutateAsync({
        tripId,
        email: inviteEmail,
        name: inviteName || undefined,
        role: 'attendee',
      });
      toast.success(`Invited ${inviteName || inviteEmail}`);
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteName('');
    } catch (error) {
      toast.error('Failed to invite member');
    }
  };

  const handleRemove = async (member: TripMember) => {
    if (member.role === 'primary') {
      toast.error('Cannot remove the trip organizer');
      return;
    }

    try {
      await removeMember.mutateAsync({ memberId: member.id, tripId });
      toast.success(`Removed ${member.name || member.email}`);
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleMakePrimary = async (member: TripMember) => {
    if (member.role === 'primary') return;

    try {
      // First, demote current primary to attendee
      if (primaryMember) {
        await updateTripMember(primaryMember.id, { role: 'attendee' });
      }
      // Then promote this member to primary
      await updateTripMember(member.id, { role: 'primary' });
      toast.success(`${member.name || member.email} is now the trip organizer`);
      refetch();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Users className="w-5 h-5" />
          Trip Members
          <Badge variant="secondary" className="ml-2">{members.length}</Badge>
        </h3>
        <Button size="sm" onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="w-4 h-4 mr-1" />
          Invite
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading members...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No members yet</p>
          <p className="text-xs mt-1">Invite friends to plan together</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Primary Organizer */}
          {primaryMember && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Trip Organizer
              </p>
              <MemberCard
                member={primaryMember}
                isCurrentUser={currentUserEmail?.toLowerCase() === primaryMember.email.toLowerCase()}
                onRemove={handleRemove}
                onMakePrimary={handleMakePrimary}
              />
            </div>
          )}

          {/* Attendees */}
          {attendees.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Attendees ({attendees.length})
              </p>
              <div className="space-y-2">
                {attendees.map(member => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    isCurrentUser={currentUserEmail?.toLowerCase() === member.email.toLowerCase()}
                    onRemove={handleRemove}
                    onMakePrimary={handleMakePrimary}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to Trip</DialogTitle>
            <DialogDescription>
              Send an invitation to join this trip. They'll be able to view and contribute to the itinerary and budget.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Name (optional)</label>
              <Input
                placeholder="Their name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowInviteDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={addMember.isPending} className="flex-1">
                <Mail className="w-4 h-4 mr-1" />
                {addMember.isPending ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Member Card Component
function MemberCard({
  member,
  isCurrentUser,
  onRemove,
  onMakePrimary,
}: {
  member: TripMember;
  isCurrentUser: boolean;
  onRemove: (member: TripMember) => void;
  onMakePrimary: (member: TripMember) => void;
}) {
  const isPrimary = member.role === 'primary';

  return (
    <motion.div
      layout
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback className={isPrimary ? 'bg-primary/10 text-primary' : ''}>
          {getInitials(member.name, member.email)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">
            {member.name || member.email.split('@')[0]}
          </p>
          {isCurrentUser && (
            <Badge variant="outline" className="text-xs">You</Badge>
          )}
          {isPrimary && (
            <Crown className="w-4 h-4 text-yellow-500" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>

      <div className="flex items-center gap-2">
        {member.acceptedAt ? (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
            <Check className="w-3 h-3 mr-1" />
            Joined
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Mail className="w-3 h-3 mr-1" />
            Invited
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Member options">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isPrimary && (
              <DropdownMenuItem onClick={() => onMakePrimary(member)}>
                <Shield className="w-4 h-4 mr-2" />
                Make Organizer
              </DropdownMenuItem>
            )}
            {!isPrimary && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onRemove(member)}
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
