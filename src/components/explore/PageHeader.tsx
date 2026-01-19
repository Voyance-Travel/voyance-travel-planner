import { motion } from 'framer-motion';
import { MapPin, Calendar, Heart, Sparkles, Flower2, Sun, Leaf, Snowflake } from 'lucide-react';
import { ReactNode } from 'react';

interface PageHeaderProps {
  season?: string;
  tag?: string;
  region?: string;
}

interface ContentConfig {
  title: string;
  subtitle: string;
  icon: ReactNode;
  gradient: string;
}

const seasonalContent: Record<string, ContentConfig> = {
  spring: {
    title: "Dreaming of Spring?",
    subtitle: "These destinations are perfect for cherry blossoms, outdoor cafés, and unforgettable shoulder-season escapes.",
    icon: <Flower2 className="w-8 h-8 text-pink-500" />,
    gradient: "from-pink-50 to-green-50"
  },
  summer: {
    title: "Endless Summer Awaits",
    subtitle: "Sun-soaked beaches, vibrant festivals, and long golden evenings in the world's most captivating destinations.",
    icon: <Sun className="w-8 h-8 text-amber-500" />,
    gradient: "from-yellow-50 to-blue-50"
  },
  fall: {
    title: "Fall Into Adventure",
    subtitle: "Witness nature's grand finale with autumn foliage, harvest festivals, and cozy mountain retreats.",
    icon: <Leaf className="w-8 h-8 text-orange-500" />,
    gradient: "from-orange-50 to-red-50"
  },
  winter: {
    title: "Winter Wonderlands",
    subtitle: "From snowy escapes to tropical hideaways, discover where to spend the most magical season.",
    icon: <Snowflake className="w-8 h-8 text-sky-500" />,
    gradient: "from-blue-50 to-purple-50"
  }
};

const tagContent: Record<string, ContentConfig> = {
  romantic: {
    title: "Looking for Romance?",
    subtitle: "Candlelit dinners, sunset strolls, and destinations that spark connection.",
    icon: <Heart className="w-8 h-8 text-pink-500" />,
    gradient: "from-pink-50 to-red-50"
  },
  luxury: {
    title: "Indulge in Luxury",
    subtitle: "Five-star experiences, private villas, and destinations where every detail is perfection.",
    icon: <Sparkles className="w-8 h-8 text-amber-500" />,
    gradient: "from-amber-50 to-yellow-50"
  },
  adventure: {
    title: "Seek Your Next Adventure",
    subtitle: "Heart-pumping activities, untamed landscapes, and destinations that challenge and inspire.",
    icon: "🏔️",
    gradient: "from-green-50 to-blue-50"
  },
  cultural: {
    title: "Immerse in Culture",
    subtitle: "Ancient traditions, modern art scenes, and destinations rich with stories to discover.",
    icon: "🎭",
    gradient: "from-purple-50 to-pink-50"
  },
  foodie: {
    title: "Savor the Journey",
    subtitle: "Michelin stars, street food legends, and destinations that tantalize every taste bud.",
    icon: "🍜",
    gradient: "from-orange-50 to-red-50"
  },
  wellness: {
    title: "Find Your Balance",
    subtitle: "Healing retreats, spa sanctuaries, and destinations that rejuvenate body and soul.",
    icon: "🧘",
    gradient: "from-teal-50 to-green-50"
  }
};

const defaultContent: ContentConfig = {
  title: "Discover Your Next Destination",
  subtitle: "Explore our curated collection of extraordinary places around the world.",
  icon: <MapPin className="w-8 h-8 text-primary" />,
  gradient: "from-blue-50 to-green-50"
};

export default function PageHeader({ season, tag, region }: PageHeaderProps) {
  // Determine content based on active filters
  const getContent = (): ContentConfig => {
    if (season && seasonalContent[season]) {
      return seasonalContent[season];
    }
    if (tag && tagContent[tag]) {
      return tagContent[tag];
    }
    return defaultContent;
  };

  const content = getContent();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${content.gradient} p-8 md:p-12 mb-8`}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl">
        <div className="flex items-start gap-4 mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-4xl"
          >
            {typeof content.icon === 'string' ? content.icon : content.icon}
          </motion.div>
          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold text-foreground mb-2"
            >
              {content.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-lg text-muted-foreground leading-relaxed"
            >
              {content.subtitle}
            </motion.p>
          </div>
        </div>

        {/* Active Filters Display */}
        {(season || tag || region) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-2 mt-6"
          >
            {season && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full text-sm font-medium text-foreground">
                <Calendar className="w-4 h-4" />
                {season.charAt(0).toUpperCase() + season.slice(1)}
              </span>
            )}
            {tag && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full text-sm font-medium text-foreground">
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </span>
            )}
            {region && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full text-sm font-medium text-foreground">
                <MapPin className="w-4 h-4" />
                {region.charAt(0).toUpperCase() + region.slice(1)}
              </span>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
