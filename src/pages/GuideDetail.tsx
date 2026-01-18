import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar, User, Tag, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { guides, getGuideBySlug, getRelatedGuides } from '@/data/guides';

export default function GuideDetail() {
  const { slug } = useParams<{ slug: string }>();
  
  // Find guide by slug or id (for backwards compatibility)
  const guide = slug ? (getGuideBySlug(slug) || guides.find(g => g.slug === slug || String(guides.indexOf(g) + 1) === slug)) : undefined;
  
  if (!guide) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-2xl mb-4">Guide not found</h1>
            <Link to="/explore#guides">
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

  // Parse markdown content into sections
  const sections = guide.content.split('\n## ').map((section, index) => {
    if (index === 0) {
      // First section starts with # title
      const lines = section.split('\n');
      const title = lines[0].replace('# ', '');
      const content = lines.slice(1).join('\n').trim();
      return { title, content, isMain: true };
    }
    const lines = section.split('\n');
    const title = lines[0];
    const content = lines.slice(1).join('\n').trim();
    return { title, content, isMain: false };
  });

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
                to="/explore#guides"
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
      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-muted/50 rounded-xl p-6 mb-10"
        >
          <p className="text-lg text-muted-foreground leading-relaxed">
            {guide.summary}
          </p>
        </motion.div>
        
        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="prose prose-lg max-w-none dark:prose-invert guide-content"
        >
          {sections.map((section, index) => (
            <div key={index} className={section.isMain ? '' : 'mt-10'}>
              {!section.isMain && (
                <h2 className="text-2xl font-display font-bold text-foreground mb-4">
                  {section.title}
                </h2>
              )}
              <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.content.split('\n### ').map((subsection, subIndex) => {
                  if (subIndex === 0) {
                    return <p key={subIndex}>{subsection}</p>;
                  }
                  const lines = subsection.split('\n');
                  const subTitle = lines[0];
                  const subContent = lines.slice(1).join('\n').trim();
                  return (
                    <div key={subIndex} className="mt-6">
                      <h3 className="text-xl font-semibold text-foreground mb-3">{subTitle}</h3>
                      <p>{subContent}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </motion.div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t">
          {guide.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {tag}
            </Badge>
          ))}
        </div>
        
        {/* Share */}
        <div className="flex items-center gap-4 mt-6">
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share Guide
          </Button>
        </div>
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
