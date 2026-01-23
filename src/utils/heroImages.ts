/**
 * Hero Image Management for Voyance
 * Centralized hero images for consistent visual storytelling
 */

export interface HeroImageSet {
  primary: string;
  fallbacks: string[];
  alt: string;
}

export type HeroPageType = 'home' | 'explore' | 'planning' | 'profile' | 'auth';

/**
 * Main hero image library
 * Each page type has carefully selected imagery to match the emotional context:
 * - Home: Bold, inspirational, global perspective
 * - Explore: Adventure, discovery, rich cultural contexts
 * - Planning: Focused, practical, anticipatory
 * - Profile: Reflective, journal-like, personal
 * - Auth: Inviting, aspirational
 */
const heroImages: Record<HeroPageType, HeroImageSet> = {
  home: {
    primary: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80',
    fallbacks: [
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80',
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80',
    ],
    alt: 'Global travel planning made personal',
  },
  explore: {
    primary: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1920&q=80',
    fallbacks: [
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1920&q=80',
      'https://images.unsplash.com/photo-1548013146-72479768bada?w=1920&q=80',
    ],
    alt: 'Discover amazing destinations with Voyance',
  },
  planning: {
    primary: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80',
    fallbacks: [
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80',
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80',
    ],
    alt: 'Plan your perfect journey with Voyance',
  },
  profile: {
    primary: 'https://images.unsplash.com/photo-1484544808355-8ec84e534d75?w=1920&q=80',
    fallbacks: [
      'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1920&q=80',
      'https://images.unsplash.com/photo-1528164344705-47542687000d?w=1920&q=80',
    ],
    alt: 'Your personal travel profile',
  },
  auth: {
    primary: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&q=80',
    fallbacks: [
      'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1920&q=80',
      'https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=1920&q=80',
    ],
    alt: 'Begin your journey to paradise with Voyance',
  },
};

/**
 * Retrieves the appropriate hero image set for a specific page type
 */
export function getHeroImageForPage(pageType: HeroPageType): HeroImageSet {
  return heroImages[pageType] || heroImages.home;
}

/**
 * Retrieves a specific hero image with proper fallback handling
 */
export function getHeroImage(pageType: HeroPageType, useFallback = false): string {
  const imageSet = getHeroImageForPage(pageType);
  return useFallback && imageSet.fallbacks.length > 0 
    ? imageSet.fallbacks[0] 
    : imageSet.primary;
}

/**
 * Gets appropriate alt text for a hero image
 */
export function getHeroAltText(pageType: HeroPageType): string {
  return getHeroImageForPage(pageType).alt;
}

/**
 * Get a random hero image from the fallbacks
 */
export function getRandomHeroImage(pageType: HeroPageType): string {
  const imageSet = getHeroImageForPage(pageType);
  const allImages = [imageSet.primary, ...imageSet.fallbacks];
  return allImages[Math.floor(Math.random() * allImages.length)];
}
