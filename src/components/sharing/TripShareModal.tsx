/**
 * Trip Share Modal Component
 * 
 * Two distinct sharing modes:
 * 1. "Invite to Trip" — generates /invite/:token links for collaboration
 * 2. "Public Link" — generates /trip-share/:token read-only links for viewing
 * 
 * These are architecturally separate: invite links require auth and add
 * the recipient as a collaborator; public links show a sanitized read-only view.
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  Link2, Mail, Copy, Check, MessageCircle, 
  Share2, Users, Gift, X, Eye, Globe
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FirstUseHint } from '@/components/itinerary/FirstUseHint';
import { resolveInviteLink, getInviteErrorMessage } from '@/services/inviteResolver';
import { supabase } from '@/integrations/supabase/client';
import { getAppUrl } from '@/utils/getAppUrl';

interface TripShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
  destination: string;
  shareLink?: string;
  onCreateShareLink?: () => Promise<string>;
}

export function TripShareModal({ 
  isOpen, 
  onClose, 
  tripId,
  tripName,
  destination,
  shareLink: initialShareLink,
  onCreateShareLink
}: TripShareModalProps) {
  // Invite link state (collaboration)
  const [inviteLink, setInviteLink] = useState(initialShareLink || '');
  const [copied, setCopied] = useState(false);
  const [friendEmails, setFriendEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null);

  // Public share state (read-only view)
  const [publicShareEnabled, setPublicShareEnabled] = useState(false);
  const [publicShareToken, setPublicShareToken] = useState<string | null>(null);
  const [publicCopied, setPublicCopied] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const addEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) {
      toast.error(`"${email}" is not a valid email`);
      return;
    }
    if (friendEmails.includes(email)) {
      toast.error('Email already added');
      return;
    }
    if (friendEmails.length >= 10) {
      toast.error('Maximum 10 recipients');
      return;
    }
    setFriendEmails(prev => [...prev, email]);
    setEmailInput('');
  };

  const removeEmail = (email: string) => {
    setFriendEmails(prev => prev.filter(e => e !== email));
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(emailInput);
    }
    if (e.key === 'Backspace' && !emailInput && friendEmails.length > 0) {
      setFriendEmails(prev => prev.slice(0, -1));
    }
  };

  // Reset share state when tripId changes
  useEffect(() => {
    setInviteLink('');
    setCopied(false);
  }, [tripId]);

  // Load public share status on open
  useEffect(() => {
    if (!isOpen || !tripId) return;
    const loadShareStatus = async () => {
      const { data } = await supabase
        .from('trips')
        .select('share_enabled, share_token')
        .eq('id', tripId)
        .single();
      if (data) {
        setPublicShareEnabled(data.share_enabled || false);
        setPublicShareToken(data.share_token || null);
      }
    };
    loadShareStatus();
  }, [isOpen, tripId]);

  const getOrCreateInviteLink = async () => {
    if (inviteLink) return inviteLink;
    
    setIsCreatingLink(true);
    try {
      const result = await resolveInviteLink(tripId);
      if (!result.success || !result.link) {
        toast.error(getInviteErrorMessage(result.reason));
        return '';
      }
      setInviteLink(result.link);
      if (result.maxUses != null && result.usesCount != null) {
        setSpotsRemaining(result.maxUses - result.usesCount);
      }
      return result.link;
    } catch (e) {
      console.error('Failed to create invite link:', e);
      toast.error('Failed to create invite link. Please try again.');
      return '';
    } finally {
      setIsCreatingLink(false);
    }
  };

  const copyInviteLink = async () => {
    const link = await getOrCreateInviteLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error('Failed to copy link');
    }
  };

  const togglePublicShare = async () => {
    setIsTogglingPublic(true);
    try {
      const newEnabled = !publicShareEnabled;
      const { data, error } = await supabase.rpc('toggle_consumer_trip_share', {
        p_trip_id: tripId,
        p_enabled: newEnabled,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; share_enabled: boolean; share_token: string; reason?: string };
      if (result.success) {
        setPublicShareEnabled(result.share_enabled);
        setPublicShareToken(result.share_token);
        toast.success(result.share_enabled ? 'Public link enabled' : 'Public link disabled');
      } else {
        toast.error('Failed to update sharing');
      }
    } catch (e) {
      console.error('Failed to toggle public share:', e);
      toast.error('Failed to update sharing');
    } finally {
      setIsTogglingPublic(false);
    }
  };

  const publicShareUrl = publicShareToken ? `${getAppUrl()}/trip-share/${publicShareToken}` : '';

  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicShareUrl);
      setPublicCopied(true);
      toast.success('Public link copied!');
      setTimeout(() => setPublicCopied(false), 2000);
    } catch (e) {
      toast.error('Failed to copy link');
    }
  };

  const shareNative = async () => {
    const link = publicShareEnabled && publicShareUrl ? publicShareUrl : await getOrCreateInviteLink();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: tripName,
          text: `Check out my trip to ${destination}!`,
          url: link,
        });
      } catch (e) {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        toast.success('Link copied!');
      } catch (e) {
        toast.error('Failed to copy');
      }
    }
  };

  const shareWhatsApp = async () => {
    const link = publicShareEnabled && publicShareUrl ? publicShareUrl : await getOrCreateInviteLink();
    const text = encodeURIComponent(
      `Check out my trip to ${destination}! ${link}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareTwitter = async () => {
    const link = publicShareEnabled && publicShareUrl ? publicShareUrl : await getOrCreateInviteLink();
    const text = encodeURIComponent(`Just planned my trip to ${destination} with @Voyance_Travel! 🌍✨`);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(link)}`,
      '_blank'
    );
  };

  const sendEmail = async () => {
    if (emailInput.trim()) {
      const email = emailInput.trim().toLowerCase();
      if (isValidEmail(email) && !friendEmails.includes(email) && friendEmails.length < 10) {
        friendEmails.push(email);
        setEmailInput('');
      }
    }
    if (friendEmails.length === 0) return;
    
    const link = await getOrCreateInviteLink();
    const subject = encodeURIComponent(`Join my ${destination} trip!`);
    const body = encodeURIComponent(
      `Hey!\n\n` +
      `I'm planning a trip to ${destination} and want you to join!\n\n` +
      `Accept the invite here: ${link}\n\n` +
      `You'll be able to view and collaborate on the itinerary together.`
    );
    
    window.open(`mailto:${friendEmails.join(',')}?subject=${subject}&body=${body}`, '_blank');
    setFriendEmails([]);
    toast.success('Opening email...');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share Your Trip
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* First-use hint */}
          <FirstUseHint
            hintKey="share_hint_shown"
            message="New: You can choose how guests interact. Let them edit freely, or use Propose & Vote so you stay in control."
          />

          {/* Public Read-Only Link */}
          <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Public Link</Label>
                  <p className="text-xs text-muted-foreground">Anyone with the link can view</p>
                </div>
              </div>
              <Switch
                checked={publicShareEnabled}
                onCheckedChange={togglePublicShare}
                disabled={isTogglingPublic}
              />
            </div>

            {publicShareEnabled && publicShareUrl && (
              <div className="flex gap-2">
                <Input
                  value={publicShareUrl}
                  readOnly
                  className="text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyPublicLink}
                  className={cn(publicCopied && "bg-green-500/10 text-green-600 border-green-500/30")}
                >
                  {publicCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>

          {/* Quick Share Buttons */}
          <div className="grid grid-cols-4 gap-2">
            <button 
              onClick={publicShareEnabled ? copyPublicLink : copyInviteLink}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors",
                (copied || publicCopied) 
                  ? "bg-green-500/10 text-green-600" 
                  : "bg-secondary hover:bg-secondary/80 text-foreground"
              )}
            >
              {(copied || publicCopied) ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
              <span className="text-xs font-medium">{(copied || publicCopied) ? 'Copied!' : 'Copy'}</span>
            </button>
            
            <button 
              onClick={shareNative}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <Share2 className="h-5 w-5" />
              <span className="text-xs font-medium">Share</span>
            </button>
            
            <button 
              onClick={shareWhatsApp}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs font-medium">WhatsApp</span>
            </button>
            
            <button 
              onClick={shareTwitter}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] transition-colors"
            >
              <X className="h-5 w-5" />
              <span className="text-xs font-medium">X / Twitter</span>
            </button>
          </div>

          {/* Invite to Collaborate */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Invite to collaborate
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[40px] px-3 py-1.5 border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring">
                {friendEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="hover:text-destructive"
                      aria-label={`Remove ${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={friendEmails.length === 0 ? "Add emails, press Enter or comma" : ""}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  onBlur={() => emailInput.trim() && addEmail(emailInput)}
                  className="flex-1 min-w-[120px] py-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button 
                onClick={sendEmail}
                disabled={friendEmails.length === 0 && !emailInput.trim()}
                size="icon"
              >
                <Mail className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Invited friends can join and collaborate on this trip
              {spotsRemaining != null && (
                <span className="ml-1">({spotsRemaining} spots remaining)</span>
              )}
            </p>
          </div>

          {/* Referral Bonus Banner */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <div className="p-2 rounded-full bg-primary/20">
              <Gift className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Friends get 150 bonus credits
              </p>
              <p className="text-xs text-muted-foreground">
                When they sign up and plan their own trip
              </p>
            </div>
            <Badge className="bg-primary/20 text-primary border-0 text-xs">
              Free
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TripShareModal;
