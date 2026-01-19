/**
 * Friends Section Component - Editorial Redesign
 * Clean, sophisticated, minimal color palette
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Search, 
  Check, 
  X, 
  Clock,
  UserMinus,
  Loader2,
  Send,
  Link2,
  ChevronRight
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
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend
} from '@/services/supabase/friends';
import { useSearchProfiles } from '@/services/supabase/profiles';
import LinkToTripModal from './LinkToTripModal';
import FriendProfileCard from './FriendProfileCard';
import FriendsActivityFeed from './FriendsActivityFeed';

interface FriendsSectionProps {
  userId: string;
  className?: string;
}

export default function FriendsSection({ userId, className }: FriendsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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
  const { data: searchResults, isLoading: isSearchLoading } = useSearchProfiles(searchQuery);

  // Mutations
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const removeFriend = useRemoveFriend();

  const handleSendRequest = async (handle: string) => {
    try {
      await sendRequest.mutateAsync(handle);
      setSearchQuery('');
    } catch (error) {
      // Error handled in mutation
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

      {/* Search Bar - Clean and minimal */}
      <div className="relative max-w-md">
        <div className={cn(
          "relative border rounded-lg transition-all duration-200",
          isSearchFocused ? "border-foreground shadow-sm" : "border-border"
        )}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by @handle or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            className="pl-10 pr-4 h-11 border-0 bg-transparent focus-visible:ring-0 text-sm"
          />
          {isSearchLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Tip: Ask friends to share their @handle from their profile
        </p>
        
        {/* Search Results Dropdown */}
        <AnimatePresence>
          {isSearchFocused && searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-20 overflow-hidden"
            >
              {searchResults.map((user, idx) => {
                const isFriend = friends?.some(f => f.friend?.id === user.id);
                const hasPending = outgoingRequests?.some(r => r.addressee?.id === user.id);
                
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                          {(user.display_name || user.handle || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {user.display_name || user.handle}
                        </p>
                        {user.handle && (
                          <p className="text-xs text-muted-foreground">@{user.handle}</p>
                        )}
                      </div>
                    </div>
                    {isFriend ? (
                      <Badge variant="secondary" className="text-xs font-normal">
                        <Check className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : hasPending ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    ) : user.handle ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendRequest(user.handle!)}
                        disabled={sendRequest.isPending}
                        className="h-8 text-xs"
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                        Add
                      </Button>
                    ) : null}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
          {isSearchFocused && searchQuery.length >= 2 && searchResults?.length === 0 && !isSearchLoading && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-20 p-6 text-center"
            >
              <p className="text-sm text-muted-foreground">No users found</p>
            </motion.div>
          )}
        </AnimatePresence>
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
                            {(friendship.friend?.display_name || '?')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </FriendProfileCard>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {friendship.friend?.display_name || 'Unknown'}
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
                        {(request.requester?.display_name || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {request.requester?.display_name || 'Unknown'}
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
                        {(request.addressee?.display_name || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {request.addressee?.display_name || 'Unknown'}
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
