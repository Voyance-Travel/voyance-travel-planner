/**
 * Reliable Destination Image Utility
 * 
 * Uses curated Unsplash images as the source of truth.
 * Does NOT rely on database images which have quality issues.
 */

// Rome: local curated hero images (NO PEOPLE)
import romeHero2 from '@/assets/destinations/rome-hero-2.jpg';
import romeHero3 from '@/assets/destinations/rome-hero-3.jpg';
import romeHero4 from '@/assets/destinations/rome-hero-4.jpg';
import romeHero5 from '@/assets/destinations/rome-hero-5.jpg';

// Curated high-quality images for popular destinations
const CURATED_DESTINATION_IMAGES: Record<string, string[]> = {
  // Europe
  'paris': [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1200',
    'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=1200',
  ],
  'london': [
    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200',
    'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=1200',
    'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=1200',
  ],
  'rome': [
    romeHero5,
    romeHero2,
    romeHero3,
    romeHero4,
  ],
  'barcelona': [
    'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200',
    'https://images.unsplash.com/photo-1562883676-8c7feb83f09b?w=1200',
    'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=1200',
  ],
  'santorini': [
    'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1200',
    'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200',
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200',
  ],
  'lisbon': [
    'https://images.unsplash.com/photo-1548707309-dcebeab9ea9b?w=1200', // Lisbon colorful buildings and castle
    'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1200', // Lisbon historic streetcar
    'https://images.unsplash.com/photo-1525230071382-92de4bfbc0cc?w=1200', // Lisbon aerial view
    'https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?w=1200', // Lisbon rooftops and architecture
  ],
  'amsterdam': [
    'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1200',
    'https://images.unsplash.com/photo-1583037189850-1921ae7c6c22?w=1200',
    'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=1200',
  ],
  'vienna': [
    'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1200',
    'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200',
    'https://images.unsplash.com/photo-1573599852326-2d4da0aea6c8?w=1200',
  ],
  'copenhagen': [
    'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1200',
    'https://images.unsplash.com/photo-1552560880-2482cef14240?w=1200',
    'https://images.unsplash.com/photo-1551516594-56cb78394645?w=1200',
  ],
  'florence': [
    'https://images.unsplash.com/photo-1543429258-c5ca3c2c5c2e?w=1200',
    'https://images.unsplash.com/photo-1504019347908-b45f9b0b8dd5?w=1200',
    'https://images.unsplash.com/photo-1534359265607-b39e67e08544?w=1200',
  ],
  'porto': [
    'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200',
    'https://images.unsplash.com/photo-1513735718075-2e2d37cb7952?w=1200',
  ],
  'reykjavik': [
    'https://images.unsplash.com/photo-1529963183134-61a90db47eaf?w=1200',
    'https://images.unsplash.com/photo-1504233529578-6d46baba6d34?w=1200',
    'https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=1200',
  ],

  // Asia
  'tokyo': [
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200',
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200',
    'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=1200',
  ],
  'kyoto': [
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200',
    'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1200',
    'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?w=1200',
  ],
  'bali': [
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200',
    'https://images.unsplash.com/photo-1573790387438-4da905039392?w=1200',
    'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=1200',
  ],
  'bangkok': [
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200',
    'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=1200',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200',
  ],
  'singapore': [
    'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200',
    'https://images.unsplash.com/photo-1496939376851-89342e90adcd?w=1200',
    'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=1200',
  ],
  'seoul': [
    'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200',
    'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200',
    'https://images.unsplash.com/photo-1546874177-9e664107314e?w=1200',
  ],
  'hanoi': [
    'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=1200',
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200',
    'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1200',
  ],

  // Americas
  'new york': [
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200',
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200',
    'https://images.unsplash.com/photo-1522083165195-3424ed129620?w=1200',
  ],
  'new-york': [
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200',
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200',
    'https://images.unsplash.com/photo-1522083165195-3424ed129620?w=1200',
  ],
  'mexico city': [
    'https://images.unsplash.com/photo-1518659526054-190340b32735?w=1200',
    'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?w=1200',
    'https://images.unsplash.com/photo-1547995886-6dc09384c6e6?w=1200',
  ],
  'mexico-city': [
    'https://images.unsplash.com/photo-1518659526054-190340b32735?w=1200',
    'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?w=1200',
    'https://images.unsplash.com/photo-1547995886-6dc09384c6e6?w=1200',
  ],
  'buenos aires': [
    'https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=1200',
    'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1200',
    'https://images.unsplash.com/photo-1536086845234-586b4f845fa8?w=1200',
  ],
  'buenos-aires': [
    'https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=1200',
    'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1200',
    'https://images.unsplash.com/photo-1536086845234-586b4f845fa8?w=1200',
  ],
  'vancouver': [
    'https://images.unsplash.com/photo-1559511260-66a68e7e7a4c?w=1200',
    'https://images.unsplash.com/photo-1578469550956-0e16b69c6a3d?w=1200',
    'https://images.unsplash.com/photo-1560814304-4f05976ef22e?w=1200',
  ],
  'cartagena': [
    'https://images.unsplash.com/photo-1583531172005-0c193c8d7a98?w=1200',
    'https://images.unsplash.com/photo-1569012871812-f38ee64cd54c?w=1200',
    'https://images.unsplash.com/photo-1547149600-a6cdf8fce60c?w=1200',
  ],
  'new orleans': [
    'https://images.unsplash.com/photo-1568402102990-bc541580b59f?w=1200',
    'https://images.unsplash.com/photo-1571893544028-06b07af6dade?w=1200',
    'https://images.unsplash.com/photo-1549965738-e1aaf5d1f6b0?w=1200',
  ],
  'new-orleans': [
    'https://images.unsplash.com/photo-1568402102990-bc541580b59f?w=1200',
    'https://images.unsplash.com/photo-1571893544028-06b07af6dade?w=1200',
    'https://images.unsplash.com/photo-1549965738-e1aaf5d1f6b0?w=1200',
  ],
  'cusco': [
    'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1200',
    'https://images.unsplash.com/photo-1580619305218-8423a7ef79b4?w=1200',
    'https://images.unsplash.com/photo-1531065208531-4036c0dba3ca?w=1200',
  ],
  'oaxaca': [
    'https://images.unsplash.com/photo-1578323851363-cf6c1a0f5c61?w=1200',
    'https://images.unsplash.com/photo-1547558840-8ad6c4dc309c?w=1200',
    'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=1200',
  ],

  // Africa & Middle East
  'cape town': [
    'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200',
    'https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?w=1200',
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200',
  ],
  'cape-town': [
    'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200',
    'https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?w=1200',
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200',
  ],
  'marrakech': [
    'https://images.unsplash.com/photo-1518730518541-d0843268c287?w=1200',
    'https://images.unsplash.com/photo-1489493512598-d08130f49bea?w=1200',
    'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=1200',
  ],
  'petra': [
    'https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=1200',
    'https://images.unsplash.com/photo-1548786811-dd6e453ccca7?w=1200',
    'https://images.unsplash.com/photo-1553856622-d1b352e9a211?w=1200',
  ],
  'dubai': [
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200',
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1200',
    'https://images.unsplash.com/photo-1546412414-e1885259563a?w=1200',
  ],

  // Oceania
  'melbourne': [
    'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1200',
    'https://images.unsplash.com/photo-1545044846-351ba102b6d5?w=1200',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200',
  ],
  'sydney': [
    'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200',
    'https://images.unsplash.com/photo-1524293581917-878a6d017c71?w=1200',
    'https://images.unsplash.com/photo-1523428096881-5bd79d043006?w=1200',
  ],
  'auckland': [
    'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1200',
    'https://images.unsplash.com/photo-1595125990323-885cec5217ff?w=1200',
    'https://images.unsplash.com/photo-1544413164-5f1b361f5bfa?w=1200',
  ],
};

// Generate Unsplash URL for unknown destinations
const generateUnsplashUrl = (destination: string, index = 0): string => {
  const seed = destination.toLowerCase().replace(/[^a-z]/g, '');
  const sizes = ['1200', '800', '600'];
  const size = sizes[index % sizes.length];
  return `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=${size}&q=80&sig=${seed}${index}`;
};

// Generic travel fallbacks for completely unknown destinations
const GENERIC_TRAVEL_IMAGES = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200', // Travel suitcase
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200', // Mountain lake
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200', // Nature
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200', // Beach sunset
  'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=1200', // Travel scene
];

/**
 * Get the primary image for a destination
 */
export function getDestinationImage(destination: string): string {
  const normalized = destination.toLowerCase().trim();
  
  // Check curated images first
  if (CURATED_DESTINATION_IMAGES[normalized]) {
    return CURATED_DESTINATION_IMAGES[normalized][0];
  }
  
  // Try variations (with/without spaces, dashes)
  const withDash = normalized.replace(/\s+/g, '-');
  const withSpace = normalized.replace(/-/g, ' ');
  
  if (CURATED_DESTINATION_IMAGES[withDash]) {
    return CURATED_DESTINATION_IMAGES[withDash][0];
  }
  if (CURATED_DESTINATION_IMAGES[withSpace]) {
    return CURATED_DESTINATION_IMAGES[withSpace][0];
  }
  
  // Return a generic travel image based on destination hash
  const hash = normalized.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return GENERIC_TRAVEL_IMAGES[hash % GENERIC_TRAVEL_IMAGES.length];
}

/**
 * Get multiple images for a destination gallery
 */
export function getDestinationImages(destination: string, count = 3): string[] {
  const normalized = destination.toLowerCase().trim();
  // Also try extracting just the city name (before comma)
  const cityOnly = normalized.split(',')[0].trim();
  
  // Check curated images first with multiple matching strategies
  const images = CURATED_DESTINATION_IMAGES[normalized] 
    || CURATED_DESTINATION_IMAGES[normalized.replace(/\s+/g, '-')]
    || CURATED_DESTINATION_IMAGES[normalized.replace(/-/g, ' ')]
    || CURATED_DESTINATION_IMAGES[cityOnly]
    || CURATED_DESTINATION_IMAGES[cityOnly.replace(/\s+/g, '-')]
    || CURATED_DESTINATION_IMAGES[cityOnly.replace(/-/g, ' ')];
  
  if (images) {
    return images.slice(0, count);
  }
  
  // Generate dynamic Unsplash URLs for unknown destinations
  return Array.from({ length: count }, (_, i) => generateUnsplashUrl(destination, i));
}

/**
 * Check if we have curated images for a destination
 */
export function hasCuratedImages(destination: string): boolean {
  const normalized = destination.toLowerCase().trim();
  const cityOnly = normalized.split(',')[0].trim();
  return !!(
    CURATED_DESTINATION_IMAGES[normalized] ||
    CURATED_DESTINATION_IMAGES[normalized.replace(/\s+/g, '-')] ||
    CURATED_DESTINATION_IMAGES[normalized.replace(/-/g, ' ')] ||
    CURATED_DESTINATION_IMAGES[cityOnly] ||
    CURATED_DESTINATION_IMAGES[cityOnly.replace(/\s+/g, '-')] ||
    CURATED_DESTINATION_IMAGES[cityOnly.replace(/-/g, ' ')]
  );
}

export {
  CURATED_DESTINATION_IMAGES,
  GENERIC_TRAVEL_IMAGES,
};

export default {
  getDestinationImage,
  getDestinationImages,
  hasCuratedImages,
  CURATED_DESTINATION_IMAGES,
  GENERIC_TRAVEL_IMAGES,
};
