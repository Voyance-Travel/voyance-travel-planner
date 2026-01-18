import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { BookOpen, Clock, MapPin, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// Comprehensive travel guides with unique images
const guides = [
  {
    slug: 'first-time-japan',
    title: 'First Time in Japan',
    description: 'Everything you need to know for your first visit to Japan, from transit tips to cultural etiquette.',
    image: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80',
    readTime: '15 min read',
    category: 'Destination Guide',
    region: 'Asia',
  },
  {
    slug: 'europe-on-budget',
    title: 'Europe on a Budget',
    description: 'How to explore Europe without breaking the bank. Tips for affordable travel, dining, and experiences.',
    image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80',
    readTime: '12 min read',
    category: 'Budget Travel',
    region: 'Europe',
  },
  {
    slug: 'solo-female-travel',
    title: 'Solo Female Travel Guide',
    description: 'Empowering tips and destinations for women traveling solo. Safety, community, and adventure.',
    image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800&q=80',
    readTime: '18 min read',
    category: 'Solo Travel',
    region: 'Worldwide',
  },
  {
    slug: 'family-travel-essentials',
    title: 'Family Travel Essentials',
    description: 'Master the art of traveling with kids. Packing lists, entertainment ideas, and family-friendly destinations.',
    image: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&q=80',
    readTime: '14 min read',
    category: 'Family Travel',
    region: 'Worldwide',
  },
  {
    slug: 'southeast-asia-adventure',
    title: 'Southeast Asia Adventure',
    description: 'From temples to beaches, discover the best of Thailand, Vietnam, Cambodia, and beyond.',
    image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&q=80',
    readTime: '20 min read',
    category: 'Destination Guide',
    region: 'Asia',
  },
  {
    slug: 'sustainable-travel',
    title: 'Sustainable Travel 101',
    description: 'How to minimize your environmental impact while maximizing your travel experiences.',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80',
    readTime: '10 min read',
    category: 'Eco Travel',
    region: 'Worldwide',
  },
  {
    slug: 'mediterranean-food-tour',
    title: 'Mediterranean Food Journey',
    description: 'A culinary adventure through Italy, Greece, Spain, and beyond. Must-try dishes and hidden gems.',
    image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800&q=80',
    readTime: '16 min read',
    category: 'Food & Culture',
    region: 'Europe',
  },
  {
    slug: 'road-trip-usa',
    title: 'Ultimate USA Road Trip',
    description: 'Plan the perfect American road trip. Routes, stops, and tips for an unforgettable journey.',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
    readTime: '22 min read',
    category: 'Road Trip',
    region: 'North America',
  },
];

const categories = ['All', 'Destination Guide', 'Budget Travel', 'Solo Travel', 'Family Travel', 'Eco Travel', 'Food & Culture', 'Road Trip'];

export default function Guides() {
  return (
    <MainLayout>
      <Head
        title="Travel Guides | Voyance"
        description="Expert travel guides to help you explore the world. Tips, itineraries, and insider knowledge for every type of traveler."
      />
      
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <BookOpen className="w-16 h-16 mx-auto mb-6 text-primary" />
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Travel Guides
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Expert insights, tips, and inspiration for every type of journey
            </p>
          </motion.div>
        </div>
      </section>

      {/* Guides Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {guides.map((guide, index) => (
              <motion.article
                key={guide.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 hover:shadow-lg transition-all"
              >
                <Link to={`/guides/${guide.slug}`}>
                  {/* Image */}
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <img
                      src={guide.image}
                      alt={guide.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium px-3 py-1 rounded-full">
                        {guide.category}
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {guide.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                      {guide.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {guide.readTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {guide.region}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-semibold mb-4">Ready to Start Your Journey?</h2>
          <p className="text-muted-foreground mb-8">
            Take our Travel DNA quiz to get personalized destination recommendations.
          </p>
          <Button size="lg" asChild>
            <Link to="/quiz">Take the Quiz</Link>
          </Button>
        </div>
      </section>
    </MainLayout>
  );
}
