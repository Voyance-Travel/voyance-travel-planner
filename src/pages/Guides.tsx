import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { BookOpen, Clock, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getGuides, getGuideCategories, type Guide } from '@/services/supabase/guides';

// Fallback data for when database is empty
const fallbackGuides = [
  {
    id: 'fallback-1',
    slug: 'first-time-japan',
    title: 'First Time in Japan',
    excerpt: 'Everything you need to know for your first visit to Japan, from transit tips to cultural etiquette.',
    image_url: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80',
    reading_time: 15,
    category: 'Destination Guide',
    destination_country: 'Japan',
  },
  {
    id: 'fallback-2',
    slug: 'europe-on-budget',
    title: 'Europe on a Budget',
    excerpt: 'How to explore Europe without breaking the bank. Tips for affordable travel, dining, and experiences.',
    image_url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80',
    reading_time: 12,
    category: 'Budget Travel',
    destination_country: 'Europe',
  },
  {
    id: 'fallback-3',
    slug: 'solo-female-travel',
    title: 'Solo Female Travel Guide',
    excerpt: 'Empowering tips and destinations for women traveling solo. Safety, community, and adventure.',
    image_url: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800&q=80',
    reading_time: 18,
    category: 'Solo Travel',
    destination_country: 'Worldwide',
  },
];

export default function Guides() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // Load guides
        const guidesData = await getGuides({ limit: 20 });
        setGuides(guidesData);
        
        // Load categories
        const categoriesData = await getGuideCategories();
        setCategories(['All', ...categoriesData]);
      } catch (error) {
        console.error('Error loading guides:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  const filteredGuides = selectedCategory === 'All' 
    ? guides 
    : guides.filter(g => g.category?.toLowerCase() === selectedCategory.toLowerCase());

  // Use fallback data if no guides in database
  const displayGuides = guides.length > 0 ? filteredGuides : fallbackGuides;

  if (loading) {
    return (
      <MainLayout>
        <Head title="Travel Guides | Voyance" description="Expert travel guides to help you explore the world." />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

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

      {/* Category Filter */}
      {categories.length > 1 && (
        <section className="py-6 border-b border-border">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Guides Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          {displayGuides.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No guides found for this category.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayGuides.map((guide, index) => (
                <motion.article
                  key={guide.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 hover:shadow-lg transition-all"
                >
                  <Link to={`/guides/${guide.slug}`}>
                    {/* Image */}
                    <div className="aspect-[16/10] overflow-hidden relative">
                      <img
                        src={guide.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80'}
                        alt={guide.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {guide.category && (
                        <div className="absolute top-4 left-4">
                          <span className="bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium px-3 py-1 rounded-full">
                            {guide.category}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                        {guide.title}
                      </h3>
                      {guide.excerpt && (
                        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                          {guide.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          {guide.reading_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {guide.reading_time} min read
                            </span>
                          )}
                          {guide.destination_country && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {guide.destination_country}
                            </span>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          )}
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
