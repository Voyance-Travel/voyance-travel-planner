/**
 * JSON-LD Article structured data for editorial guides.
 */
import { useEffect } from 'react';

interface EditorialArticleSchemaProps {
  title: string;
  description: string;
  imageUrl?: string;
  authorName: string;
  datePublished?: string | null;
  guideUrl: string;
}

export default function EditorialArticleSchema({
  title,
  description,
  imageUrl,
  authorName,
  datePublished,
  guideUrl,
}: EditorialArticleSchemaProps) {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      ...(imageUrl ? { image: imageUrl } : {}),
      author: {
        '@type': 'Person',
        name: authorName,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Voyance',
        logo: {
          '@type': 'ImageObject',
          url: 'https://travelwithvoyance.com/voyance-logo.png',
        },
      },
      ...(datePublished ? { datePublished } : {}),
      mainEntityOfPage: guideUrl,
    };

    let script = document.getElementById('editorial-article-schema') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'editorial-article-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      const el = document.getElementById('editorial-article-schema');
      if (el) el.remove();
    };
  }, [title, description, imageUrl, authorName, datePublished, guideUrl]);

  return null;
}
