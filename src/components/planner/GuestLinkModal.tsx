import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Users, Search, Check, X, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface GuestLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxGuests?: number;
  currentTravelers: number;
}

interface LinkedGuest {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferencesMatch?: number;
}

export default function GuestLinkModal({
  open,
  onOpenChange,
  maxGuests = 4,
  currentTravelers,
}: GuestLinkModalProps) {
  const [activeTab, setActiveTab] = useState<'invite' | 'search'>('invite');
  const [email, setEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedGuests, setLinkedGuests] = useState<LinkedGuest[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  const remainingSlots = maxGuests - currentTravelers + 1 - linkedGuests.length;

  const handleInviteByEmail = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxGuests} travelers allowed`);
      return;
    }

    setIsInviting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const newGuest: LinkedGuest = {
      id: `guest-${Date.now()}`,
      name: email.split('@')[0],
      email,
      preferencesMatch: Math.floor(Math.random() * 30) + 70, // 70-100% match
    };
    
    setLinkedGuests(prev => [...prev, newGuest]);
    setEmail('');
    setIsInviting(false);
    toast.success(`Invitation sent to ${email}`);
  };

  const handleRemoveGuest = (guestId: string) => {
    setLinkedGuests(prev => prev.filter(g => g.id !== guestId));
    toast.info('Guest removed');
  };

  const handleConfirm = () => {
    if (linkedGuests.length > 0) {
      toast.success(`${linkedGuests.length} guest${linkedGuests.length > 1 ? 's' : ''} linked to your trip!`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Link Travel Companions
          </DialogTitle>
          <DialogDescription>
            Invite friends to join your trip. We'll match travel preferences for optimal group planning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Linked Guests List */}
          {linkedGuests.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Linked guests</p>
              <div className="space-y-2">
                {linkedGuests.map((guest) => (
                  <motion.div
                    key={guest.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{guest.name}</p>
                        <p className="text-xs text-muted-foreground">{guest.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {guest.preferencesMatch && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Sparkles className="h-3 w-3" />
                          {guest.preferencesMatch}% match
                        </Badge>
                      )}
                      <button
                        onClick={() => handleRemoveGuest(guest.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {remainingSlots > 0 ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'invite' | 'search')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invite" className="gap-1.5">
                  <Mail className="h-4 w-4" />
                  Invite by Email
                </TabsTrigger>
                <TabsTrigger value="search" className="gap-1.5">
                  <Search className="h-4 w-4" />
                  Search Voyance
                </TabsTrigger>
              </TabsList>

              <TabsContent value="invite" className="space-y-3 pt-3">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="friend@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInviteByEmail()}
                    className="flex-1"
                  />
                  <Button onClick={handleInviteByEmail} disabled={isInviting || !email}>
                    {isInviting ? 'Sending...' : 'Invite'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  They'll receive an email to join your trip. If they have a Voyance account, their preferences will be matched.
                </p>
              </TabsContent>

              <TabsContent value="search" className="space-y-3 pt-3">
                <Input
                  placeholder="Search by name or Voyance handle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="h-32 flex items-center justify-center border border-dashed border-border rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Search for Voyance users</p>
                    <p className="text-xs">Connect with friends who have accounts</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                Maximum travelers reached ({maxGuests})
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {remainingSlots > 0 ? `${remainingSlots} spot${remainingSlots > 1 ? 's' : ''} remaining` : 'No spots remaining'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>
                {linkedGuests.length > 0 ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5" />
                    Confirm ({linkedGuests.length})
                  </>
                ) : (
                  'Done'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
