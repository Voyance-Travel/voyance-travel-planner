/**
 * Public Travel Guide Page
 * Clean, Voyance-branded, read-only published guide
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Calendar, Instagram, Youtube, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTravelGuideBySlug, type TravelGuide } from '@/services/travelGuideService';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

export default function PublicTravelGuide() {
  const { slug } = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<TravelGuide | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      try {
        const data = await getTravelGuideBySlug(slug!);
        if (!data) {
          setNotFound(true);
          return;
        }
        setGuide(data);

        // Fetch author info
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', data.user_id)
          .single();

        if (profile) {
          setAuthorName(profile.display_name || 'A Voyance Traveler');
          setAuthorAvatar(profile.avatar_url);
        }
      } catch (err) {
        console.error('Failed to load guide:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading guide...</div>
      </div>
    );
  }

  if (notFound || !guide) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <h2 className="text-2xl font-bold mb-2">Guide not found</h2>
        <p className="text-muted-foreground mb-4">This guide may have been removed or unpublished.</p>
        <Link to="/">
          <Button>Go to Voyance</Button>
        </Link>
      </div>
    );
  }

  const socialLinks = (guide.social_links && typeof guide.social_links === 'object')
    ? guide.social_links as Record<string, string>
    : {};
  const hasSocialLinks = Object.values(socialLinks).some(v => v);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      {guide.cover_image_url && (
        <div className="relative h-64 md:h-80 overflow-hidden">
          <img
            src={guide.cover_image_url}
            alt={guide.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Title & Meta */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{guide.title}</h1>

          <div className="flex items-center gap-3 mb-4">
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                {authorName.charAt(0)}
              </div>
            )}
            <span className="text-sm font-medium">{authorName}</span>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {guide.destination && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {guide.destination}
              </span>
            )}
            {guide.published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(guide.published_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* Social Links */}
          {hasSocialLinks && (
            <div className="flex items-center gap-3 mt-4">
              {socialLinks.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {socialLinks.tiktok && (
                <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <span className="text-lg">🎵</span>
                </a>
              )}
              {socialLinks.youtube && (
                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Youtube className="h-5 w-5" />
                </a>
              )}
              {socialLinks.blog && (
                <a href={socialLinks.blog} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </header>

        {/* Guide Content */}
        <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none mb-12">
          <ReactMarkdown>{guide.content}</ReactMarkdown>
        </article>

        {/* Voyance Footer CTA */}
        <div className="border-t pt-8 pb-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            This guide was created with Voyance — the AI travel planner
          </p>
          <Link to="/start">
            <Button>
              Plan your own trip
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
