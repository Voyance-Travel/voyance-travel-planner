import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { BookOpen, Clock, MapPin, ArrowRight, Users, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { guides, getAllCategories } from '@/data/guides';
import { CommunityGuidesGrid } from '@/components/guides/CommunityGuidesGrid';

export default function Guides() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const categories = ['All', ...getAllCategories()];

  const filteredGuides = selectedCategory === 'All' 
    ? guides 
    : guides.filter(g => g.category === selectedCategory);

  return (
    <MainLayout>
      <Head
        title="Travel Guides | Voyance"
        description="Expert travel guides to help you explore the world. Tips, itineraries, and insider knowledge for every type of traveler."
      />
      
      {/* Hero */}
      <section className="pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-muted p-8 md:p-12"
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
                >
                  <BookOpen className="w-8 h-8 text-primary" />
                </motion.div>
                <div className="flex-1">
                  <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2"
                  >
                    Travel Guides
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="text-lg text-muted-foreground leading-relaxed"
                  >
                    Expert insights, tips, and inspiration for every type of journey
                  </motion.p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Discovery Tabs */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs defaultValue="voyance" className="w-full">
            <TabsList className="mb-6 bg-muted/50">
              <TabsTrigger value="voyance" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Voyance Guides
              </TabsTrigger>
              <TabsTrigger value="community" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Community
              </TabsTrigger>
            </TabsList>

            {/* ── Voyance Guides Tab (existing editorial content, unchanged) ── */}
            <TabsContent value="voyance" className="mt-0">
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 py-4 mb-6 border-b border-border">
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

              {/* Guides Grid */}
              {filteredGuides.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No guides found for this category.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredGuides.map((guide, index) => (
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
                            src={guide.coverImage}
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
                            {guide.summary}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {guide.readTime}
                              </span>
                            </div>
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </Link>
                    </motion.article>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Community Guides Tab ── */}
            <TabsContent value="community" className="mt-0">
              <CommunityGuidesGrid />
            </TabsContent>
          </Tabs>
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
