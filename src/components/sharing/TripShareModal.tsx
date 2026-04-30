/**
 * Trip Share Modal Component
 *
 * Two distinct sharing modes, presented in this order:
 *   1. "Public Link" (PRIMARY) — read-only /trip-share/:token. No sign-in required.
 *   2. "Invite to collaborate" — /invite/:token. Recipient signs in and joins.
 *
 * The public link is the default share action: clicking Copy / Share /
 * WhatsApp / X always uses the public link, falling back to creating it
 * on-demand if it does not yet exist.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Link2, Mail, Copy, Check, MessageCircle,
  Share2, Users, Gift, X, Globe, Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  getPublicTripShareLink,
  getOrCreatePublicTripShareLink,
  disablePublicTripShareLink,
  getPublicShareErrorMessage,
} from '@/services/publicShareLink';

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
}: TripShareModalProps) {
  // Invite link state (collaboration)
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [friendEmails, setFriendEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  // Public share state (read-only view)
  const [publicShareEnabled, setPublicShareEnabled] = useState(false);
  const [publicShareUrl, setPublicShareUrl] = useState<string>('');
  const [publicCopied, setPublicCopied] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [isPreparingPublicLink, setIsPreparingPublicLink] = useState(false);

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

  // Reset state when tripId changes
  useEffect(() => {
    setInviteLink('');
    setInviteCopied(false);
    setPublicShareEnabled(false);
    setPublicShareUrl('');
  }, [tripId]);

  // Load (and auto-enable) the public share link when the modal opens.
  // Public share is the primary path, so we proactively create it for the
  // owner so Copy / Share / social buttons always have a working link.
  useEffect(() => {
    if (!isOpen || !tripId) return;
    let cancelled = false;

    const loadOrCreatePublicLink = async () => {
      setIsPreparingPublicLink(true);
      try {
        // First read existing state without mutating.
        const existing = await getPublicTripShareLink(tripId);
        if (cancelled) return;

        if (existing.success && existing.enabled && existing.link) {
          setPublicShareEnabled(true);
          setPublicShareUrl(existing.link);
          return;
        }

        // Auto-enable for the owner. If they are not the owner the RPC
        // will return not_owner / not_authenticated and we leave the
        // toggle off so they can still see the modal.
        const created = await getOrCreatePublicTripShareLink(tripId);
        if (cancelled) return;

        if (created.success && created.link) {
          setPublicShareEnabled(true);
          setPublicShareUrl(created.link);
        } else {
          setPublicShareEnabled(false);
          setPublicShareUrl('');
        }
      } finally {
        if (!cancelled) setIsPreparingPublicLink(false);
      }
    };

    loadOrCreatePublicLink();
    return () => {
      cancelled = true;
    };
  }, [isOpen, tripId]);

  const togglePublicShare = async (next: boolean) => {
    setIsTogglingPublic(true);
    try {
      if (next) {
        const result = await getOrCreatePublicTripShareLink(tripId);
        if (result.success && result.link) {
          setPublicShareEnabled(true);
          setPublicShareUrl(result.link);
          toast.success('Public link enabled');
        } else {
          toast.error(getPublicShareErrorMessage(result.reason));
        }
      } else {
        const result = await disablePublicTripShareLink(tripId);
        if (result.success) {
          setPublicShareEnabled(false);
          toast.success('Public link disabled');
        } else {
          toast.error(getPublicShareErrorMessage(result.reason));
        }
      }
    } finally {
      setIsTogglingPublic(false);
    }
  };

  /**
   * Always returns a working public share URL, creating it on-demand if
   * needed. Prevents Copy / native share / social buttons from firing
   * with an empty string.
   */
  const ensurePublicLink = useCallback(async (): Promise<string> => {
    if (publicShareEnabled && publicShareUrl) return publicShareUrl;
    setIsPreparingPublicLink(true);
    try {
      const result = await getOrCreatePublicTripShareLink(tripId);
      if (result.success && result.link) {
        setPublicShareEnabled(true);
        setPublicShareUrl(result.link);
        return result.link;
      }
      toast.error(getPublicShareErrorMessage(result.reason));
      return '';
    } finally {
      setIsPreparingPublicLink(false);
    }
  }, [publicShareEnabled, publicShareUrl, tripId]);

  const copyPublicLink = async () => {
    const link = await ensurePublicLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setPublicCopied(true);
      toast.success('Public link copied!');
      setTimeout(() => setPublicCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const shareNative = async () => {
    const link = await ensurePublicLink();
    if (!link) return;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: tripName,
          text: `Check out my trip to ${destination}!`,
          url: link,
        });
      } catch {
        // user cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        toast.success('Link copied!');
      } catch {
        toast.error('Failed to copy');
      }
    }
  };

  const shareWhatsApp = async () => {
    const link = await ensurePublicLink();
    if (!link) return;
    const text = encodeURIComponent(`Check out my trip to ${destination}! ${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareTwitter = async () => {
    const link = await ensurePublicLink();
    if (!link) return;
    const text = encodeURIComponent(
      `Just planned my trip to ${destination} with @Voyance_Travel! 🌍✨`,
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(link)}`,
      '_blank',
    );
  };

  // ===== Invite link (collaborator flow) =====
  const getOrCreateInviteLink = async (): Promise<string> => {
    if (inviteLink) return inviteLink;
    setIsCreatingInvite(true);
    try {
      const result = await resolveInviteLink(tripId);
      if (!result.success || !result.link) {
        toast.error(getInviteErrorMessage(result.reason));
        return '';
      }
      setInviteLink(result.link);
      return result.link;
    } catch (e) {
      console.error('Failed to create invite link:', e);
      toast.error('Failed to create invite link. Please try again.');
      return '';
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const copyInviteLink = async () => {
    const link = await getOrCreateInviteLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setInviteCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const sendEmail = async () => {
    if (emailInput.trim()) {
      const email = emailInput.trim().toLowerCase();
      if (
        isValidEmail(email) &&
        !friendEmails.includes(email) &&
        friendEmails.length < 10
      ) {
        friendEmails.push(email);
        setEmailInput('');
      }
    }
    if (friendEmails.length === 0) return;

    const link = await getOrCreateInviteLink();
    if (!link) return;
    const subject = encodeURIComponent(`Join my ${destination} trip!`);
    const body = encodeURIComponent(
      `Hey!\n\n` +
      `I'm planning a trip to ${destination} and want you to join!\n\n` +
      `Accept the invite here: ${link}\n\n` +
      `You'll be able to view and collaborate on the itinerary together.`,
    );

    window.open(
      `mailto:${friendEmails.join(',')}?subject=${subject}&body=${body}`,
      '_blank',
    );
    setFriendEmails([]);
    toast.success('Opening email...');
  };

  const quickActionDisabled = isPreparingPublicLink;

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
          <FirstUseHint
            hintKey="share_hint_shown"
            message="Public links let anyone view your itinerary—no sign in needed. Use 'Invite to collaborate' if you want them to edit."
          />

          {/* Public Read-Only Link — primary share surface */}
          <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <Label className="text-sm font-medium">Public link</Label>
                  <p className="text-xs text-muted-foreground">
                    Anyone with the link can view the itinerary. No sign-in required.
                  </p>
                </div>
              </div>
              <Switch
                checked={publicShareEnabled}
                onCheckedChange={togglePublicShare}
                disabled={isTogglingPublic || isPreparingPublicLink}
              />
            </div>

            {(publicShareEnabled || isPreparingPublicLink) && (
              <div className="flex gap-2">
                <Input
                  value={
                    publicShareUrl ||
                    (isPreparingPublicLink ? 'Preparing your link…' : '')
                  }
                  readOnly
                  className="text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyPublicLink}
                  disabled={!publicShareUrl || isPreparingPublicLink}
                  className={cn(
                    publicCopied && 'bg-green-500/10 text-green-600 border-green-500/30',
                  )}
                  aria-label="Copy public link"
                >
                  {isPreparingPublicLink ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : publicCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Quick Share (always uses public link) */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={copyPublicLink}
              disabled={quickActionDisabled}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors',
                publicCopied
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-secondary hover:bg-secondary/80 text-foreground',
                quickActionDisabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {publicCopied ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
              <span className="text-xs font-medium">{publicCopied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={shareNative}
              disabled={quickActionDisabled}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors',
                quickActionDisabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Share2 className="h-5 w-5" />
              <span className="text-xs font-medium">Share</span>
            </button>

            <button
              onClick={shareWhatsApp}
              disabled={quickActionDisabled}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-colors',
                quickActionDisabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs font-medium">WhatsApp</span>
            </button>

            <button
              onClick={shareTwitter}
              disabled={quickActionDisabled}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] transition-colors',
                quickActionDisabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <X className="h-5 w-5" />
              <span className="text-xs font-medium">X / Twitter</span>
            </button>
          </div>

          {/* Invite to Collaborate */}
          <div className="space-y-2 pt-1 border-t border-border/60">
            <label className="text-sm font-medium flex items-center gap-2 pt-3">
              <Users className="h-4 w-4" />
              Invite to collaborate
            </label>
            <p className="text-xs text-muted-foreground">
              Friends sign in and can edit the itinerary with you. Different from the public link above.
            </p>

            {inviteLink && (
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="text-xs font-mono" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyInviteLink}
                  disabled={isCreatingInvite}
                  className={cn(
                    inviteCopied && 'bg-green-500/10 text-green-600 border-green-500/30',
                  )}
                  aria-label="Copy invite link"
                >
                  {inviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}

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
                  placeholder={friendEmails.length === 0 ? 'Add emails, press Enter or comma' : ''}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  onBlur={() => emailInput.trim() && addEmail(emailInput)}
                  className="flex-1 min-w-[120px] py-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button
                onClick={sendEmail}
                disabled={(friendEmails.length === 0 && !emailInput.trim()) || isCreatingInvite}
                size="icon"
                aria-label="Send invite email"
              >
                {isCreatingInvite ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
              </Button>
            </div>

            {!inviteLink && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={copyInviteLink}
                disabled={isCreatingInvite}
              >
                {isCreatingInvite ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Creating invite link…
                  </>
                ) : (
                  'Generate collaborator invite link'
                )}
              </Button>
            )}
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
