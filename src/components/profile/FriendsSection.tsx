/**
 * Friends Section Component - Redesigned
 * Bright, friendly, interactive friends management
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
  Heart,
  Sparkles,
  Send,
  Plane,
  Link2
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

interface FriendsSectionProps {
  userId: string;
  className?: string;
}

// Fun gradient backgrounds for friend cards
const friendGradients = [
  'from-rose-100 to-pink-100 dark:from-rose-900/20 dark:to-pink-900/20',
  'from-sky-100 to-cyan-100 dark:from-sky-900/20 dark:to-cyan-900/20',
  'from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20',
  'from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20',
  'from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20',
  'from-fuchsia-100 to-pink-100 dark:from-fuchsia-900/20 dark:to-pink-900/20',
];

export default function FriendsSection({ userId, className }: FriendsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'friends' | 'pending' | 'sent'>('friends');

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

  const isLoading = isLoadingFriends || isLoadingPending;
  const pendingCount = pendingRequests?.length ?? 0;
  const sentCount = outgoingRequests?.length ?? 0;
  const friendsCount = friends?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-6", className)}
    >
      {/* Header with fun styling */}
      <div className="text-center space-y-2 pb-4">
        <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10">
          <Heart className="h-5 w-5 text-pink-500" />
          <h2 className="text-xl font-semibold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Your Travel Crew
          </h2>
          <Sparkles className="h-5 w-5 text-purple-500" />
        </div>
        <p className="text-sm text-muted-foreground">
          Connect with friends and plan trips together
        </p>
      </div>

      {/* Search Bar - Prominent and friendly */}
      <div className="relative max-w-md mx-auto">
        <div className={cn(
          "relative rounded-2xl transition-all duration-300",
          isSearchFocused ? "ring-2 ring-primary/50 shadow-lg shadow-primary/10" : "shadow-sm"
        )}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Find friends by @handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            className="pl-12 pr-4 h-12 rounded-2xl border-2 bg-background/80 backdrop-blur-sm text-base"
          />
          {isSearchLoading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        
        {/* Search Results Dropdown */}
        <AnimatePresence>
          {isSearchFocused && searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-lg rounded-xl border-2 shadow-xl z-20 overflow-hidden"
            >
              {searchResults.map((user, idx) => {
                const isFriend = friends?.some(f => f.friend?.id === user.id);
                const hasPending = outgoingRequests?.some(r => r.addressee?.id === user.id);
                
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 ring-2 ring-background">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-medium">
                          {(user.display_name || user.handle || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">
                          {user.display_name || user.handle}
                        </p>
                        {user.handle && (
                          <p className="text-sm text-muted-foreground">@{user.handle}</p>
                        )}
                      </div>
                    </div>
                    {isFriend ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                        <Check className="h-3 w-3 mr-1" />
                        Friends
                      </Badge>
                    ) : hasPending ? (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    ) : user.handle ? (
                      <Button
                        size="sm"
                        onClick={() => handleSendRequest(user.handle!)}
                        disabled={sendRequest.isPending}
                        className="rounded-full gap-1.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                      >
                        <UserPlus className="h-4 w-4" />
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
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-lg rounded-xl border-2 shadow-xl z-20 p-6 text-center"
            >
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No users found with that handle</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sub-tabs for Friends / Pending / Sent */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto rounded-full p-1 h-auto bg-muted/50">
          <TabsTrigger value="friends" className="rounded-full py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-2" />
            Friends
            {friendsCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">{friendsCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-full py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Clock className="h-4 w-4 mr-2" />
            Requests
            {pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-rose-500 text-white animate-pulse">{pendingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="rounded-full py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Send className="h-4 w-4 mr-2" />
            Sent
            {sentCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-muted-foreground/20">{sentCount}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading your crew...</span>
            </div>
          </div>
        )}

        {/* Friends List */}
        <TabsContent value="friends" className="mt-6">
          {!isLoading && (!friends || friends.length === 0) ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 px-6 rounded-2xl bg-gradient-to-br from-muted/30 via-muted/20 to-transparent border-2 border-dashed border-muted"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-pink-500" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-1">No friends yet</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Search for friends by their @handle and start building your travel crew!
              </p>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {friends?.map((friendship, index) => (
                <motion.div
                  key={friendship.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "relative p-4 rounded-2xl bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group",
                    friendGradients[index % friendGradients.length]
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 ring-3 ring-white dark:ring-gray-800 shadow-md">
                      <AvatarImage src={friendship.friend?.avatar_url || undefined} />
                      <AvatarFallback className="bg-white dark:bg-gray-800 text-lg font-semibold">
                        {(friendship.friend?.display_name || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {friendship.friend?.display_name || 'Unknown'}
                      </p>
                      {friendship.friend?.handle && (
                        <p className="text-sm text-muted-foreground">@{friendship.friend.handle}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action buttons on hover */}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRemoveFriend(friendship.id)}
                      disabled={removeFriend.isPending}
                      className="h-8 w-8 p-0 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                      title="Remove friend"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Link to trip indicator */}
                  <div className="mt-3 flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs rounded-full bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 gap-1"
                    >
                      <Link2 className="h-3 w-3" />
                      Link to trip
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
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 px-6 rounded-2xl bg-gradient-to-br from-muted/30 via-muted/20 to-transparent border-2 border-dashed border-muted"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-sky-500" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-1">No pending requests</h3>
              <p className="text-muted-foreground text-sm">When someone sends you a friend request, it will appear here</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {pendingRequests?.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-900/10 dark:to-orange-900/10 rounded-xl border border-rose-200/50 dark:border-rose-800/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-gray-800">
                        <AvatarImage src={request.requester?.avatar_url || undefined} />
                        <AvatarFallback className="bg-rose-100 text-rose-700">
                          {(request.requester?.display_name || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 rounded-full flex items-center justify-center">
                        <UserPlus className="h-2.5 w-2.5 text-white" />
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {request.requester?.display_name || 'Unknown'}
                      </p>
                      {request.requester?.handle && (
                        <p className="text-sm text-muted-foreground">
                          @{request.requester.handle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptRequest(request.id)}
                      disabled={acceptRequest.isPending}
                      className="rounded-full gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineRequest(request.id)}
                      disabled={declineRequest.isPending}
                      className="rounded-full"
                    >
                      <X className="h-4 w-4" />
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
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 px-6 rounded-2xl bg-gradient-to-br from-muted/30 via-muted/20 to-transparent border-2 border-dashed border-muted"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-violet-500" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-1">No sent requests</h3>
              <p className="text-muted-foreground text-sm">When you send friend requests, they will appear here</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {outgoingRequests?.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={request.addressee?.avatar_url || undefined} />
                      <AvatarFallback>
                        {(request.addressee?.display_name || request.addressee?.handle || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">
                        {request.addressee?.display_name || request.addressee?.handle || 'Unknown'}
                      </p>
                      {request.addressee?.handle && (
                        <p className="text-sm text-muted-foreground">
                          @{request.addressee.handle}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1 rounded-full">
                    <Clock className="h-3 w-3" />
                    Awaiting response
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Info about trip linking */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/10 dark:via-purple-900/10 dark:to-pink-900/10 border border-indigo-100 dark:border-indigo-800/30"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <Plane className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h4 className="font-medium text-foreground">Trip Linking</h4>
            <p className="text-sm text-muted-foreground mt-0.5">
              Link friends to specific trips to include their preferences in your itinerary. 
              Perfect for group trips where everyone's tastes matter!
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
