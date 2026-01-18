import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface DestinationTeaserProps {
  destination: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  compact?: boolean;
}

// Curated destination images with multiple photos per location
const destinationGallery: Record<string, string[]> = {
  'Tokyo': [
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
    'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=800&q=80',
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80',
    'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=800&q=80',
  ],
  'Paris': [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80',
    'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=800&q=80',
    'https://images.unsplash.com/photo-1478391679764-b2d8b3cd1e94?w=800&q=80',
  ],
  'London': [
    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80',
    'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=800&q=80',
    'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=800&q=80',
    'https://images.unsplash.com/photo-1520986606214-8b456906c813?w=800&q=80',
  ],
  'New York': [
    'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=800&q=80',
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80',
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80',
    'https://images.unsplash.com/photo-1518391846015-55a9cc003b25?w=800&q=80',
  ],
  'Rome': [
    'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80',
    'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=800&q=80',
    'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800&q=80',
    'https://images.unsplash.com/photo-1525874684015-58379d421a52?w=800&q=80',
  ],
  'Barcelona': [
    'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&q=80',
    'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80',
    'https://images.unsplash.com/photo-1511527661048-7fe73d85e9a4?w=800&q=80',
    'https://images.unsplash.com/photo-1562883676-8c7feb83f09b?w=800&q=80',
  ],
  'Kyoto': [
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
    'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80',
    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
    'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?w=800&q=80',
  ],
  'Dubai': [
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&q=80',
    'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=800&q=80',
    'https://images.unsplash.com/photo-1546412414-e1885259563a?w=800&q=80',
  ],
  'Sydney': [
    'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80',
    'https://images.unsplash.com/photo-1529026341150-ed63e25cbcf9?w=800&q=80',
    'https://images.unsplash.com/photo-1523428096881-5bd79d043006?w=800&q=80',
    'https://images.unsplash.com/photo-1598948485421-33a1655d3c18?w=800&q=80',
  ],
  'Atlanta': [
    'https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=800&q=80',
    'https://images.unsplash.com/photo-1591177570477-2ebfc7e2f1bb?w=800&q=80',
    'https://images.unsplash.com/photo-1559315266-60d1cc6e35a3?w=800&q=80',
    'https://images.unsplash.com/photo-1580492516014-4a28466d55df?w=800&q=80',
  ],
};

const defaultImages = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
  'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
];

function getImagesForDestination(destination: string): string[] {
  // Try exact match first
  if (destinationGallery[destination]) {
    return destinationGallery[destination];
  }
  
  // Try case-insensitive match
  const lowerDest = destination.toLowerCase();
  for (const [key, images] of Object.entries(destinationGallery)) {
    if (key.toLowerCase() === lowerDest || lowerDest.includes(key.toLowerCase())) {
      return images;
    }
  }
  
  return defaultImages;
}

export default function DestinationTeaser({
  destination,
  startDate,
  endDate,
  travelers,
  compact = false,
}: DestinationTeaserProps) {
  const images = getImagesForDestination(destination);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-rotate images
  useEffect(() => {
    if (isHovered) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [images.length, isHovered]);

  const goNext = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

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

  if (compact) {
    return (
      <div className="relative rounded-xl overflow-hidden h-32 bg-gradient-to-r from-primary/20 to-accent/20">
        <motion.img
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          src={images[currentIndex]}
          alt={destination}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
        <div className="absolute inset-0 p-4 flex items-center">
          <div>
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{destination}</span>
            </div>
            {formatDateRange() && (
              <p className="text-white/60 text-xs">{formatDateRange()}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative rounded-2xl overflow-hidden h-48 md:h-56 bg-gradient-to-r from-primary/20 to-accent/20"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image Carousel */}
      <motion.img
        key={currentIndex}
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7 }}
        src={images[currentIndex]}
        alt={destination}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
      
      {/* Navigation Arrows (visible on hover) */}
      {isHovered && images.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
      
      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentIndex 
                ? 'bg-white w-4' 
                : 'bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
      
      {/* Content Overlay */}
      <div className="absolute inset-0 p-6 flex flex-col justify-end">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-white mb-2">
              <MapPin className="w-5 h-5" />
              <h2 className="text-2xl font-display font-medium">{destination}</h2>
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
          
          <div className="text-white/60 text-xs">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </div>
    </div>
  );
}
