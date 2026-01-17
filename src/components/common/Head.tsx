import { useEffect } from 'react';

interface HeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

/**
 * Head component for managing document head meta tags
 * Sets title, description, and Open Graph meta tags
 */
export default function Head({
  title = 'Voyance | AI-Powered Travel Planning',
  description = 'Plan your dream trip with Voyance. AI-powered itineraries, personalized recommendations, and seamless booking.',
  canonical,
  ogImage = '/og-image.jpg',
  noIndex = false,
}: HeadProps) {
  useEffect(() => {
    // Set document title
    document.title = title;

    // Helper to set or create meta tag
    const setMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      
      meta.setAttribute('content', content);
    };

    // Set meta tags
    setMetaTag('description', description);
    setMetaTag('og:title', title, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:image', ogImage, true);
    setMetaTag('og:type', 'website', true);
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', ogImage);

    if (noIndex) {
      setMetaTag('robots', 'noindex, nofollow');
    }

    // Set canonical link
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    // Cleanup function
    return () => {
      // Reset title on unmount if needed
    };
  }, [title, description, canonical, ogImage, noIndex]);

  return null;
}
