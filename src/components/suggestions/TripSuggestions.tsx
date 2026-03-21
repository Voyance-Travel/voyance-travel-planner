/**
 * TripSuggestions — Suggestion board with voting for shared trips.
 * Supports authenticated users (direct DB) and anonymous users (via edge function + share token).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { registerSubscription, unregisterSubscription } from '@/lib/realtimeSubscriptionManager';
import { ThumbsUp, Plus, Lightbulb, User, Loader2, ArrowRightLeft, CalendarClock, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow, isPast, format } from 'date-fns';

interface Suggestion {
  id: string;
  display_name: string;
  user_id: string | null;
  suggestion_type: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  target_activity_id?: string | null;
  target_activity_title?: string | null;
  replacement_reason?: string | null;
  vote_deadline?: string | null;
  votes: Vote[];
}

interface Vote {
  id: string;
  voter_name: string;
  user_id: string | null;
  vote_type: string;
}

interface TripSuggestionsProps {
  tripId: string;
  tripType: 'consumer' | 'agency';
  shareToken?: string;
  className?: string;
}

const ANON_NAME_KEY = 'voyance_chat_name';

const SUGGESTION_TYPES = [
  { value: 'activity', label: '🎯 Activity' },
  { value: 'restaurant', label: '🍽️ Restaurant' },
  { value: 'accommodation', label: '🏨 Stay' },
  { value: 'general', label: '💡 General' },
];

export default function TripSuggestions({ tripId, tripType, shareToken, className }: TripSuggestionsProps) {
  const { user } = useAuth();
  const skipRealtimeRef = useRef(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [suggestionType, setSuggestionType] = useState('general');
  const [voteDeadline, setVoteDeadline] = useState('');
  const [anonName, setAnonName] = useState(() => {
    try { return sessionStorage.getItem(ANON_NAME_KEY) || ''; } catch { return ''; }
  });
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);
  const [editDeadlineValue, setEditDeadlineValue] = useState('');

  const isAnon = !user;
  const displayName = user
    ? (user.name || user.email?.split('@')[0] || 'Traveler')
    : anonName;
  const currentVoterIdentity = user?.id || anonName;

  // Load suggestions with votes
  const loadSuggestions = useCallback(async () => {
    const { data: suggestionsData, error: sugError } = await supabase
      .from('trip_suggestions')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (sugError) {
      console.error('Failed to load suggestions:', sugError);
      setLoading(false);
      return;
    }

    if (!suggestionsData || suggestionsData.length === 0) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    // Load votes for all suggestions
    const suggestionIds = suggestionsData.map(s => s.id);
    const { data: votesData } = await supabase
      .from('trip_suggestion_votes')
      .select('*')
      .in('suggestion_id', suggestionIds);

    const votesMap: Record<string, Vote[]> = {};
    (votesData || []).forEach((v: any) => {
      if (!votesMap[v.suggestion_id]) votesMap[v.suggestion_id] = [];
      votesMap[v.suggestion_id].push(v);
    });

    const merged: Suggestion[] = suggestionsData.map((s: any) => ({
      ...s,
      votes: votesMap[s.id] || [],
    }));

    // Sort by vote count descending
    merged.sort((a, b) => b.votes.length - a.votes.length);
    setSuggestions(merged);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // Realtime subscriptions via the subscription manager
  useEffect(() => {
    const key = `suggestions-${tripId}`;
    registerSubscription(key, () =>
      supabase
        .channel(key)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'trip_suggestions',
          filter: `trip_id=eq.${tripId}`,
        }, () => { if (Date.now() < skipRealtimeRef.current) return; loadSuggestions(); })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'trip_suggestion_votes',
        }, () => { if (Date.now() < skipRealtimeRef.current) return; loadSuggestions(); })
        .subscribe()
    );

    return () => { unregisterSubscription(key); };
  }, [tripId, loadSuggestions]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    if (isAnon && !anonName.trim()) {
      setShowNamePrompt(true);
      return;
    }

    setSubmitting(true);
    try {
      if (isAnon && shareToken) {
        const { error } = await supabase.functions.invoke('trip-suggestions', {
          body: {
            action: 'create_suggestion',
            tripId,
            shareToken,
            displayName: anonName.trim(),
            title: title.trim(),
            description: description.trim() || null,
            suggestionType,
            voteDeadline: voteDeadline ? new Date(voteDeadline).toISOString() : null,
          },
        });
        if (error) throw error;
      } else if (user) {
        const { error } = await supabase
          .from('trip_suggestions')
          .insert({
            trip_id: tripId,
            trip_type: tripType,
            user_id: user.id,
            display_name: displayName,
            suggestion_type: suggestionType,
            title: title.trim(),
            description: description.trim() || null,
            vote_deadline: voteDeadline ? new Date(voteDeadline).toISOString() : null,
          });
        if (error) throw error;

        // Notify other trip members about the new suggestion
        try {
          const { data: trip } = await supabase
            .from('trips')
            .select('user_id, name, destination')
            .eq('id', tripId)
            .maybeSingle();

          const { data: collabs } = await supabase
            .from('trip_collaborators')
            .select('user_id')
            .eq('trip_id', tripId)
            .not('accepted_at', 'is', null);

          const recipientIds = new Set<string>();
          if (trip?.user_id && trip.user_id !== user.id) recipientIds.add(trip.user_id);
          collabs?.forEach(c => { if (c.user_id && c.user_id !== user.id) recipientIds.add(c.user_id); });

          const deadlineText = voteDeadline ? ` Vote by ${new Date(voteDeadline).toLocaleDateString()}.` : '';
          const notifRows = Array.from(recipientIds).map(recipientId => ({
            trip_id: tripId,
            user_id: recipientId,
            notification_type: 'proposal_created',
            sent: false,
            metadata: {
              title: 'New suggestion',
              message: `${displayName} suggested "${title.trim()}" on ${trip?.name || 'your trip'}.${deadlineText}`,
              proposerName: displayName,
              tripName: trip?.name,
            },
          }));

          if (notifRows.length > 0) {
            await supabase.from('trip_notifications').insert(notifRows);
          }
        } catch (notifErr) {
          console.error('Failed to send suggestion notifications:', notifErr);
        }
      }

      setTitle('');
      setDescription('');
      setSuggestionType('general');
      setVoteDeadline('');
      setShowForm(false);
      toast.success('Suggestion added!');
    } catch (err) {
      console.error('Failed to submit suggestion:', err);
      toast.error('Failed to add suggestion');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, suggestionType, voteDeadline, isAnon, anonName, shareToken, tripId, tripType, user, displayName]);

  const handleVote = useCallback(async (suggestionId: string) => {
    // Check if already voted
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const existingVote = suggestion.votes.find(v =>
      user ? v.user_id === user.id : v.voter_name === anonName
    );

    try {
      if (isAnon && shareToken) {
        await supabase.functions.invoke('trip-suggestions', {
          body: {
            action: 'vote',
            tripId,
            shareToken,
            displayName: anonName.trim(),
            suggestionId,
            voteType: existingVote ? 'remove' : 'up',
          },
        });
      } else if (user) {
        if (existingVote) {
          await supabase
            .from('trip_suggestion_votes')
            .delete()
            .eq('id', existingVote.id);
        } else {
          await supabase
            .from('trip_suggestion_votes')
            .insert({
              suggestion_id: suggestionId,
              user_id: user.id,
              voter_name: displayName,
              vote_type: 'up',
            });
        }
      }
    } catch (err) {
      console.error('Vote failed:', err);
      toast.error('Failed to vote');
    }
  }, [suggestions, user, isAnon, anonName, shareToken, tripId, displayName]);

  const handleSetName = () => {
    if (!anonName.trim()) return;
    try { sessionStorage.setItem(ANON_NAME_KEY, anonName.trim()); } catch {}
    setShowNamePrompt(false);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const hasVoted = (suggestion: Suggestion) =>
    suggestion.votes.some(v =>
      user ? v.user_id === user.id : v.voter_name === anonName
    );

  const isOwner = (suggestion: Suggestion) =>
    user ? suggestion.user_id === user.id : false;

  const handleUpdateDeadline = useCallback(async (suggestionId: string, newDeadline: string | null) => {
    try {
      const { data, error } = await supabase
        .from('trip_suggestions')
        .update({ vote_deadline: newDeadline })
        .eq('id', suggestionId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error('Could not update deadline — you may not have permission');
        return;
      }
      setSuggestions(prev => prev.map(s =>
        s.id === suggestionId ? { ...s, vote_deadline: newDeadline } : s
      ));
      skipRealtimeRef.current = Date.now() + 2000;
      toast.success(newDeadline ? 'Deadline updated' : 'Deadline removed');
      setEditingDeadlineId(null);
      setEditDeadlineValue('');
    } catch (err) {
      console.error('Failed to update deadline:', err);
      toast.error('Failed to update deadline');
    }
  }, []);

  const minDeadline = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  // Name prompt for anonymous users
  if (showNamePrompt) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <Lightbulb className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-1">Add your name first</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your name to suggest and vote on ideas.
        </p>
        <div className="flex gap-2 w-full max-w-xs">
          <Input
            placeholder="Your name"
            value={anonName}
            onChange={(e) => setAnonName(e.target.value)}
            maxLength={50}
            onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
          />
          <Button onClick={handleSetName} disabled={!anonName.trim()}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Suggest
        </Button>
      </div>

      {/* New suggestion form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Type selector */}
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTION_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setSuggestionType(t.value)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-full border transition-colors",
                    suggestionType === t.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/50"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Input
              placeholder="What do you suggest?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Textarea
              placeholder="Add details (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={2}
              className="resize-none"
            />
            {/* Vote deadline */}
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                type="datetime-local"
                placeholder="Vote deadline (optional)"
                value={voteDeadline}
                onChange={(e) => setVoteDeadline(e.target.value)}
                min={minDeadline}
                className="text-xs h-8 flex-1"
              />
              {voteDeadline && (
                <button onClick={() => setVoteDeadline('')} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowForm(false); setTitle(''); setDescription(''); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !title.trim()}
                className="gap-1.5"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestions list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
          <Lightbulb className="h-8 w-8 mb-3 opacity-50" />
          <p className="text-sm">No suggestions yet.</p>
          <p className="text-xs">Be the first to suggest something for this trip!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map(suggestion => {
            const voted = hasVoted(suggestion);
            return (
              <Card key={suggestion.id} className="overflow-hidden">
                <CardContent className="p-3 flex gap-3">
                  {/* Vote button */}
                  <button
                    onClick={() => handleVote(suggestion.id)}
                    className={cn(
                      "flex flex-col items-center justify-center min-w-[48px] rounded-lg py-2 px-1 transition-colors",
                      voted
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <ThumbsUp className={cn("h-4 w-4 mb-0.5", voted && "fill-current")} />
                    <span className="text-sm font-semibold">{suggestion.votes.length}</span>
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Replacement context banner */}
                    {suggestion.target_activity_title && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1 mb-1.5">
                        <ArrowRightLeft className="h-3 w-3 shrink-0" />
                        <span>Replace <span className="font-medium text-foreground">{suggestion.target_activity_title}</span></span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 mb-1">
                      <p className="font-medium text-sm leading-snug flex-1">{suggestion.title}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                        {suggestion.suggestion_type === 'replacement' ? '🔄 Replace' : suggestion.suggestion_type}
                      </Badge>
                    </div>
                    {(suggestion.replacement_reason || suggestion.description) && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                        {suggestion.replacement_reason || suggestion.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[8px] bg-muted">
                            {suggestion.user_id ? getInitials(suggestion.display_name) : <User className="h-2.5 w-2.5" />}
                          </AvatarFallback>
                        </Avatar>
                        <span>{suggestion.display_name}</span>
                      </div>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}</span>
                    </div>
                    {/* Vote deadline */}
                    {suggestion.vote_deadline && (
                      <div className={cn(
                        "flex items-center gap-1.5 mt-1.5 text-[10px] px-2 py-1 rounded",
                        isPast(new Date(suggestion.vote_deadline))
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      )}>
                        <CalendarClock className="h-3 w-3 shrink-0" />
                        <span>
                          {isPast(new Date(suggestion.vote_deadline))
                            ? 'Voting closed'
                            : `Vote by ${format(new Date(suggestion.vote_deadline), 'MMM d, h:mm a')}`}
                        </span>
                        {!isPast(new Date(suggestion.vote_deadline)) && (
                          <span className="text-muted-foreground">
                            ({formatDistanceToNow(new Date(suggestion.vote_deadline), { addSuffix: false })} left)
                          </span>
                        )}
                        {isOwner(suggestion) && (
                          <Popover open={editingDeadlineId === suggestion.id} onOpenChange={(open) => {
                            if (open) {
                              setEditingDeadlineId(suggestion.id);
                              setEditDeadlineValue(
                                suggestion.vote_deadline
                                  ? new Date(suggestion.vote_deadline).toISOString().slice(0, 16)
                                  : ''
                              );
                            } else {
                              setEditingDeadlineId(null);
                            }
                          }}>
                            <PopoverTrigger asChild>
                              <button className="ml-auto hover:text-foreground transition-colors" title="Edit deadline">
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3 space-y-2" align="start">
                              <p className="text-xs font-medium">Change deadline</p>
                              <Input
                                type="datetime-local"
                                value={editDeadlineValue}
                                onChange={(e) => setEditDeadlineValue(e.target.value)}
                                min={minDeadline}
                                className="text-xs h-8"
                              />
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  onClick={() => handleUpdateDeadline(suggestion.id, null)}
                                >
                                  Remove
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs h-7"
                                  disabled={!editDeadlineValue}
                                  onClick={() => handleUpdateDeadline(suggestion.id, new Date(editDeadlineValue).toISOString())}
                                >
                                  Save
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    )}
                    {/* Add deadline if none set (owner only) */}
                    {!suggestion.vote_deadline && isOwner(suggestion) && (
                      <Popover open={editingDeadlineId === suggestion.id} onOpenChange={(open) => {
                        if (open) {
                          setEditingDeadlineId(suggestion.id);
                          setEditDeadlineValue('');
                        } else {
                          setEditingDeadlineId(null);
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                            <CalendarClock className="h-3 w-3" />
                            <span>Set deadline</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3 space-y-2" align="start">
                          <p className="text-xs font-medium">Set vote deadline</p>
                          <Input
                            type="datetime-local"
                            value={editDeadlineValue}
                            onChange={(e) => setEditDeadlineValue(e.target.value)}
                            min={minDeadline}
                            className="text-xs h-8"
                          />
                          <Button
                            size="sm"
                            className="text-xs h-7 w-full"
                            disabled={!editDeadlineValue}
                            onClick={() => handleUpdateDeadline(suggestion.id, new Date(editDeadlineValue).toISOString())}
                          >
                            Set deadline
                          </Button>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
