/**
 * ArchetypeDetailSheet - Slide-out sheet showing full archetype details
 */
import { motion } from 'framer-motion';
import { X, MapPin, Heart, ShieldX, Lightbulb, Sparkles, Share2, Send } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { type ArchetypeDetail } from '@/data/archetypeDetailContent';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { toast } from 'sonner';
import { getAppUrl } from '@/utils/getAppUrl';
import { archetypeIdToSlug } from '@/utils/archetypeSlug';

interface ArchetypeDetailSheetProps {
  archetype: ArchetypeDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ArchetypeDetailSheet({ archetype, open, onOpenChange }: ArchetypeDetailSheetProps) {
  const navigate = useNavigate();

  if (!archetype) return null;

  const handleShare = async () => {
    const shareText = `I might be a ${archetype.name}! "${archetype.tagline}" - Discover your Travel DNA on Voyance`;
    const slugSource = (archetype as any).narrativeId || archetype.id;
    const shareUrl = `${getAppUrl()}/archetypes/${archetypeIdToSlug(slugSource)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Travel DNA: ${archetype.name}`, text: shareText, url: shareUrl });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Copied to clipboard!');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg md:max-w-xl p-0 border-l border-border">
        <ScrollArea className="h-full">
          <div className="px-6 pt-6 pb-10">
            {/* Header */}
            <SheetHeader className="mb-6 text-left">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{archetype.icon}</span>
                <div>
                  <SheetTitle className="text-2xl font-serif font-bold text-foreground">
                    {archetype.name}
                  </SheetTitle>
                  <Badge variant="outline" className="text-xs mt-1" style={{ borderColor: archetype.color, color: archetype.color }}>
                    {archetype.category}
                  </Badge>
                </div>
              </div>
              <p className="text-lg italic text-primary font-medium">"{archetype.tagline}"</p>
              <p className="text-muted-foreground leading-relaxed">{archetype.oneLiner}</p>
            </SheetHeader>

            {/* Full Description */}
            <section className="mb-8">
              <p className="text-sm text-foreground/80 leading-relaxed">{archetype.fullDescription}</p>
            </section>

            {/* Core Traits */}
            <section className="mb-8">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">Core Traits</h3>
              <div className="flex flex-wrap gap-2">
                {archetype.coreTraits.map(trait => (
                  <Badge key={trait} variant="secondary" className="text-xs">
                    {trait}
                  </Badge>
                ))}
              </div>
            </section>

            <Separator className="mb-8" />

            {/* What Drives You */}
            <section className="mb-8">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                <Sparkles className="w-4 h-4 inline mr-1.5 text-primary" />
                What Drives You
              </h3>
              <div className="space-y-3">
                {archetype.drivers.map(driver => (
                  <div key={driver.name} className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm font-medium text-foreground mb-0.5">{driver.name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{driver.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <Separator className="mb-8" />

            {/* Travel Style Preferences */}
            <section className="mb-8">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Travel Style</h3>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                {archetype.travelPreferences.map((pref, i) => (
                  <div key={pref.aspect} className={`flex justify-between items-center px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-border' : ''}`}>
                    <span className="text-muted-foreground">{pref.aspect}</span>
                    <span className="text-foreground font-medium text-right">{pref.preference}</span>
                  </div>
                ))}
              </div>
            </section>

            <Separator className="mb-8" />

            {/* You Love / You Avoid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <section>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-emerald-500" />
                  You Love
                </h3>
                <ul className="space-y-1.5">
                  {archetype.youLove.map(item => (
                    <li key={item} className="text-xs text-foreground/70 flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <ShieldX className="w-3.5 h-3.5 text-red-400" />
                  You Avoid
                </h3>
                <ul className="space-y-1.5">
                  {archetype.youAvoid.map(item => (
                    <li key={item} className="text-xs text-foreground/70 flex items-start gap-1.5">
                      <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <Separator className="mb-8" />

            {/* Ideal Destinations */}
            <section className="mb-8">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Ideal Destinations
              </h3>
              <div className="flex flex-wrap gap-2">
                {archetype.idealDestinations.map(dest => (
                  <Badge key={dest} variant="outline" className="text-xs">
                    {dest}
                  </Badge>
                ))}
              </div>
            </section>

            <Separator className="mb-8" />

            {/* Profile Scores */}
            <section className="mb-8">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Travel Profile</h3>
              <div className="space-y-3">
                {archetype.profileScores.map(score => (
                  <div key={score.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{score.label}</span>
                      <span className="font-medium text-foreground">{score.value}%</span>
                    </div>
                    <Progress value={score.value} className="h-1.5" />
                  </div>
                ))}
              </div>
            </section>

            {/* Planning Advice / Key Needs / Strategies / Considerations */}
            {(archetype.planningAdvice || archetype.keyNeeds || archetype.keyStrategies || archetype.keyConsiderations) && (
              <>
                <Separator className="mb-8" />
                <section>
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    {archetype.planningAdvice ? 'Planning Advice' : archetype.keyNeeds ? 'Key Needs' : archetype.keyStrategies ? 'Key Strategies' : 'Key Considerations'}
                  </h3>
                  <ul className="space-y-2">
                    {(archetype.planningAdvice || archetype.keyNeeds || archetype.keyStrategies || archetype.keyConsiderations)?.map(item => (
                      <li key={item} className="text-xs text-foreground/70 flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {/* Share & CTA Section */}
            <Separator className="mb-8" />
            <section className="space-y-4">
              {/* Is this you? */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 text-center space-y-3">
                <p className="text-lg font-serif font-semibold text-foreground">Is this you?</p>
                <p className="text-sm text-muted-foreground">
                  Take the Travel DNA quiz to find out which of our 29 archetypes matches your travel style.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(ROUTES.QUIZ);
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Take the Quiz
                </Button>
              </div>

              {/* Share */}
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4" />
                  Share this archetype
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={async () => {
                    const inviteText = `Think you might be a ${archetype.name}? Take the Travel DNA quiz and find out!`;
                    const inviteUrl = `${getAppUrl()}${ROUTES.QUIZ}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: 'Take the Travel DNA Quiz', text: inviteText, url: inviteUrl });
                      } catch { /* cancelled */ }
                    } else {
                      await navigator.clipboard.writeText(`${inviteText}\n${inviteUrl}`);
                      toast.success('Quiz invite copied!');
                    }
                  }}
                >
                  <Send className="h-4 w-4" />
                  Invite a friend
                </Button>
              </div>
            </section>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
