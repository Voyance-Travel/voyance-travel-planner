import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Mail, CheckCircle, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/config/routes';
import { toast } from 'sonner';
import { guides } from '@/data/guides';

export default function TravelTips() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSubscribed(true);
    toast.success('Welcome! Check your inbox for a confirmation.');
    setIsSubmitting(false);
  };

  // Get featured guides for the photo book
  const displayGuides = guides.filter(g => g.featured).slice(0, 6);
  const remainingGuides = guides.filter(g => !displayGuides.includes(g)).slice(0, 3);
  const allDisplayGuides = [...displayGuides, ...remainingGuides].slice(0, 6);

  return (
    <MainLayout>
      <Head
        title="Travel Tips | Voyance"
        description="Get weekly travel inspiration and destination guides delivered to your inbox."
      />
      
      {/* Photo Book Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              Travel Guides
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Curated insights for curious travelers
            </p>
          </motion.div>

          {/* Photo Book Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-16">
            {allDisplayGuides.map((guide, index) => (
              <motion.div
                key={guide.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <Link 
                  to={`/guides/${guide.slug}`}
                  className="block relative aspect-[4/5] rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                >
                  <img
                    src={guide.coverImage}
                    alt={guide.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* Content overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded text-[10px] text-white/90 font-medium mb-2">
                      {guide.category}
                    </span>
                    <h3 className="text-white font-semibold text-sm md:text-base leading-tight line-clamp-2 mb-1">
                      {guide.title}
                    </h3>
                    <div className="flex items-center gap-1 text-white/70 text-xs">
                      <Clock className="h-3 w-3" />
                      {guide.readTime}
                    </div>
                  </div>

                  {/* Hover indicator */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="h-4 w-4 text-white" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* View All Link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mb-20"
          >
            <Button asChild variant="outline" size="lg">
              <Link to={ROUTES.GUIDES}>
                View All Guides
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Email Signup Section */}
      <section className="py-16 px-4 bg-muted/30 border-y border-border">
        <div className="max-w-lg mx-auto text-center">
          {!isSubscribed ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
                Want guides like these?
              </h2>
              
              <p className="text-muted-foreground mb-8">
                Weekly travel tips delivered to your inbox. No spam.
              </p>

              <form onSubmit={handleSubmit} className="max-w-sm mx-auto">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    disabled={isSubmitting}
                  />
                  <Button 
                    type="submit" 
                    className="h-11 px-5"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '...' : 'Subscribe'}
                  </Button>
                </div>
              </form>
              
              <p className="text-xs text-muted-foreground mt-4">
                Unsubscribe anytime
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-7 w-7 text-emerald-600" />
              </div>
              
              <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
                You're in!
              </h2>
              
              <p className="text-muted-foreground mb-8">
                Check your inbox for a welcome email.
              </p>
              
              <Button asChild variant="outline">
                <Link to={ROUTES.GUIDES}>
                  Browse More Guides
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          )}
        </div>
      </section>
    </MainLayout>
  );
}