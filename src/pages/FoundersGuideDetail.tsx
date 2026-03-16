import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Heart, Share2, Check, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import DOMPurify from 'dompurify';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getFoundersGuideBySlug } from '@/data/founders-guides';
import { toast } from 'sonner';
import { normalizeUnsplashUrl } from '@/utils/unsplash';
import { getAppUrl } from '@/utils/getAppUrl';

function formatInlineStyles(text: string): string {
  const html = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em'],
    ALLOWED_ATTR: ['class'],
  });
}

function parseContent(content: string) {
  const withoutMainTitle = content.replace(/^#\s+[^\n]+\n\n?/, '');
  const sections = withoutMainTitle.split(/\n(?=## )/);

  return sections.map((section, sectionIndex) => {
    const lines = section.trim().split('\n');
    const elements: JSX.Element[] = [];
    let currentList: string[] = [];
    let isInList = false;

    const flushList = (key: string) => {
      if (!isInList || currentList.length === 0) return;
      elements.push(
        <ul key={key} className="space-y-3 my-6">
          {currentList.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0" />
              <span className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineStyles(item) }} />
            </li>
          ))}
        </ul>
      );
      currentList = [];
      isInList = false;
    };

    lines.forEach((line, lineIndex) => {
      if (line.startsWith('## ')) {
        flushList(`list-${sectionIndex}-${lineIndex}`);
        elements.push(
          <h2 key={`h2-${sectionIndex}-${lineIndex}`} className="text-2xl font-display font-bold text-foreground mt-12 mb-6 pb-2 border-b border-border">
            {line.replace('## ', '')}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        flushList(`list-${sectionIndex}-${lineIndex}`);
        elements.push(
          <h3 key={`h3-${sectionIndex}-${lineIndex}`} className="text-lg font-semibold text-foreground mt-8 mb-4">
            {line.replace('### ', '')}
          </h3>
        );
      } else if (line.startsWith('- ')) {
        isInList = true;
        currentList.push(line.replace('- ', ''));
      } else if (line.trim()) {
        flushList(`list-${sectionIndex}-${lineIndex}`);
        elements.push(
          <p key={`p-${sectionIndex}-${lineIndex}`} className="text-muted-foreground leading-relaxed my-4 text-lg" dangerouslySetInnerHTML={{ __html: formatInlineStyles(line) }} />
        );
      }
    });

    flushList(`list-end-${sectionIndex}`);
    return <div key={sectionIndex}>{elements}</div>;
  });
}

export default function FoundersGuideDetail() {
  const { slug } = useParams<{ slug: string }>();
  const guide = getFoundersGuideBySlug(slug || '');
  const [copied, setCopied] = useState(false);

  if (!guide) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-bold mb-4">Guide not found</h1>
          <Button asChild><Link to="/guides?tab=founders">Back to Guides</Link></Button>
        </div>
      </MainLayout>
    );
  }

  const shareUrl = `${getAppUrl()}/founders-guides/${guide.slug}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy link'); }
  };

  return (
    <MainLayout>
      <Head
        title={`${guide.title} | Voyance`}
        description={guide.summary}
      />

      {/* Hero */}
      <section className="relative">
        <div className="aspect-[21/9] md:aspect-[3/1] w-full overflow-hidden">
          <img
            src={normalizeUnsplashUrl(guide.coverImage, 1600)}
            alt={guide.destination}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-3xl mx-auto">
            <Link to="/guides?tab=founders" className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/80 hover:text-primary-foreground mb-4">
              <ArrowLeft className="h-4 w-4" />
              Founder's Guides
            </Link>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl md:text-5xl font-display font-bold text-white mb-3"
            >
              {guide.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-white/80 italic"
            >
              {guide.subtitle}
            </motion.p>
          </div>
        </div>
      </section>

      {/* Author bar & content */}
      <section className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Author info */}
        <div className="flex items-center justify-between mb-10 pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">By {guide.authorName}</p>
              <p className="text-xs text-muted-foreground">{guide.authorTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {guide.destination}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {guide.readTime}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-8">
          {guide.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>

        {/* Content */}
        <article className="guide-content">
          {parseContent(guide.content)}
        </article>

        {/* Footer CTA */}
        <div className="mt-16 p-8 rounded-2xl bg-muted/50 border border-border text-center">
          <Heart className="h-6 w-6 text-primary mx-auto mb-3" />
          <h3 className="font-display font-bold text-lg text-foreground mb-2">
            Every recommendation is personally tested
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            That's the Voyance promise — we don't recommend what we haven't tried.
          </p>
          <Button asChild variant="outline">
            <Link to="/guides?tab=founders">More Founder's Guides</Link>
          </Button>
        </div>
      </section>
    </MainLayout>
  );
}
