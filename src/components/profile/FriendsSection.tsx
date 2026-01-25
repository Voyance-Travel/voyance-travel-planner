/**
 * Friends Section Component - Editorial Redesign
 * Clean, sophisticated, minimal color palette
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Check, 
  X, 
  Clock,
  UserMinus,
  Loader2,
  Send,
  Link2,
  Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  useFriends as useSupabaseFriends,
  usePendingRequests,
  useOutgoingRequests,
  useSendFriendRequestByEmail,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
  getDisplayName
} from '@/services/supabase/friends';
import LinkToTripModal from './LinkToTripModal';
import FriendProfileCard from './FriendProfileCard';
import FriendsActivityFeed from './FriendsActivityFeed';

interface FriendsSectionProps {
  userId: string;
  className?: string;
}

export default function FriendsSection({ userId, className }: FriendsSectionProps) {
  const [emailInput, setEmailInput] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'friends' | 'pending' | 'sent' | 'activity'>('friends');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<{
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null>(null);

  // Fetch data
  const { data: friends, isLoading: isLoadingFriends } = useSupabaseFriends();
  const { data: pendingRequests, isLoading: isLoadingPending } = usePendingRequests();
  const { data: outgoingRequests } = useOutgoingRequests();

  // Mutations
  const sendRequestByEmail = useSendFriendRequestByEmail();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const removeFriend = useRemoveFriend();

  const handleSendInvite = async () => {
    const email = emailInput.trim().toLowerCase();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setInviteStatus('error');
      setStatusMessage('Please enter a valid email address');
      return;
    }

    setInviteStatus('loading');
    setStatusMessage('');

    try {
      const result = await sendRequestByEmail.mutateAsync(email);
      setInviteStatus('success');
      if (result.status === 'accepted') {
        setStatusMessage('Friend added!');
      } else {
        setStatusMessage('Friend request sent!');
      }
      setEmailInput('');
      // Reset status after a delay
      setTimeout(() => {
        setInviteStatus('idle');
        setStatusMessage('');
      }, 3000);
    } catch (error: any) {
      setInviteStatus('error');
      setStatusMessage(error.message || 'No user found with this email');
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await acceptRequest.mutateAsync(friendshipId);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      await declineRequest.mutateAsync(friendshipId);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!confirm('Remove this friend?')) return;
    try {
      await removeFriend.mutateAsync(friendshipId);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const openLinkModal = (friend: typeof selectedFriend) => {
    setSelectedFriend(friend);
    setLinkModalOpen(true);
  };

  const isLoading = isLoadingFriends || isLoadingPending;
  const pendingCount = pendingRequests?.length ?? 0;
  const sentCount = outgoingRequests?.length ?? 0;
  const friendsCount = friends?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-8", className)}
    >
      {/* Header - Editorial style */}
      <div className="border-b border-border pb-6">
        <h2 className="text-2xl font-serif font-medium text-foreground tracking-tight">
          Travel Companions
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect with friends to plan trips together
        </p>
      </div>

      {/* Preference Blending Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-muted/30 border border-border rounded-lg p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-1">
              Trip Together, Blend Preferences
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When you plan a trip with friends, Voyance intelligently blends everyone's preferences 
              using our weighted algorithm. Activities, pace, and budget are balanced so the entire 
              group enjoys the experience. The more trips you take together, the smarter the blending becomes.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Email Invite Form - Clean and minimal */}
      <div className="max-w-md">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Enter friend's email address..."
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                if (inviteStatus !== 'idle') {
                  setInviteStatus('idle');
                  setStatusMessage('');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && emailInput.trim()) {
                  handleSendInvite();
                }
              }}
              disabled={inviteStatus === 'loading'}
              className="pl-10 pr-4 h-11 text-sm"
            />
          </div>
          <Button
            onClick={handleSendInvite}
            disabled={!emailInput.trim() || inviteStatus === 'loading'}
            className="h-11 px-4"
          >
            {inviteStatus === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Invite
              </>
            )}
          </Button>
        </div>
        
        {/* Status Message */}
        <AnimatePresence mode="wait">
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn(
                "mt-2 text-sm flex items-center gap-2",
                inviteStatus === 'success' && "text-emerald-600",
                inviteStatus === 'error' && "text-destructive"
              )}
            >
              {inviteStatus === 'success' ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {statusMessage}
            </motion.div>
          )}
        </AnimatePresence>
        
        <p className="text-xs text-muted-foreground mt-2">
          Enter the exact email address your friend uses on Voyance
        </p>
      </div>

      {/* Sub-tabs - Editorial style */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as any)} className="w-full">
        <TabsList className="h-auto p-0 bg-transparent border-b border-border rounded-none w-full justify-start gap-0">
          <TabsTrigger 
            value="friends" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium data-[state=active]:shadow-none"
          >
            Friends
            {friendsCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">{friendsCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="pending" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium data-[state=active]:shadow-none"
          >
            Requests
            {pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-foreground text-background">{pendingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="sent" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium data-[state=active]:shadow-none"
          >
            Sent
            {sentCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">{sentCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="activity" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium data-[state=active]:shadow-none"
          >
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Loading State */}
        {isLoading && activeSubTab !== 'activity' && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Friends List */}
        <TabsContent value="friends" className="mt-6">
          {!isLoading && (!friends || friends.length === 0) ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-sm font-medium text-foreground mb-1">No friends yet</h3>
              <p className="text-sm text-muted-foreground">
                Search by @handle to find and add friends
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {friends?.map((friendship, index) => (
                <motion.div
                  key={friendship.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="py-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <FriendProfileCard friendId={friendship.friend?.id || ''}>
                      <button className="flex-shrink-0">
                        <Avatar className="h-12 w-12 cursor-pointer hover:opacity-80 transition-opacity">
                          <AvatarImage src={friendship.friend?.avatar_url || undefined} />
                          <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                            {getDisplayName(friendship.friend)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </FriendProfileCard>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {getDisplayName(friendship.friend)}
                      </p>
                      {friendship.friend?.handle && (
                        <p className="text-xs text-muted-foreground">@{friendship.friend.handle}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => openLinkModal(friendship.friend)}
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1.5" />
                      Link to trip
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveFriend(friendship.id)}
                      disabled={removeFriend.isPending}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      title="Remove friend"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Pending Requests */}
        <TabsContent value="pending" className="mt-6">
          {!isLoading && (!pendingRequests || pendingRequests.length === 0) ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-sm font-medium text-foreground mb-1">No pending requests</h3>
              <p className="text-sm text-muted-foreground">
                Friend requests will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingRequests?.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={request.requester?.avatar_url || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                        {getDisplayName(request.requester)[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {getDisplayName(request.requester)}
                      </p>
                      {request.requester?.handle && (
                        <p className="text-xs text-muted-foreground">@{request.requester.handle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineRequest(request.id)}
                      disabled={declineRequest.isPending}
                      className="h-8 text-xs"
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptRequest(request.id)}
                      disabled={acceptRequest.isPending}
                      className="h-8 text-xs"
                    >
                      Accept
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Sent Requests */}
        <TabsContent value="sent" className="mt-6">
          {(!outgoingRequests || outgoingRequests.length === 0) ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <Send className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-sm font-medium text-foreground mb-1">No sent requests</h3>
              <p className="text-sm text-muted-foreground">
                Requests you send will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {outgoingRequests.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={request.addressee?.avatar_url || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                        {getDisplayName(request.addressee)[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {getDisplayName(request.addressee)}
                      </p>
                      {request.addressee?.handle && (
                        <p className="text-xs text-muted-foreground">@{request.addressee.handle}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs font-normal">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activity Feed */}
        <TabsContent value="activity" className="mt-6">
          <FriendsActivityFeed userId={userId} limit={10} />
        </TabsContent>
      </Tabs>

      {/* Link to Trip Modal */}
      {selectedFriend && (
        <LinkToTripModal
          open={linkModalOpen}
          onOpenChange={setLinkModalOpen}
          friend={selectedFriend}
        />
      )}
    </motion.div>
  );
}
