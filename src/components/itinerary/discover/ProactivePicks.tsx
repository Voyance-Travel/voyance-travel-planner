/**
 * ProactivePicks — AI-curated suggestions grouped into "For You", "Near Schedule", "Hidden Gems"
 */
import { Star, Plus, Sparkles, MapPin, Clock, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ProactiveSuggestion {
  id: string;
  name: string;
  description: string;
  whyForYou: string;
  category: string;
  priceLevel: number;
  bestTime?: string;
  scheduleFit?: string;
  rating?: number;
  distance?: string;
  walkTime?: string;
  address?: string;
}

interface ProactivePicksProps {
  forYou: ProactiveSuggestion[];
  nearSchedule: ProactiveSuggestion[];
  hiddenGems: ProactiveSuggestion[];
  archetype: string;
  addedIds: Set<string>;
  onAdd: (suggestion: ProactiveSuggestion) => void;
}

function renderPriceLevel(level: number) {
  return Array(level).fill('$').join('');
}

function SuggestionCard({
  suggestion,
  isAdded,
  onAdd,
}: {
  suggestion: ProactiveSuggestion;
  isAdded: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-2 hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-foreground text-sm">{suggestion.name}</h4>
            {suggestion.rating && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600">
                <Star className="h-3 w-3 fill-current" />
                {suggestion.rating}
              </span>
            )}
            {suggestion.priceLevel > 0 && (
              <span className="text-xs text-muted-foreground">
                {renderPriceLevel(suggestion.priceLevel)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{suggestion.description}</p>
        </div>
        <Button
          size="sm"
          variant={isAdded ? 'secondary' : 'outline'}
          onClick={() => !isAdded && onAdd()}
          disabled={isAdded}
          className={cn(
            'shrink-0 gap-1 h-8',
            !isAdded && 'hover:bg-primary hover:text-primary-foreground hover:border-primary'
          )}
        >
          {isAdded ? <>✓ Added</> : <><Plus className="h-3.5 w-3.5" /> Add</>}
        </Button>
      </div>

      {(suggestion.distance || suggestion.walkTime || suggestion.scheduleFit) && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {suggestion.walkTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {suggestion.walkTime}
            </span>
          )}
          {suggestion.distance && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {suggestion.distance}
            </span>
          )}
          {suggestion.scheduleFit && (
            <span className="flex items-center gap-1">
              {suggestion.scheduleFit}
            </span>
          )}
        </div>
      )}

      {suggestion.whyForYou && (
        <p className="text-xs text-primary/80 italic bg-primary/5 rounded-lg px-2.5 py-1.5">
          ✨ {suggestion.whyForYou}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function ProactivePicks({ forYou, nearSchedule, hiddenGems, archetype, addedIds, onAdd }: ProactivePicksProps) {
  const archetypeLabel = archetype?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'You';

  return (
    <div className="space-y-5">
      {forYou.length > 0 && (
        <div>
          <SectionHeader
            icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
            title={`Based on your Travel DNA`}
            subtitle={`Curated for the ${archetypeLabel} in you`}
          />
          <div className="space-y-2">
            {forYou.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} isAdded={addedIds.has(s.id)} onAdd={() => onAdd(s)} />
            ))}
          </div>
        </div>
      )}

      {nearSchedule.length > 0 && (
        <div>
          <SectionHeader
            icon={<MapPin className="h-3.5 w-3.5 text-primary" />}
            title="Fits your schedule"
            subtitle="Complements what you already have planned"
          />
          <div className="space-y-2">
            {nearSchedule.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} isAdded={addedIds.has(s.id)} onAdd={() => onAdd(s)} />
            ))}
          </div>
        </div>
      )}

      {hiddenGems.length > 0 && (
        <div>
          <SectionHeader
            icon={<Gem className="h-3.5 w-3.5 text-primary" />}
            title="Hidden gems"
            subtitle="Local favorites most tourists miss"
          />
          <div className="space-y-2">
            {hiddenGems.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} isAdded={addedIds.has(s.id)} onAdd={() => onAdd(s)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
