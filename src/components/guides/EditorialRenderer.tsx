/**
 * EditorialRenderer — pure presentational component
 * Renders EditorialContent JSON as a magazine-style article.
 * Reusable in both the published view and the preview modal.
 */
import { useMemo } from 'react';
import { Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SafeImage from '@/components/SafeImage';
import { cn } from '@/lib/utils';
import type { EditorialContent, EditorialSection, QuickRefItem } from '@/types/editorial';

interface EditorialRendererProps {
  editorial: EditorialContent;
  authorName: string;
  dnaType?: string | null;
  authorAvatarUrl?: string | null;
  authorUserId: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  durationDays?: number | null;
  coverImageUrl?: string | null;
  /** Map of activity name (lowercased) → photo URLs */
  guidePhotos?: Map<string, string[]>;
}

/* ─── Category emoji map ─── */
const CATEGORY_EMOJI: Record<string, string> = {
  dining: '🍽',
  food: '🍽',
  food_drink: '🍽',
  'food & drink': '🍽',
  restaurant: '🍽',
  activities: '🎯',
  activity: '🎯',
  must_do: '🎯',
  sights: '👁',
  sight: '👁',
  must_see: '👁',
  culture_sights: '👁',
  'culture & sights': '👁',
  nightlife: '🌙',
  the_vibe: '🌙',
  entertainment: '🎭',
};

function getCategoryEmoji(cat: string): string {
  const lower = cat.toLowerCase().trim();
  return CATEGORY_EMOJI[lower] || '📍';
}

function getCategoryLabel(cat: string): string {
  const lower = cat.toLowerCase().trim();
  const labels: Record<string, string> = {
    food_drink: 'DINING',
    'food & drink': 'DINING',
    food: 'DINING',
    dining: 'DINING',
    restaurant: 'DINING',
    culture_sights: 'SIGHTS',
    'culture & sights': 'SIGHTS',
    sights: 'SIGHTS',
    sight: 'SIGHTS',
    must_see: 'SIGHTS',
    must_do: 'ACTIVITIES',
    activities: 'ACTIVITIES',
    activity: 'ACTIVITIES',
    nightlife: 'NIGHTLIFE',
    the_vibe: 'NIGHTLIFE',
    entertainment: 'ENTERTAINMENT',
  };
  return labels[lower] || cat.toUpperCase();
}

/* ─── Inline star renderer ─── */
function InlineStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-px align-middle ml-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'h-3 w-3',
            s <= rating ? 'text-gold fill-current' : 'text-muted-foreground/20'
          )}
        />
      ))}
    </span>
  );
}

/* ─── Section divider ─── */
function SectionDivider({ heading }: { heading: string }) {
  return (
    <div className="flex items-center gap-4 mt-16 mb-8">
      <div className="flex-1 border-t border-border" />
      <h2 className="font-serif text-sm uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
        {heading}
      </h2>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

/* ─── Pull quote ─── */
function PullQuote({ text }: { text: string }) {
  const wrapped = text.startsWith('"') ? text : `"${text}"`;
  return (
    <blockquote className="border-l-4 border-primary pl-6 py-2 my-8">
      <p className="italic text-lg md:text-xl text-muted-foreground leading-relaxed">
        {wrapped}
      </p>
    </blockquote>
  );
}

/* ─── Section photos ─── */
function SectionPhotos({ activityRefs, guidePhotos }: { activityRefs: string[]; guidePhotos?: Map<string, string[]> }) {
  if (!guidePhotos) return null;

  const photos: string[] = [];
  for (const ref of activityRefs) {
    const found = guidePhotos.get(ref.toLowerCase());
    if (found) photos.push(...found);
    if (photos.length >= 4) break;
  }
  const display = photos.slice(0, 4);
  if (display.length === 0) return null;

  return (
    <div className={cn('my-6 gap-3', display.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-1 sm:grid-cols-2')}>
      {display.map((url, i) => (
        <div key={i} className="rounded-lg overflow-hidden bg-muted">
          <SafeImage
            src={url}
            alt=""
            className="w-full h-auto object-cover rounded-lg"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Quick Reference group ─── */
function QuickReferenceGroup({ category, items }: { category: string; items: QuickRefItem[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
        <span>{getCategoryEmoji(category)}</span>
        {getCategoryLabel(category)}
      </p>
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            'flex items-start gap-2 py-2',
            i < items.length - 1 && 'border-b border-border/50'
          )}
        >
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground">{item.name}</span>
            <InlineStars rating={item.rating} />
            <p className="text-sm text-muted-foreground mt-0.5">{item.oneLiner}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Renderer ─── */
export default function EditorialRenderer({
  editorial,
  authorName,
  dnaType,
  authorAvatarUrl,
  authorUserId,
  tripStartDate,
  tripEndDate,
  durationDays,
  coverImageUrl,
  guidePhotos,
}: EditorialRendererProps) {
  // Group quick reference by category
  const quickRefGroups = useMemo(() => {
    const groups = new Map<string, QuickRefItem[]>();
    for (const item of editorial.quickReference || []) {
      const cat = item.category.toLowerCase();
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    return groups;
  }, [editorial.quickReference]);

  const dateStr = useMemo(() => {
    if (!tripStartDate) return null;
    const start = new Date(tripStartDate);
    const end = tripEndDate ? new Date(tripEndDate) : null;
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (end) return `${fmt(start)} – ${fmt(end)}`;
    return fmt(start);
  }, [tripStartDate, tripEndDate]);

  return (
    <article>
      {/* Hero Image */}
      {coverImageUrl && (
        <div className="relative w-full max-h-[280px] md:max-h-[400px] overflow-hidden">
          <SafeImage
            src={coverImageUrl}
            alt=""
            className="w-full h-full object-cover max-h-[280px] md:max-h-[400px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        </div>
      )}

      {/* Title Block */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 md:pt-12">
        <h1 className="font-serif text-2xl md:text-4xl font-bold text-foreground text-center leading-tight">
          {editorial.title}
        </h1>

        {/* Byline */}
        <p className="text-center text-primary mt-3 text-base">
          by {authorName}
          {dnaType && <span> · {dnaType}</span>}
        </p>

        {/* Date / Duration */}
        {(dateStr || durationDays) && (
          <p className="text-center text-sm text-muted-foreground mt-1">
            {dateStr}
            {durationDays ? ` · ${durationDays} day${durationDays !== 1 ? 's' : ''}` : ''}
          </p>
        )}

        {/* Lede */}
        <p className="mt-6 mb-10 text-lg italic text-muted-foreground leading-relaxed text-center md:text-left">
          {editorial.lede}
        </p>
      </div>

      {/* Themed Sections */}
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        {editorial.sections.map((section, idx) => (
          <EditorialSectionBlock
            key={idx}
            section={section}
            guidePhotos={guidePhotos}
          />
        ))}

        {/* Sign-off divider */}
        <div className="flex items-center gap-4 mt-16 mb-8">
          <div className="flex-1 border-t border-border" />
          <span className="text-muted-foreground text-lg">✦</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Sign-off text */}
        <p className="text-lg italic text-muted-foreground leading-relaxed mb-8">
          {editorial.signOff}
        </p>

        {/* Author Card */}
        <div className="bg-secondary rounded-xl p-6 mt-8 flex items-center gap-4">
          {authorAvatarUrl ? (
            <img
              src={authorAvatarUrl}
              alt=""
              className="w-14 h-14 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-xl">
              {(authorName || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground">{authorName}</p>
            {dnaType && (
              <p className="text-sm text-primary">{dnaType}</p>
            )}
            <Link
              to={`/profile/${authorUserId}`}
              className="text-sm text-primary hover:text-accent underline inline-flex items-center gap-1 mt-1"
            >
              View Voyance Profile
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Quick Reference */}
        {quickRefGroups.size > 0 && (
          <>
            <SectionDivider heading="QUICK REFERENCE" />
            <div className="bg-secondary rounded-xl p-6 space-y-6">
              {[...quickRefGroups.entries()].map(([cat, items]) => (
                <QuickReferenceGroup key={cat} category={cat} items={items} />
              ))}
            </div>
          </>
        )}

        {/* Bottom spacing */}
        <div className="h-12" />
      </div>
    </article>
  );
}

/* ─── Single themed section ─── */
function EditorialSectionBlock({
  section,
  guidePhotos,
}: {
  section: EditorialSection;
  guidePhotos?: Map<string, string[]>;
}) {
  const paragraphs = section.narrative.split('\n\n').filter(Boolean);

  return (
    <section>
      <SectionDivider heading={section.heading} />

      {/* Intro */}
      <p className="italic text-muted-foreground mb-6 leading-relaxed">
        {section.intro}
      </p>

      {/* Narrative paragraphs */}
      {paragraphs.map((para, i) => (
        <p key={i} className="text-base md:text-lg leading-relaxed text-foreground mb-6">
          {para}
        </p>
      ))}

      {/* Inline ratings */}
      {section.ratings && section.ratings.length > 0 && (
        <div className="flex flex-wrap gap-3 my-4">
          {section.ratings.map((r, i) => (
            <span key={i} className="text-sm text-muted-foreground">
              {r.name} <InlineStars rating={r.rating} />
            </span>
          ))}
        </div>
      )}

      {/* Pull Quote */}
      {section.pullQuote && <PullQuote text={section.pullQuote} />}

      {/* Photos */}
      <SectionPhotos activityRefs={section.activityRefs} guidePhotos={guidePhotos} />
    </section>
  );
}
