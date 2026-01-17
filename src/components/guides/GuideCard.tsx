import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Guide } from '@/data/guides';

interface GuideCardProps {
  guide: Guide;
  priority?: number;
}

export default function GuideCard({ guide, priority = 0 }: GuideCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const {
    slug,
    title,
    summary,
    coverImage,
    category,
    readTime,
    datePublished,
    featured
  } = guide;

  // Format published date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <motion.div
      className="bg-card rounded-xl shadow-md overflow-hidden h-full flex flex-col border border-border"
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: priority * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        to={`/guides/${slug}`}
        className="block overflow-hidden h-48 md:h-52 relative"
      >
        <motion.div
          animate={isHovered ? { scale: 1.05 } : { scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full h-full"
        >
          <img
            src={imageError ? '/placeholder.svg' : coverImage}
            alt={title}
            className="w-full h-full object-cover object-center"
            onError={() => setImageError(true)}
          />
        </motion.div>
        
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
            {category}
          </span>
          {featured && (
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
              Featured
            </span>
          )}
        </div>
      </Link>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex-grow">
          <Link to={`/guides/${slug}`}>
            <h3 className="text-lg font-semibold text-foreground mb-2 hover:text-primary transition line-clamp-2">
              {title}
            </h3>
          </Link>
          <p className="text-muted-foreground text-sm line-clamp-3 mb-4">
            {summary}
          </p>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-3 border-t border-border">
          <span>{formatDate(datePublished)}</span>
          <span>{readTime}</span>
        </div>
      </div>
    </motion.div>
  );
}
