/**
 * Friends Section Component
 * Displays friends list, pending requests, and friend search
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
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

interface FriendsSectionProps {
  userId: string;
  className?: string;
}

export default function FriendsSection({ userId, className }: FriendsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Fetch data
  const { data: friends, isLoading: isLoadingFriends } = useSupabaseFriends();
  const { data: pendingRequests, isLoading: isLoadingPending } = usePendingRequests();
  const { data: outgoingRequests } = useOutgoingRequests();
  const { data: searchResults } = useSearchProfiles(searchQuery);

  // Mutations
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const removeFriend = useRemoveFriend();

  const handleSendRequest = async (handle: string) => {
    try {
      await sendRequest.mutateAsync(handle);
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
    try {
      await removeFriend.mutateAsync(friendshipId);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const isLoading = isLoadingFriends || isLoadingPending;
  const hasPendingRequests = (pendingRequests?.length ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-6", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Friends</h2>
            <p className="text-sm text-muted-foreground">
              {friends?.length ?? 0} connections
            </p>
          </div>
        </div>
        {hasPendingRequests && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {pendingRequests?.length} pending
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by handle..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearching(true)}
          onBlur={() => setTimeout(() => setIsSearching(false), 200)}
          className="pl-10"
        />
        
        {/* Search Results Dropdown */}
        <AnimatePresence>
          {isSearching && searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg border shadow-lg z-10 overflow-hidden"
            >
              {searchResults.map((user) => {
                const isFriend = friends?.some(f => f.friend?.id === user.id);
                const hasPending = outgoingRequests?.some(r => r.addressee?.id === user.id);
                
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {(user.display_name || user.handle || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {user.display_name || user.handle}
                        </p>
                        {user.handle && (
                          <p className="text-xs text-muted-foreground">@{user.handle}</p>
                        )}
                      </div>
                    </div>
                    {isFriend ? (
                      <Badge variant="outline" className="text-xs">Friends</Badge>
                    ) : hasPending ? (
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    ) : user.handle ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSendRequest(user.handle!)}
                        disabled={sendRequest.isPending}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Pending Requests */}
      {!isLoading && hasPendingRequests && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Pending Requests
          </h3>
          <div className="space-y-2">
            {pendingRequests?.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.requester?.avatar_url || undefined} />
                    <AvatarFallback>
                      {(request.requester?.display_name || '?')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {request.requester?.display_name || 'Unknown'}
                    </p>
                    {request.requester?.handle && (
                      <p className="text-xs text-muted-foreground">
                        @{request.requester.handle}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAcceptRequest(request.id)}
                    disabled={acceptRequest.isPending}
                    className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeclineRequest(request.id)}
                    disabled={declineRequest.isPending}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      {!isLoading && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Your Friends
          </h3>
          {(!friends || friends.length === 0) ? (
            <div className="text-center py-8 bg-muted/20 rounded-lg">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No friends yet</p>
              <p className="text-muted-foreground text-xs mt-1">
                Search for friends by their handle above
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {friends.map((friendship, index) => (
                <motion.div
                  key={friendship.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friendship.friend?.avatar_url || undefined} />
                      <AvatarFallback>
                        {(friendship.friend?.display_name || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {friendship.friend?.display_name || 'Unknown'}
                      </p>
                      {friendship.friend?.handle && (
                        <p className="text-xs text-muted-foreground">@{friendship.friend.handle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="Message"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveFriend(friendship.id)}
                      disabled={removeFriend.isPending}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                      title="Remove friend"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
