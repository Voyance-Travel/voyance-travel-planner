/**
 * Share Trip Card Component
 * Beautiful shareable card for social media and referrals
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Copy, Mail, Share2, 
  Instagram, Twitter, Check, Link2, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { parseLocalDate } from '@/utils/dateUtils';
import type { TripPhoto } from '@/hooks/useTripPhotos';
import { useBonusCredits } from '@/hooks/useBonusCredits';
import { resolveInviteLink, getInviteErrorMessage } from '@/services/inviteResolver';
import { supabase } from '@/integrations/supabase/client';

interface ShareTripCardProps {
  isOpen: boolean;
  onClose: () => void;
  trip: { id: string; destination: string; start_date?: string; name?: string };
  photos: TripPhoto[];
  highlights: { activity: string; why?: string }[];
}

export function ShareTripCard({ isOpen, onClose, trip, photos, highlights }: ShareTripCardProps) {
  const [friendEmails, setFriendEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const { claimBonus, hasClaimedBonus } = useBonusCredits();
  const hasTriggeredShareBonus = useRef(false);

  // Reset share state when trip changes
  useEffect(() => {
    setShareUrl('');
  }, [trip.id]);

  // Resolve public share link on open (prefer public read-only link over invite)
  useEffect(() => {
    if (!isOpen || shareUrl) return;
    const createLink = async () => {
      try {
        // First try to enable public share and get read-only link
        const { data: tripData } = await supabase
          .from('trips')
          .select('share_enabled, share_token')
          .eq('id', trip.id)
          .single();

        if (tripData?.share_enabled && tripData?.share_token) {
          const { getAppUrl: getUrl } = await import('@/utils/getAppUrl');
          setShareUrl(`${getUrl()}/trip-share/${tripData.share_token}`);
          return;
        }

        // Enable public share if not already enabled
        const { data: toggleResult } = await supabase.rpc('toggle_consumer_trip_share', {
          p_trip_id: trip.id,
          p_enabled: true,
        });
        const result = toggleResult as unknown as { success: boolean; share_token: string };
        if (result?.success && result?.share_token) {
          const { getAppUrl: getUrl } = await import('@/utils/getAppUrl');
          setShareUrl(`${getUrl()}/trip-share/${result.share_token}`);
          return;
        }

        // Fallback to invite link
        const inviteResult = await resolveInviteLink(trip.id);
        if (inviteResult.success && inviteResult.link) {
          setShareUrl(inviteResult.link);
        } else {
          console.error('[ShareTripCard] Invite resolution failed:', inviteResult.reason);
          toast.error(getInviteErrorMessage(inviteResult.reason));
        }
      } catch (e) {
        console.error('[ShareTripCard] Failed to create share link:', e);
      }
    };
    createLink();
  }, [isOpen, trip.id, shareUrl]);

  const triggerFirstShareBonus = async () => {
    if (hasTriggeredShareBonus.current || hasClaimedBonus('first_share')) return;
    hasTriggeredShareBonus.current = true;
    try {
      const result = await claimBonus('first_share');
      if (result.granted) {
        toast.success(`+${result.credits} credits earned for sharing your first trip! 📤`);
      }
    } catch (e) {
      console.error('[ShareTripCard] first_share bonus failed:', e);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
    triggerFirstShareBonus();
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My ${trip.destination} Trip`,
          text: `Check out my trip to ${trip.destination}! Planned with Voyance.`,
          url: shareUrl,
        });
        triggerFirstShareBonus();
      } catch (e) {
        // User cancelled
      }
    } else {
      copyLink();
    }
  };

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const addEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) { toast.error(`"${email}" isn't a valid email`); return; }
    if (friendEmails.includes(email)) { toast.error('Already added'); return; }
    if (friendEmails.length >= 10) { toast.error('Max 10 recipients'); return; }
    setFriendEmails(prev => [...prev, email]);
    setEmailInput('');
  };

  const removeEmail = (email: string) => setFriendEmails(prev => prev.filter(e => e !== email));

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(emailInput);
    } else if (e.key === 'Backspace' && !emailInput && friendEmails.length > 0) {
      setFriendEmails(prev => prev.slice(0, -1));
    }
  };

  const sendToFriend = () => {
    if (emailInput) addEmail(emailInput);
    if (friendEmails.length === 0 && !emailInput) return;
    
    const subject = encodeURIComponent(`You need to see ${trip.destination}`);
    const body = encodeURIComponent(
      `Hey!\n\nI just got back from ${trip.destination} and thought you'd love it.\n\n` +
      `Check out my trip: ${shareUrl}\n\n` +
      `Planned with Voyance.`
    );
    
    window.open(`mailto:${friendEmails.join(',')}?subject=${subject}&body=${body}`);
    setFriendEmails([]);
    setEmailInput('');
    toast.success('Opening email...');
    triggerFirstShareBonus();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Your Trip
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Preview Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-0.5 h-32">
                {photos.slice(0, 3).map((photo) => (
                  <div key={photo.id} className="overflow-hidden">
                    <img src={photo.publicUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 bg-gradient-to-br from-primary/60 to-primary/20" />
            )}
            
            <div className="p-4 text-white">
              <h3 className="text-lg font-semibold mb-1">{trip.destination}</h3>
              <p className="text-white/70 text-sm mb-3">
                {trip.start_date && parseLocalDate(trip.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
              
              {highlights.length > 0 && (
                <div className="border-t border-white/20 pt-3 mt-3">
                  <p className="text-xs text-white/60 mb-2">Highlights:</p>
                  {highlights.slice(0, 3).map((h, idx) => (
                    <p key={idx} className="text-sm text-white/90 truncate">• {h.activity}</p>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-1.5 mt-4 text-xs text-white/50">
                <span>Planned with</span>
                <span className="font-medium text-white/80">Voyance</span>
              </div>
            </div>
          </div>

          {/* Share Options */}
          <div className="grid grid-cols-4 gap-2">
            <button onClick={copyLink} className={cn("flex flex-col items-center gap-1 p-3 rounded-lg transition-colors", copied ? "bg-green-500/10 text-green-600" : "bg-muted hover:bg-muted/80")}>
              {copied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}
              <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button onClick={shareNative} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted hover:bg-muted/80">
              <Share2 className="w-5 h-5" />
              <span className="text-xs">Share</span>
            </button>
            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just got back from ${trip.destination}!`)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted hover:bg-muted/80">
              <Twitter className="w-5 h-5" />
              <span className="text-xs">Twitter</span>
            </a>
            <button onClick={() => toast.info('Instagram sharing coming soon!')} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted hover:bg-muted/80">
              <Instagram className="w-5 h-5" />
              <span className="text-xs">Story</span>
            </button>
          </div>

          {/* Invite Friends */}
          <div className="space-y-3">
            <p className="text-sm font-medium flex items-center gap-2"><Users className="w-4 h-4" />Invite friends</p>
            <p className="text-xs text-muted-foreground">This link works for everyone - share it with your whole group</p>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring">
                {friendEmails.map(email => (
                  <Badge key={email} variant="secondary" className="gap-1 text-xs">
                    {email}
                    <button type="button" onClick={() => removeEmail(email)} className="ml-0.5 hover:text-destructive">×</button>
                  </Badge>
                ))}
                <input
                  type="email"
                  placeholder={friendEmails.length === 0 ? "friend@email.com" : "Add another..."}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  onBlur={() => emailInput && addEmail(emailInput)}
                  className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button onClick={sendToFriend} disabled={friendEmails.length === 0 && !emailInput}><Mail className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
