/**
 * Share Guide Sheet
 * 
 * Comprehensive sharing options for travel guides including:
 * - Email
 * - SMS/Text
 * - WhatsApp
 * - Facebook
 * - Twitter/X
 * - LinkedIn
 * - Copy Link
 */

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Mail, MessageSquare, Copy, Check, Share2,
  Facebook, Twitter, Linkedin, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface ShareGuideSheetProps {
  open: boolean;
  onClose: () => void;
  shareLink: string;
  destination: string;
  tripName?: string;
  onGenerateLink?: () => Promise<void>;
}

// WhatsApp icon component
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function ShareGuideSheet({
  open,
  onClose,
  shareLink,
  destination,
  tripName,
  onGenerateLink,
}: ShareGuideSheetProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const displayName = tripName || `Trip to ${destination}`;
  const shareText = `Check out my travel guide for ${destination}! 🌍✈️`;
  const encodedText = encodeURIComponent(shareText);
  const encodedLink = encodeURIComponent(shareLink);

  const handleCopyLink = async () => {
    if (!shareLink && onGenerateLink) {
      setIsGenerating(true);
      await onGenerateLink();
      setIsGenerating(false);
    }
    
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast.success('Link copied to clipboard!');
    }
  };

  const ensureLinkAndShare = async (shareAction: () => void) => {
    if (!shareLink && onGenerateLink) {
      setIsGenerating(true);
      await onGenerateLink();
      setIsGenerating(false);
    }
    shareAction();
  };

  const shareOptions = [
    {
      name: 'Email',
      icon: Mail,
      color: 'bg-blue-500 hover:bg-blue-600',
      action: () => {
        const subject = encodeURIComponent(`My Travel Guide: ${displayName}`);
        const body = encodeURIComponent(`${shareText}\n\n${shareLink}`);
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      },
    },
    {
      name: 'Text',
      icon: MessageSquare,
      color: 'bg-green-500 hover:bg-green-600',
      action: () => {
        const body = encodeURIComponent(`${shareText} ${shareLink}`);
        window.open(`sms:?body=${body}`, '_blank');
      },
    },
    {
      name: 'WhatsApp',
      icon: WhatsAppIcon,
      color: 'bg-[#25D366] hover:bg-[#20BD5A]',
      action: () => {
        window.open(`https://wa.me/?text=${encodedText}%20${encodedLink}`, '_blank');
      },
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-[#1877F2] hover:bg-[#166FE5]',
      action: () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}&quote=${encodedText}`, '_blank', 'width=600,height=400');
      },
    },
    {
      name: 'X',
      icon: Twitter,
      color: 'bg-black hover:bg-gray-800',
      action: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedLink}`, '_blank', 'width=600,height=400');
      },
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-[#0A66C2] hover:bg-[#094D92]',
      action: () => {
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`, '_blank', 'width=600,height=400');
      },
    },
  ];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share Travel Guide
          </SheetTitle>
          <SheetDescription>
            Share your {destination} travel guide with friends and family
          </SheetDescription>
        </SheetHeader>

        {/* Copy Link Section */}
        <div className="space-y-3 mb-6">
          <label className="text-sm font-medium text-foreground">Share Link</label>
          <div className="flex gap-2">
            <Input
              value={shareLink || 'Click to generate link...'}
              readOnly
              className="flex-1 text-sm bg-muted"
              onClick={!shareLink ? () => ensureLinkAndShare(() => {}) : undefined}
            />
            <Button
              onClick={handleCopyLink}
              disabled={isGenerating}
              className="gap-2 shrink-0"
            >
              {isCopied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {isCopied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Share Options Grid */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Share via</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {shareOptions.map((option) => (
              <Button
                key={option.name}
                variant="outline"
                className={`flex flex-col items-center gap-2 h-auto py-4 px-2 border-border hover:border-primary/50 transition-all`}
                onClick={() => ensureLinkAndShare(option.action)}
                disabled={isGenerating}
              >
                <div className={`w-10 h-10 rounded-full ${option.color} flex items-center justify-center text-white`}>
                  <option.icon />
                </div>
                <span className="text-xs font-medium">{option.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Native Share (if supported) */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <>
            <Separator className="my-4" />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => ensureLinkAndShare(async () => {
                try {
                  await navigator.share({
                    title: displayName,
                    text: shareText,
                    url: shareLink,
                  });
                } catch (err) {
                  // User cancelled or error
                  console.log('Share cancelled or failed:', err);
                }
              })}
              disabled={isGenerating}
            >
              <ExternalLink className="w-4 h-4" />
              More sharing options...
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
