/**
 * Referral Share Modal
 * 
 * Share modal that appears after trip generation
 * 150 credit bonus to both sides
 * Attribution tracking for referrals
 */

import { useState, useEffect } from 'react';
import { getAppUrl } from '@/utils/getAppUrl';
import { 
  Gift, Link2, Copy, Check, MessageCircle, Mail, 
  Share2, Users, X, Sparkles, ArrowRight
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
import { supabase } from '@/integrations/supabase/client';

interface ReferralShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId?: string;
  tripName?: string;
  destination?: string;
}

export function ReferralShareModal({ 
  isOpen, 
  onClose, 
  tripId,
  tripName,
  destination,
}: ReferralShareModalProps) {
  const [referralLink, setReferralLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [friendEmails, setFriendEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  // Generate or fetch referral link on mount
  useEffect(() => {
    if (isOpen && !referralLink) {
      generateReferralLink();
    }
  }, [isOpen]);

  const generateReferralLink = async () => {
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Use a generic shareable link for anonymous users
        const shareLink = tripId 
          ? `${getAppUrl()}/trip/${tripId}?ref=share`
          : `${getAppUrl()}?ref=share`;
        setReferralLink(shareLink);
        return;
      }

      // Generate a unique referral code for the user
      const code = `${user.id.slice(0, 8)}-${Date.now().toString(36)}`;
      setReferralCode(code);
      
      const shareLink = tripId
        ? `${getAppUrl()}/trip/${tripId}?ref=${code}`
        : `${getAppUrl()}/start?ref=${code}`;
      setReferralLink(shareLink);
      
      // Store referral code in database for tracking
      await supabase
        .from('referral_codes' as any)
        .upsert(
          { user_id: user.id, code, trip_id: tripId || null },
          { onConflict: 'code' }
        );
    } catch (e) {
      console.error('Failed to generate referral link:', e);
      const fallbackLink = tripId 
        ? `${getAppUrl()}/trip/${tripId}`
        : getAppUrl();
      setReferralLink(fallbackLink);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error('Failed to copy link');
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tripName || 'Join me on Voyance',
          text: destination 
            ? `I'm planning a trip to ${destination}! Join Voyance and get 150 free credits.`
            : 'Join Voyance and get 150 free credits to plan your personalized trip!',
          url: referralLink,
        });
      } catch (e) {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      destination
        ? `I just planned an amazing trip to ${destination}! Join Voyance and get 150 bonus credits to try it yourself: ${referralLink}`
        : `Check out Voyance for AI-powered travel planning! Use my link to get 150 bonus credits: ${referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(
      destination 
        ? `Just planned my trip to ${destination} with @Voyance_Travel! 🌍✨ Get 150 free credits:` 
        : 'Discovered @Voyance_Travel for personalized trip planning! 🌍✨ Get 150 free credits:'
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(referralLink)}`,
      '_blank'
    );
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

  const sendEmail = () => {
    if (emailInput) addEmail(emailInput);
    if (friendEmails.length === 0 && !emailInput) return;
    
    const subject = encodeURIComponent(
      destination 
        ? `You should see my ${destination} trip!`
        : 'You need to try this travel planning app'
    );
    const body = encodeURIComponent(
      `Hey!\n\n` +
      (destination 
        ? `I just planned an amazing trip to ${destination} using Voyance. It creates personalized itineraries based on how you actually travel.\n\n`
        : `I found this amazing app called Voyance that creates personalized travel itineraries. It asks how you like to travel and builds trips just for you.\n\n`
      ) +
      `Use my referral link to sign up and you'll get 150 bonus credits to get started:\n${referralLink}\n\n` +
      `Let me know what you think!`
    );
    
    window.open(`mailto:${friendEmails.join(',')}?subject=${subject}&body=${body}`, '_blank');
    setFriendEmails([]);
    setEmailInput('');
    toast.success('Opening email...');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Share & Earn Credits
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Hero Banner */}
          <div className="relative p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20 overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">150 Credits Each</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You get 150 credits. They get 150 credits. Everyone wins.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                <Badge className="bg-primary/20 text-primary border-0">
                  That's 1 free day unlocked
                </Badge>
              </div>
            </div>
            {/* Decorative */}
            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          </div>

          {/* Share Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Referral Link</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={isGenerating ? 'Generating...' : referralLink}
                  readOnly
                  className="pr-10 text-sm font-mono"
                />
                <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
                disabled={isGenerating}
                className={cn(copied && "bg-green-500/10 text-green-600 border-green-500/30")}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Quick Share Buttons */}
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
              <span className="text-xs font-medium">X</span>
            </button>
          </div>

          {/* Invite Friends */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Invite friends
            </label>
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
              <Button 
                onClick={sendEmail}
                disabled={friendEmails.length === 0 && !emailInput}
                size="icon"
              >
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* How it works */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              When friends sign up using your link, you both get 150 credits automatically.
              <br />
              No limit on referrals!
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ReferralShareModal;
