/**
 * Structured Data (JSON-LD) Components for SEO
 * 
 * Provides schema.org structured data for better search engine understanding
 */

import { useEffect } from 'react';

const SITE_URL = 'https://travelwithvoyance.com';
const SITE_NAME = 'Voyance';

interface OrganizationSchemaProps {
  name?: string;
  url?: string;
  logo?: string;
  description?: string;
}

export function OrganizationSchema({
  name = SITE_NAME,
  url = SITE_URL,
  logo = `${SITE_URL}/og-image.jpg`,
  description = 'AI-powered travel planning that creates personalized itineraries based on your unique travel style.',
}: OrganizationSchemaProps) {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name,
      url,
      logo,
      description,
      sameAs: [
        'https://twitter.com/VoyanceTravel',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        url: `${url}/contact`,
      },
    };

    injectSchema('organization-schema', schema);
    return () => removeSchema('organization-schema');
  }, [name, url, logo, description]);

  return null;
}

interface WebSiteSchemaProps {
  name?: string;
  url?: string;
}

export function WebSiteSchema({
  name = SITE_NAME,
  url = SITE_URL,
}: WebSiteSchemaProps) {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name,
      url,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${url}/explore?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    };

    injectSchema('website-schema', schema);
    return () => removeSchema('website-schema');
  }, [name, url]);

  return null;
}

interface BreadcrumbSchemaProps {
  items: Array<{ name: string; url: string }>;
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
      })),
    };

    injectSchema('breadcrumb-schema', schema);
    return () => removeSchema('breadcrumb-schema');
  }, [items]);

  return null;
}

interface FAQSchemaProps {
  questions: Array<{ question: string; answer: string }>;
}

export function FAQSchema({ questions }: FAQSchemaProps) {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: questions.map((q) => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answer,
        },
      })),
    };

    injectSchema('faq-schema', schema);
    return () => removeSchema('faq-schema');
  }, [questions]);

  return null;
}

interface ProductSchemaProps {
  name: string;
  description: string;
  price: number;
  currency?: string;
  image?: string;
}

export function ProductSchema({
  name,
  description,
  price,
  currency = 'USD',
  image = `${SITE_URL}/og-image.jpg`,
}: ProductSchemaProps) {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description,
      image,
      offers: {
        '@type': 'Offer',
        price,
        priceCurrency: currency,
        availability: 'https://schema.org/InStock',
      },
    };

    injectSchema('product-schema', schema);
    return () => removeSchema('product-schema');
  }, [name, description, price, currency, image]);

  return null;
}

interface TravelAgencySchemaProps {
  name?: string;
  url?: string;
  description?: string;
}

export function TravelAgencySchema({
  name = SITE_NAME,
  url = SITE_URL,
  description = 'AI-powered travel planning service that creates personalized itineraries based on your unique travel DNA.',
}: TravelAgencySchemaProps) {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'TravelAgency',
      name,
      url,
      description,
      priceRange: '$$',
      areaServed: {
        '@type': 'Place',
        name: 'Worldwide',
      },
      serviceType: 'Travel Planning',
    };

    injectSchema('travel-agency-schema', schema);
    return () => removeSchema('travel-agency-schema');
  }, [name, url, description]);

  return null;
}

// Utility functions
function injectSchema(id: string, schema: object) {
  let script = document.getElementById(id) as HTMLScriptElement | null;
  
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  
  script.textContent = JSON.stringify(schema);
}

function removeSchema(id: string) {
  const script = document.getElementById(id);
  if (script) {
    script.remove();
  }
}

export default {
  OrganizationSchema,
  WebSiteSchema,
  BreadcrumbSchema,
  FAQSchema,
  ProductSchema,
  TravelAgencySchema,
};
