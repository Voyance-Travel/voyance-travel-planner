/**
 * ArchetypeDetailSheet - Slide-out sheet showing full archetype details
 */
import { motion } from 'framer-motion';
import { X, MapPin, Heart, ShieldX, Lightbulb, Sparkles } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { type ArchetypeDetail } from '@/data/archetypeDetailContent';

interface ArchetypeDetailSheetProps {
  archetype: ArchetypeDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ArchetypeDetailSheet({ archetype, open, onOpenChange }: ArchetypeDetailSheetProps) {
  if (!archetype) return null;

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

            {/* Primary/Secondary badge */}
            <div className="mt-8 pt-4 border-t border-border text-center">
              <Badge variant={archetype.isPrimary ? 'default' : 'secondary'} className="text-xs">
                {archetype.isPrimary ? `Primary Archetype #${archetype.number}` : `Secondary Archetype #${archetype.number}`}
              </Badge>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
