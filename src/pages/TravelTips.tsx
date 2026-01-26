import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Mail, Sparkles, MapPin, Compass, Sun, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/config/routes';
import { toast } from 'sonner';
import { guides } from '@/data/guides';

const benefits = [
  'Weekly destination inspiration',
  'Insider tips from real travelers',
  'Seasonal travel recommendations',
  'Budget-saving strategies',
  'Hidden gems and local favorites',
  'First access to new features',
];

export default function TravelTips() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Get travel tips guides for preview
  const travelTipsGuides = guides
    .filter(g => g.category === 'Travel Tips' || g.tags?.includes('tips'))
    .slice(0, 3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setIsSubmitting(true);
    // TODO: Integrate with email service
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSubscribed(true);
    toast.success('Welcome! Check your inbox for a confirmation.');
    setIsSubmitting(false);
  };

  return (
    <MainLayout>
      <Head
        title="Travel Tips | Voyance"
        description="Get weekly travel inspiration, insider tips, and destination guides delivered to your inbox. No spam, just wanderlust."
      />
      
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background" />
        </div>
        
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary font-medium mb-8"
          >
            <Mail className="h-4 w-4" />
            Free Weekly Newsletter
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-6 leading-tight"
          >
            Travel tips that actually help
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-xl mx-auto mb-10"
          >
            Weekly inspiration, insider knowledge, and destination guides. 
            Curated for curious travelers. No spam, ever.
          </motion.p>

          {/* Signup Form */}
          {!isSubscribed ? (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onSubmit={handleSubmit}
              className="max-w-md mx-auto"
            >
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base bg-background/80 backdrop-blur-sm"
                  disabled={isSubmitting}
                />
                <Button 
                  type="submit" 
                  size="lg"
                  className="h-12 px-6"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Subscribing...' : 'Subscribe'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Join 10,000+ travelers. Unsubscribe anytime.
              </p>
            </motion.form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-8"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">You're in!</h3>
              <p className="text-muted-foreground mb-6">
                Check your inbox for a welcome email with our best travel tips.
              </p>
              <Button asChild variant="outline">
                <Link to={ROUTES.GUIDES}>
                  Browse Travel Guides
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          )}
        </div>
      </section>

      {/* What You'll Get */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              What you'll get
            </h2>
            <p className="text-lg text-muted-foreground">
              Every Tuesday, straight to your inbox
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 bg-card border border-border rounded-xl p-5"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <span className="text-foreground font-medium">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Content Preview */}
      {travelTipsGuides.length > 0 && (
        <section className="py-24">
          <div className="max-w-6xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
                A taste of what we share
              </h2>
              <p className="text-lg text-muted-foreground">
                Recent guides from our travel experts
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {travelTipsGuides.map((guide, index) => (
                <motion.article
                  key={guide.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group"
                >
                  <Link to={`/guides/${guide.slug}`}>
                    <div className="aspect-[16/10] rounded-xl overflow-hidden mb-4">
                      <img
                        src={guide.coverImage}
                        alt={guide.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                      {guide.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {guide.summary}
                    </p>
                  </Link>
                </motion.article>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button asChild variant="outline" size="lg">
                <Link to={ROUTES.GUIDES}>
                  View All Guides
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Sun className="h-12 w-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              Ready for your next adventure?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Start planning your personalized trip today
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link to={ROUTES.QUIZ}>
                  Take the Quiz
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8">
                <Link to={ROUTES.EXPLORE}>Explore Destinations</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
