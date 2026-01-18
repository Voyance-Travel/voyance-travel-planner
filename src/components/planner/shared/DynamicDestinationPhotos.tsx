import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';

interface DynamicDestinationPhotosProps {
  destination: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  variant?: 'hero' | 'compact' | 'banner';
  className?: string;
}

// Unsplash search-based dynamic photos
// Uses the destination name as search query for relevant images
function buildUnsplashUrl(query: string, index: number = 0, width: number = 1200): string {
  // Using Unsplash Source API with search query
  // Adding index to sig to get different images for same query
  const searchQuery = encodeURIComponent(`${query} travel landmark`);
  return `https://source.unsplash.com/featured/${width}x800/?${searchQuery}&sig=${index}`;
}

// Extended gallery with many more destinations
const extendedGallery: Record<string, string[]> = {
  // Major Cities
  'Tokyo': [
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80',
    'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=1200&q=80',
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200&q=80',
    'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=1200&q=80',
  ],
  'Paris': [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1200&q=80',
    'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=1200&q=80',
    'https://images.unsplash.com/photo-1478391679764-b2d8b3cd1e94?w=1200&q=80',
  ],
  'London': [
    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=80',
    'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=1200&q=80',
    'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=1200&q=80',
    'https://images.unsplash.com/photo-1520986606214-8b456906c813?w=1200&q=80',
  ],
  'New York': [
    'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1200&q=80',
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&q=80',
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200&q=80',
    'https://images.unsplash.com/photo-1518391846015-55a9cc003b25?w=1200&q=80',
  ],
  // Morocco
  'Casablanca': [
    'https://images.unsplash.com/photo-1569383746724-6f1b882b8f46?w=1200&q=80',
    'https://images.unsplash.com/photo-1548017043-b3774c63b34a?w=1200&q=80',
    'https://images.unsplash.com/photo-1553899017-a883dac66b0e?w=1200&q=80',
    'https://images.unsplash.com/photo-1596455607563-ad6193f76b17?w=1200&q=80',
  ],
  'Marrakech': [
    'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1200&q=80',
    'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=1200&q=80',
    'https://images.unsplash.com/photo-1518544866330-4e716499f800?w=1200&q=80',
    'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1200&q=80',
  ],
  // Europe
  'Rome': [
    'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&q=80',
    'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=1200&q=80',
    'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=1200&q=80',
    'https://images.unsplash.com/photo-1525874684015-58379d421a52?w=1200&q=80',
  ],
  'Barcelona': [
    'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200&q=80',
    'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1200&q=80',
    'https://images.unsplash.com/photo-1511527661048-7fe73d85e9a4?w=1200&q=80',
    'https://images.unsplash.com/photo-1562883676-8c7feb83f09b?w=1200&q=80',
  ],
  'Amsterdam': [
    'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1200&q=80',
    'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=1200&q=80',
    'https://images.unsplash.com/photo-1576924542622-772281b13aa8?w=1200&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
  ],
  'Prague': [
    'https://images.unsplash.com/photo-1541849546-216549ae216d?w=1200&q=80',
    'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200&q=80',
    'https://images.unsplash.com/photo-1592906209472-a36b1f3782ef?w=1200&q=80',
    'https://images.unsplash.com/photo-1458150945447-7fb764c11a92?w=1200&q=80',
  ],
  // Asia
  'Kyoto': [
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80',
    'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1200&q=80',
    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1200&q=80',
    'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?w=1200&q=80',
  ],
  'Bangkok': [
    'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=1200&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
    'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1200&q=80',
    'https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?w=1200&q=80',
  ],
  'Singapore': [
    'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=80',
    'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=1200&q=80',
    'https://images.unsplash.com/photo-1565967511849-76a60a516170?w=1200&q=80',
    'https://images.unsplash.com/photo-1496939376851-89342e90adcd?w=1200&q=80',
  ],
  'Dubai': [
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1200&q=80',
    'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=1200&q=80',
    'https://images.unsplash.com/photo-1546412414-e1885259563a?w=1200&q=80',
  ],
  // Americas
  'Los Angeles': [
    'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=1200&q=80',
    'https://images.unsplash.com/photo-1515896769750-31548aa180ed?w=1200&q=80',
    'https://images.unsplash.com/photo-1580655653885-65763b2597d0?w=1200&q=80',
    'https://images.unsplash.com/photo-1496200186974-4293800e2c20?w=1200&q=80',
  ],
  'Miami': [
    'https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=1200&q=80',
    'https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1200&q=80',
    'https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?w=1200&q=80',
    'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=1200&q=80',
  ],
  'Mexico City': [
    'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?w=1200&q=80',
    'https://images.unsplash.com/photo-1518659526054-190340b32735?w=1200&q=80',
    'https://images.unsplash.com/photo-1547995886-6dc09384c6e6?w=1200&q=80',
    'https://images.unsplash.com/photo-1574493264149-87eb28ac6fbd?w=1200&q=80',
  ],
  // Islands
  'Bali': [
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80',
    'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&q=80',
    'https://images.unsplash.com/photo-1573790387438-4da905039392?w=1200&q=80',
    'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1200&q=80',
  ],
  'Maldives': [
    'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1200&q=80',
    'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=1200&q=80',
    'https://images.unsplash.com/photo-1540202404-1b927e27fa8b?w=1200&q=80',
    'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=1200&q=80',
  ],
  'Sydney': [
    'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200&q=80',
    'https://images.unsplash.com/photo-1529026341150-ed63e25cbcf9?w=1200&q=80',
    'https://images.unsplash.com/photo-1523428096881-5bd79d043006?w=1200&q=80',
    'https://images.unsplash.com/photo-1598948485421-33a1655d3c18?w=1200&q=80',
  ],
};

function getImagesForDestination(destination: string): string[] {
  // Normalize destination name
  const normalizedDest = destination.trim();
  
  // Try exact match first
  if (extendedGallery[normalizedDest]) {
    return extendedGallery[normalizedDest];
  }
  
  // Try case-insensitive match
  const lowerDest = normalizedDest.toLowerCase();
  for (const [key, images] of Object.entries(extendedGallery)) {
    if (key.toLowerCase() === lowerDest || lowerDest.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerDest)) {
      return images;
    }
  }
  
  // Generate dynamic Unsplash URLs for unknown destinations
  return Array.from({ length: 4 }, (_, i) => buildUnsplashUrl(normalizedDest, i));
}

export default function DynamicDestinationPhotos({
  destination,
  startDate,
  endDate,
  travelers,
  variant = 'hero',
  className = '',
}: DynamicDestinationPhotosProps) {
  const images = getImagesForDestination(destination);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([0]));

  // Preload next image
  useEffect(() => {
    const nextIndex = (currentIndex + 1) % images.length;
    if (!loadedImages.has(nextIndex)) {
      const img = new Image();
      img.src = images[nextIndex];
      img.onload = () => {
        setLoadedImages(prev => new Set(prev).add(nextIndex));
      };
    }
  }, [currentIndex, images, loadedImages]);

  // Auto-rotate images
  useEffect(() => {
    if (isHovered || variant === 'compact') return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [images.length, isHovered, variant]);

  const goNext = useCallback(() => setCurrentIndex((prev) => (prev + 1) % images.length), [images.length]);
  const goPrev = useCallback(() => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length), [images.length]);

  const formatDateRange = () => {
    if (!startDate || !endDate) return null;
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } catch {
      return null;
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`relative rounded-xl overflow-hidden h-20 bg-gradient-to-r from-primary/20 to-accent/20 ${className}`}>
        <img
          src={images[0]}
          alt={destination}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
        <div className="absolute inset-0 p-3 flex items-center">
          <div className="flex items-center gap-2 text-white text-sm">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{destination}</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div 
        className={`relative rounded-2xl overflow-hidden h-32 bg-gradient-to-r from-primary/20 to-accent/20 ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            src={images[currentIndex]}
            alt={destination}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
        
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
        
        <div className="absolute inset-0 p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-white mb-1">
              <MapPin className="w-5 h-5" />
              <h3 className="text-xl font-serif font-semibold">{destination}</h3>
            </div>
            <div className="flex items-center gap-4 text-white/80 text-sm">
              {formatDateRange() && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDateRange()}
                </span>
              )}
              {travelers && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {travelers} traveler{travelers > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          
          {images.length > 1 && (
            <div className="flex gap-1">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex ? 'bg-white w-4' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Hero variant (default)
  return (
    <div 
      className={`relative rounded-2xl overflow-hidden h-56 md:h-72 bg-gradient-to-r from-primary/20 to-accent/20 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image Carousel */}
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          src={images[currentIndex]}
          alt={destination}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
      
      {/* Navigation Arrows */}
      {isHovered && images.length > 1 && (
        <>
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        </>
      )}
      
      {/* Dots Indicator */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex 
                ? 'bg-white w-6' 
                : 'bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
      
      {/* Content Overlay */}
      <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-white mb-2">
              <MapPin className="w-5 h-5" />
              <h2 className="text-3xl md:text-4xl font-serif font-semibold">{destination}</h2>
            </div>
            <div className="flex items-center gap-4 text-white/80 text-sm">
              {formatDateRange() && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDateRange()}
                </span>
              )}
              {travelers && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {travelers} traveler{travelers > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          
          <div className="text-white/60 text-sm bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export the helper function for use elsewhere
export { getImagesForDestination, buildUnsplashUrl };
