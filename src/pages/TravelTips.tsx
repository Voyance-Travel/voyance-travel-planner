import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Mail, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/config/routes';
import { toast } from 'sonner';

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

  return (
    <MainLayout>
      <Head
        title="Travel Tips | Voyance"
        description="Get weekly travel inspiration and destination guides delivered to your inbox."
      />
      
      <section className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-lg mx-auto text-center py-20">
          {!isSubscribed ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
                Want guides like these?
              </h1>
              
              <p className="text-muted-foreground mb-8">
                Weekly travel tips. No spam.
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
                  Browse Guides
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