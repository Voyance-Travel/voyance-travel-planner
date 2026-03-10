import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Star, Lightbulb, Quote, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Platform icons/labels
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X (Twitter)',
};

interface BlogBlock {
  type: string;
  text?: string;
  level?: number;
  activity?: string;
  description?: string;
  rating?: number;
  dayNumber?: number;
  date?: string;
  city?: string;
  platform?: string;
  url?: string;
  caption?: string;
  attribution?: string;
  category?: string;
  noteType?: string;
}

function BlockRenderer({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level || 2}` as keyof JSX.IntrinsicElements;
      const classes = block.level === 1
        ? 'text-3xl md:text-4xl font-bold text-foreground mt-8 mb-4'
        : block.level === 3
          ? 'text-xl font-semibold text-foreground mt-6 mb-2'
          : 'text-2xl md:text-3xl font-bold text-foreground mt-8 mb-3';
      return <Tag className={classes}>{block.text}</Tag>;
    }

    case 'paragraph':
      return <p className="text-base leading-relaxed text-foreground/85 mb-4">{block.text}</p>;

    case 'day_divider':
      return (
        <div className="flex items-center gap-3 my-8">
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>Day {block.dayNumber}</span>
            {block.date && <span>· {block.date}</span>}
            {block.city && <span>· {block.city}</span>}
          </div>
          <div className="h-px flex-1 bg-border" />
        </div>
      );

    case 'highlight':
      return (
        <div className="bg-accent/30 border border-accent/50 rounded-xl p-5 my-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className="font-semibold text-foreground">{block.activity}</h4>
            {block.rating && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: block.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-foreground/80">{block.description}</p>
        </div>
      );

    case 'tip':
      return (
        <div className="bg-muted/50 border-l-4 border-primary rounded-r-lg p-4 my-5">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              {block.category && (
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  {block.category} tip
                </span>
              )}
              <p className="text-sm text-foreground/85">{block.text}</p>
            </div>
          </div>
        </div>
      );

    case 'quote':
      return (
        <blockquote className="border-l-4 border-primary/40 pl-5 py-2 my-6 italic">
          <Quote className="h-5 w-5 text-primary/40 mb-2" />
          <p className="text-lg text-foreground/80">{block.text}</p>
          {block.attribution && (
            <cite className="text-sm text-muted-foreground mt-1 block not-italic">- {block.attribution}</cite>
          )}
        </blockquote>
      );

    case 'social_embed':
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-muted/40 border border-border rounded-lg p-4 my-4 hover:bg-muted/60 transition-colors"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ExternalLink className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary uppercase tracking-wider">
              {PLATFORM_LABELS[block.platform || ''] || block.platform}
            </p>
            {block.caption && <p className="text-sm text-foreground/80 truncate">{block.caption}</p>}
            <p className="text-xs text-muted-foreground truncate">{block.url}</p>
          </div>
        </a>
      );

    case 'note':
      return (
        <div className="bg-secondary/30 rounded-lg p-4 my-4 text-sm text-foreground/80 italic">
          {block.noteType && (
            <span className="text-xs font-medium text-secondary-foreground/60 uppercase tracking-wider block mb-1">
              {block.noteType}
            </span>
          )}
          {block.text}
        </div>
      );

    case 'photo':
      return (
        <figure className="my-6">
          <img src={block.url} alt={block.caption || ''} className="w-full rounded-xl object-cover max-h-[500px]" />
          {block.caption && <figcaption className="text-sm text-muted-foreground mt-2 text-center">{block.caption}</figcaption>}
        </figure>
      );

    default:
      return null;
  }
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [blog, setBlog] = useState<any>(null);
  const [author, setAuthor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    async function fetchBlog() {
      const { data, error } = await supabase
        .from('trip_blogs')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setBlog(data);

      // Increment view count (fire-and-forget)
      supabase
        .from('trip_blogs')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', data.id)
        .then(() => {});

      // Fetch author
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, first_name')
        .eq('id', data.user_id)
        .maybeSingle();

      setAuthor(profile);
      setLoading(false);
    }

    fetchBlog();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !blog) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-bold text-foreground">Blog not found</h1>
        <p className="text-muted-foreground">This blog post may not exist or is no longer published.</p>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    );
  }

  const blocks: BlogBlock[] = Array.isArray(blog.content) ? blog.content : [];
  const authorName = author?.display_name || author?.first_name || 'A Voyance Traveler';

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Cover */}
      {blog.cover_image_url ? (
        <div className="relative w-full h-[40vh] min-h-[300px] overflow-hidden">
          <img
            src={blog.cover_image_url}
            alt={blog.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-8 left-0 right-0 px-6">
            <div className="max-w-[680px] mx-auto">
              <h1 className="text-3xl md:text-5xl font-bold text-foreground drop-shadow-lg">{blog.title}</h1>
              {blog.subtitle && <p className="text-lg text-foreground/80 mt-2 drop-shadow">{blog.subtitle}</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="pt-16 pb-8 px-6">
          <div className="max-w-[680px] mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold text-foreground">{blog.title}</h1>
            {blog.subtitle && <p className="text-lg text-muted-foreground mt-2">{blog.subtitle}</p>}
          </div>
        </div>
      )}

      {/* Author info */}
      <div className="px-6 py-6 border-b border-border">
        <div className="max-w-[680px] mx-auto flex items-center gap-3">
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt={authorName} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">{authorName[0]}</span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">By {authorName}</p>
            <p className="text-xs text-muted-foreground">
              {blog.trip_dates && <span>{blog.trip_dates}</span>}
              {blog.trip_duration_days && <span> · {blog.trip_duration_days} days</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <article className="px-6 py-10">
        <div className="max-w-[680px] mx-auto">
          {blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      </article>

      {/* CTA Footer */}
      <div className="bg-muted/30 border-t border-border py-12 px-6 text-center">
        <p className="text-lg font-semibold text-foreground mb-2">Plan your own adventure</p>
        <p className="text-sm text-muted-foreground mb-4">AI-powered travel planning, personalized to you</p>
        <Link to="/signup">
          <Button size="lg">Get Started with Voyance</Button>
        </Link>
      </div>
    </div>
  );
}
