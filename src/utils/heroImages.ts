/**
 * Hero Image Management for Voyance
 * Centralized hero images for consistent visual storytelling
 * All images served from internal Supabase storage (site-images bucket)
 */

import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';

export interface HeroImageSet {
  primary: string;
  fallbacks: string[];
  alt: string;
}

export type HeroPageType = 'home' | 'explore' | 'planning' | 'profile' | 'auth' | 'itinerary' | 'hotel';

const img = toSiteImageUrlFromPhotoId;

const heroImages: Record<HeroPageType, HeroImageSet> = {
  home: {
    primary: img('photo-1436491865332-7a61a109cc05'),
    fallbacks: [
      img('photo-1469474968028-56623f02e42e'),
      img('photo-1476514525535-07fb3b4ae5f1'),
    ],
    alt: 'Global travel planning made personal',
  },
  explore: {
    primary: img('photo-1519677100203-a0e668c92439'),
    fallbacks: [
      img('photo-1503899036084-c55cdd92da26'),
      img('photo-1548013146-72479768bada'),
    ],
    alt: 'Discover amazing destinations with Voyance',
  },
  planning: {
    primary: img('photo-1469474968028-56623f02e42e'),
    fallbacks: [
      img('photo-1501785888041-af3ef285b470'),
      img('photo-1476514525535-07fb3b4ae5f1'),
    ],
    alt: 'Plan your perfect journey with Voyance',
  },
  profile: {
    primary: img('photo-1484544808355-8ec84e534d75'),
    fallbacks: [
      img('photo-1500835556837-99ac94a94552'),
      img('photo-1528164344705-47542687000d'),
    ],
    alt: 'Your personal travel profile',
  },
  auth: {
    primary: img('photo-1506929562872-bb421503ef21'),
    fallbacks: [
      img('photo-1510414842594-a61c69b5ae57'),
      img('photo-1545579133-99bb5ab189bd'),
    ],
    alt: 'Begin your journey to paradise with Voyance',
  },
  itinerary: {
    primary: img('photo-1507525428034-b723cf961d3e'),
    fallbacks: [
      img('photo-1502003148287-a82ef80a6abc'),
      img('photo-1476514525535-07fb3b4ae5f1'),
    ],
    alt: 'Build your perfect day-by-day adventure',
  },
  hotel: {
    primary: img('photo-1566073771259-6a8506099945'),
    fallbacks: [
      img('photo-1520250497591-112f2f40a3f4'),
      img('photo-1542314831-068cd1dbfeeb'),
    ],
    alt: 'Find your perfect accommodation',
  },
};

export function getHeroImageForPage(pageType: HeroPageType): HeroImageSet {
  return heroImages[pageType] || heroImages.home;
}

export function getHeroImage(pageType: HeroPageType, useFallback = false): string {
  const imageSet = getHeroImageForPage(pageType);
  return useFallback && imageSet.fallbacks.length > 0 
    ? imageSet.fallbacks[0] 
    : imageSet.primary;
}

export function getHeroAltText(pageType: HeroPageType): string {
  return getHeroImageForPage(pageType).alt;
}

export function getRandomHeroImage(pageType: HeroPageType): string {
  const imageSet = getHeroImageForPage(pageType);
  const allImages = [imageSet.primary, ...imageSet.fallbacks];
  return allImages[Math.floor(Math.random() * allImages.length)];
}
