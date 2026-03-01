import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar, User, Tag, Share2, Check, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import DOMPurify from 'dompurify';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { guides, getGuideBySlug, getRelatedGuides } from '@/data/guides';
import { toast } from 'sonner';
import ShareGuideSheet from '@/components/sharing/ShareGuideSheet';
import { normalizeUnsplashUrl } from '@/utils/unsplash';
import { getAppUrl } from '@/utils/getAppUrl';
// Parse markdown-style content into structured JSX
function parseContent(content: string) {
  // Remove the main title (# Title) as it's displayed in the hero
  const withoutMainTitle = content.replace(/^#\s+[^\n]+\n\n?/, '');
  
  // Split into sections by ## headers
  const sections = withoutMainTitle.split(/\n(?=## )/);
  
  return sections.map((section, sectionIndex) => {
    const lines = section.trim().split('\n');
    const elements: JSX.Element[] = [];
    let currentList: string[] = [];
    let isInList = false;
    
    lines.forEach((line, lineIndex) => {
      // Section header (##)
      if (line.startsWith('## ')) {
        if (isInList && currentList.length > 0) {
          elements.push(
            <ul key={`list-${sectionIndex}-${lineIndex}`} className="space-y-3 my-6">
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
        }
        elements.push(
          <h2 key={`h2-${sectionIndex}-${lineIndex}`} className="text-2xl font-display font-bold text-foreground mt-12 mb-6 pb-2 border-b border-border">
            {line.replace('## ', '')}
          </h2>
        );
      }
      // Subsection header (###)
      else if (line.startsWith('### ')) {
        if (isInList && currentList.length > 0) {
          elements.push(
            <ul key={`list-${sectionIndex}-${lineIndex}`} className="space-y-3 my-6">
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
        }
        elements.push(
          <h3 key={`h3-${sectionIndex}-${lineIndex}`} className="text-lg font-semibold text-foreground mt-8 mb-4">
            {line.replace('### ', '')}
          </h3>
        );
      }
      // List item
      else if (line.startsWith('- ')) {
        isInList = true;
        currentList.push(line.replace('- ', ''));
      }
      // Numbered list item
      else if (/^\d+\.\s/.test(line)) {
        if (isInList && currentList.length > 0 && !currentList[0].match(/^\d+\./)) {
          elements.push(
            <ul key={`list-${sectionIndex}-${lineIndex}`} className="space-y-3 my-6">
              {currentList.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                  <span className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineStyles(item) }} />
                </li>
              ))}
            </ul>
          );
          currentList = [];
        }
        isInList = true;
        currentList.push(line);
      }
      // Regular paragraph
      else if (line.trim()) {
        if (isInList && currentList.length > 0) {
          const isNumbered = currentList[0].match(/^\d+\./);
          if (isNumbered) {
            elements.push(
              <ol key={`list-${sectionIndex}-${lineIndex}`} className="space-y-3 my-6">
                {currentList.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineStyles(item.replace(/^\d+\.\s*/, '')) }} />
                  </li>
                ))}
              </ol>
            );
          } else {
            elements.push(
              <ul key={`list-${sectionIndex}-${lineIndex}`} className="space-y-3 my-6">
                {currentList.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                    <span className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineStyles(item) }} />
                  </li>
                ))}
              </ul>
            );
          }
          currentList = [];
          isInList = false;
        }
        elements.push(
          <p key={`p-${sectionIndex}-${lineIndex}`} className="text-muted-foreground leading-relaxed my-4" dangerouslySetInnerHTML={{ __html: formatInlineStyles(line) }} />
        );
      }
    });
    
    // Handle remaining list items
    if (isInList && currentList.length > 0) {
      const isNumbered = currentList[0].match(/^\d+\./);
      if (isNumbered) {
        elements.push(
          <ol key={`list-end-${sectionIndex}`} className="space-y-3 my-6">
            {currentList.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineStyles(item.replace(/^\d+\.\s*/, '')) }} />
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`list-end-${sectionIndex}`} className="space-y-3 my-6">
            {currentList.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                <span className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineStyles(item) }} />
              </li>
            ))}
          </ul>
        );
      }
    }
    
    return <div key={sectionIndex}>{elements}</div>;
  });
}

// Format inline styles like **bold** and *italic*
// SECURITY: Uses DOMPurify to sanitize HTML and prevent XSS attacks
function formatInlineStyles(text: string): string {
  const html = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Sanitize with strict allowlist - only permit formatting tags
  return DOMPurify.sanitize(html, { 
    ALLOWED_TAGS: ['strong', 'em'],
    ALLOWED_ATTR: ['class']
  });
}

export default function GuideDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [showShareSheet, setShowShareSheet] = useState(false);
  
  // Find guide by slug or id (for backwards compatibility)
  const guide = slug ? (getGuideBySlug(slug) || guides.find(g => g.slug === slug || String(guides.indexOf(g) + 1) === slug)) : undefined;
  
  const shareUrl = `${getAppUrl()}/guides/${slug}`;

  if (!guide) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-2xl mb-4">Guide not found</h1>
            <Link to="/guides">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Guides
              </Button>
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const relatedGuides = getRelatedGuides(guide).slice(0, 3);

  return (
    <MainLayout>
      <Head
        title={`${guide.title} | Voyance Guides`}
        description={guide.summary}
      />
      
      {/* Hero */}
      <section className="relative h-[50vh] min-h-[400px]">
        <div className="absolute inset-0">
          <img
            src={guide.coverImage.startsWith('/') 
              ? `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&q=80`
              : guide.coverImage
            }
            alt={guide.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </div>
        
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-4xl mx-auto px-4 pb-12 w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link 
                to="/guides"
                className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Guides
              </Link>
              
              <Badge className="mb-4 bg-primary/90">{guide.category}</Badge>
              
              <h1 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
                {guide.title}
              </h1>
              
              <p className="text-xl text-white/90 mb-6 max-w-2xl">
                {guide.subtitle}
              </p>
              
              <div className="flex flex-wrap items-center gap-6 text-white/70 text-sm">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {guide.author}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {guide.readTime}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(guide.datePublished).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Content */}
      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Summary - Editorial Style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-12"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-full" />
          <p className="text-xl text-foreground leading-relaxed pl-6 italic">
            {guide.summary}
          </p>
        </motion.div>
        
        {/* Main content - Editorial Styling */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="prose-editorial"
        >
          {parseContent(guide.content)}
        </motion.div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-border">
          {guide.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {tag}
            </Badge>
          ))}
        </div>
        
        {/* Share */}
        <div className="flex items-center gap-4 mt-6">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setShowShareSheet(true)}
          >
            <Share2 className="h-4 w-4" />
            Share Guide
          </Button>
        </div>

        {/* Share Guide Sheet */}
        <ShareGuideSheet
          open={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          shareLink={shareUrl}
          destination={guide.title}
        />
      </article>
      
      {/* Related Guides */}
      {relatedGuides.length > 0 && (
        <section className="bg-muted/30 py-16">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-display font-bold mb-8">Related Guides</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedGuides.map((related) => (
                <Link
                  key={related.slug}
                  to={`/guides/${related.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-[16/10] rounded-xl overflow-hidden mb-4">
                    <img
                      src={related.coverImage.startsWith('/') 
                        ? `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80`
                        : related.coverImage
                      }
                      alt={related.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-white/90 text-foreground">
                        {related.category}
                      </Badge>
                    </div>
                  </div>
                  <h3 className="font-semibold group-hover:text-primary transition-colors mb-2 line-clamp-2">
                    {related.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {related.summary}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </MainLayout>
  );
}
