import { useState, useEffect } from 'react';
import { Copy, Check, Link2, ExternalLink, RefreshCw } from 'lucide-react';
import { getAppUrl } from '@/utils/getAppUrl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ShareTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripName: string;
}

export default function ShareTripModal({ open, onOpenChange, tripId, tripName }: ShareTripModalProps) {
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (open && tripId) {
      loadShareSettings();
    }
  }, [open, tripId]);

  const loadShareSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agency_trips')
        .select('share_enabled, share_token')
        .eq('id', tripId)
        .single();

      if (error) throw error;
      setShareEnabled(data.share_enabled || false);
      setShareToken(data.share_token);
    } catch (err) {
      console.error('Error loading share settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateToken = () => {
    // Use crypto.getRandomValues for cryptographically secure token generation
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    // Convert to base64url format (URL-safe)
    const base64 = btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return base64.slice(0, 16); // 16 character token
  };

  const toggleSharing = async () => {
    try {
      const newEnabled = !shareEnabled;
      let newToken = shareToken;

      // Generate token if enabling and no token exists
      if (newEnabled && !shareToken) {
        newToken = generateToken();
      }

      const { error } = await supabase
        .from('agency_trips')
        .update({
          share_enabled: newEnabled,
          share_token: newToken,
        })
        .eq('id', tripId);

      if (error) throw error;

      setShareEnabled(newEnabled);
      setShareToken(newToken);
      toast({
        title: newEnabled ? 'Sharing enabled' : 'Sharing disabled',
        description: newEnabled 
          ? 'Clients can now view this trip via the share link'
          : 'The share link is no longer active',
      });
    } catch (err) {
      console.error('Error updating share settings:', err);
      toast({ title: 'Failed to update sharing', variant: 'destructive' });
    }
  };

  const regenerateToken = async () => {
    try {
      const newToken = generateToken();
      const { error } = await supabase
        .from('agency_trips')
        .update({ share_token: newToken })
        .eq('id', tripId);

      if (error) throw error;
      setShareToken(newToken);
      toast({ title: 'New share link generated' });
    } catch (err) {
      console.error('Error regenerating token:', err);
      toast({ title: 'Failed to regenerate link', variant: 'destructive' });
    }
  };

  const shareUrl = shareToken 
    ? `${getAppUrl()}/share/${shareToken}`
    : '';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      toast({ title: 'Link copied to clipboard' });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Share Trip
          </DialogTitle>
          <DialogDescription>
            Create a client-friendly link to share "{tripName}" with your travelers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="share-toggle" className="text-base font-medium">
                Enable sharing
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow clients to view the itinerary via link
              </p>
            </div>
            <Switch
              id="share-toggle"
              checked={shareEnabled}
              onCheckedChange={toggleSharing}
              disabled={isLoading}
            />
          </div>

          {/* Share Link */}
          {shareEnabled && shareToken && (
            <div className="space-y-3">
              <Label>Share link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  title="Copy link"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(shareUrl, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={regenerateToken}
                  className="gap-2 text-muted-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate link
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                This link shows confirmed bookings, itinerary, and client-facing notes. 
                Internal notes are hidden.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
