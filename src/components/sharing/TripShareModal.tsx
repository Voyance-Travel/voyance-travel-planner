/**
 * Trip Share Modal Component
 * Shareable modal with link, social buttons, email, and referral credits
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  Link2, Mail, Copy, Check, MessageCircle, 
  Share2, Users, Gift, X
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FirstUseHint } from '@/components/itinerary/FirstUseHint';
import { resolveInviteLink, getInviteErrorMessage } from '@/services/inviteResolver';

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
  const [shareLink, setShareLink] = useState(initialShareLink || '');
  const [copied, setCopied] = useState(false);
  const [friendEmails, setFriendEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);

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
    setShareLink('');
    setCopied(false);
  }, [tripId]);

  const getOrCreateShareLink = async () => {
    if (shareLink) return shareLink;
    
    setIsCreatingLink(true);
    try {
      // Use centralized resolver
      const result = await resolveInviteLink(tripId);
      if (!result.success || !result.link) {
        toast.error(getInviteErrorMessage(result.reason));
        return '';
      }
      setShareLink(result.link);
      return result.link;
    } catch (e) {
      console.error('Failed to create share link:', e);
      toast.error('Failed to create share link. Please try again.');
      return '';
    } finally {
      setIsCreatingLink(false);
    }
  };

  const copyLink = async () => {
    const link = await getOrCreateShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error('Failed to copy link');
    }
  };

  const shareNative = async () => {
    const link = await getOrCreateShareLink();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: tripName,
          text: `Check out my trip to ${destination}! Plan yours too and get 150 bonus credits.`,
          url: link,
        });
      } catch (e) {
        // User cancelled or not supported
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const shareWhatsApp = async () => {
    const link = await getOrCreateShareLink();
    const text = encodeURIComponent(
      `Check out my trip to ${destination}! Plan your own and get 150 bonus credits to get started: ${link}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareTwitter = async () => {
    const link = await getOrCreateShareLink();
    const text = encodeURIComponent(`Just planned my trip to ${destination} with @Voyance_Travel! 🌍✨`);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(link)}`,
      '_blank'
    );
  };

  const sendEmail = async () => {
    if (!friendEmail) return;
    
    const link = await getOrCreateShareLink();
    const subject = encodeURIComponent(`You should see my ${destination} trip!`);
    const body = encodeURIComponent(
      `Hey!\n\n` +
      `I just planned an amazing trip to ${destination} and thought you'd love to see it.\n\n` +
      `Check it out: ${link}\n\n` +
      `When you sign up with Voyance, you'll get 150 bonus credits to get started!\n\n` +
      `Let me know what you think!`
    );
    
    window.open(`mailto:${friendEmail}?subject=${subject}&body=${body}`, '_blank');
    setFriendEmail('');
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

        <div className="space-y-6 py-2">
          {/* First-use hint */}
          <FirstUseHint
            hintKey="share_hint_shown"
            message="New: You can choose how guests interact. Let them edit freely, or use Propose & Vote so you stay in control."
          />
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
                They get 150 credits to start!
              </p>
            </div>
            <Badge className="bg-primary/20 text-primary border-0 text-xs">
              Free
            </Badge>
          </div>

          {/* Share Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Share Link</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={shareLink || 'Click to generate link...'}
                  readOnly
                  className="pr-10 text-sm"
                  onClick={getOrCreateShareLink}
                />
                {shareLink && (
                  <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
                disabled={isCreatingLink}
                className={cn(copied && "bg-green-500/10 text-green-600 border-green-500/30")}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="grid grid-cols-4 gap-2">
            <button 
              onClick={copyLink}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors",
                copied 
                  ? "bg-green-500/10 text-green-600" 
                  : "bg-secondary hover:bg-secondary/80 text-foreground"
              )}
            >
              {copied ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
              <span className="text-xs font-medium">{copied ? 'Copied!' : 'Copy'}</span>
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

          {/* Email a Friend */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Send to a friend
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="friend@email.com"
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendEmail()}
                className="flex-1"
              />
              <Button 
                onClick={sendEmail}
                disabled={!friendEmail || !friendEmail.includes('@')}
                size="icon"
              >
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview Mode Note */}
          <p className="text-xs text-center text-muted-foreground">
            Friends can view your full itinerary without logging in
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TripShareModal;
