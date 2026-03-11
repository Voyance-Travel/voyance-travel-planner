/**
 * EditorialStatusCard — threshold gate + generate button for the editorial engine.
 */
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ActivitySectionData } from '@/components/guides/EditableActivityCard';
import type { EditorialContent } from '@/types/editorial';

interface EditorialStatusCardProps {
  sections: ActivitySectionData[];
  guideId: string | undefined;
  editorialVersion?: number;
  editorialGeneratedAt?: string | null;
  onEditorialGenerated: (editorial: EditorialContent, version: number) => void;
}

const MIN_THRESHOLD = 3;
const MIN_EXPERIENCE_LENGTH = 50;

export default function EditorialStatusCard({
  sections,
  guideId,
  editorialVersion = 0,
  editorialGeneratedAt,
  onEditorialGenerated,
}: EditorialStatusCardProps) {
  const [generating, setGenerating] = useState(false);

  const qualifyingCount = useMemo(() => {
    return sections.filter(
      (s) =>
        s.sectionType !== 'day_overview' &&
        (s.userExperience || '').length >= MIN_EXPERIENCE_LENGTH
    ).length;
  }, [sections]);

  const isUnlocked = qualifyingCount >= MIN_THRESHOLD;
  const hasExisting = editorialVersion > 0;
  const progressPct = Math.min(100, (qualifyingCount / MIN_THRESHOLD) * 100);

  const relativeTime = useMemo(() => {
    if (!editorialGeneratedAt) return null;
    const diff = Date.now() - new Date(editorialGeneratedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }, [editorialGeneratedAt]);

  const handleGenerate = async () => {
    if (!guideId) {
      toast.error('Save your guide as a draft first, then generate the editorial.');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-guide-editorial', {
        body: { guideId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onEditorialGenerated(data.editorial as EditorialContent, data.version);
    } catch (err: any) {
      const msg = err?.message || 'Something went wrong generating your editorial. Please try again.';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl p-6 space-y-4 transition-colors',
        isUnlocked
          ? 'border border-border bg-card'
          : 'border border-dashed border-border bg-secondary/50'
      )}
    >
      {/* Heading */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-serif text-lg font-semibold text-foreground">
          Editorial Guide
        </h3>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {isUnlocked
          ? 'Your notes are ready to be transformed into a polished travel editorial.'
          : `Share your experience on at least ${MIN_THRESHOLD} activities to unlock your editorial — a polished travel article generated from your notes.`}
      </p>

      {/* Progress */}
      <div className="space-y-1.5">
        <Progress value={progressPct} className="h-2" />
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {qualifyingCount} of {MIN_THRESHOLD} activities reviewed
          {isUnlocked && <span className="text-primary font-medium">✓</span>}
        </p>
      </div>

      {/* Existing version info */}
      {hasExisting && relativeTime && (
        <p className="text-xs text-muted-foreground">
          Editorial v{editorialVersion} — generated {relativeTime}
        </p>
      )}

      {/* Generate / Regenerate button */}
      <Button
        className="gap-2 w-full sm:w-auto"
        disabled={!isUnlocked || generating || !guideId}
        onClick={handleGenerate}
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating your editorial…
          </>
        ) : hasExisting ? (
          <>
            <RefreshCw className="h-4 w-4" />
            Regenerate Editorial
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Editorial
          </>
        )}
      </Button>

      {/* Shimmer overlay during generation */}
      {generating && (
        <div className="h-1 w-full rounded-full overflow-hidden bg-muted">
          <div className="h-full w-1/3 bg-primary/60 rounded-full animate-pulse" 
               style={{ animation: 'shimmer 1.5s ease-in-out infinite' }} />
        </div>
      )}
    </div>
  );
}
