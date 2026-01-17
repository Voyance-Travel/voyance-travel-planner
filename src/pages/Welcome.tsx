import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';

export default function Welcome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user hasn't completed quiz, redirect to quiz
    if (user && !user.quizCompleted) {
      // Allow them to see welcome briefly before quiz
    }
  }, [user]);

  return (
    <MainLayout showFooter={false}>
      <Head
        title="Welcome | Voyance"
        description="Welcome to Voyance. Let's get to know your travel style."
      />
      
      <section className="min-h-screen flex items-center justify-center pt-16 pb-8">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-8">
              <Sparkles className="w-10 h-10" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Welcome to Voyance{user?.name ? `, ${user.name}` : ''}!
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
              We're excited to help you plan your perfect trip. First, let's learn a bit about your travel style.
            </p>
            
            <div className="space-y-4">
              <Button asChild size="lg" className="gap-2">
                <Link to={ROUTES.QUIZ}>
                  Take the Travel Quiz
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              
              <p className="text-sm text-muted-foreground">
                Takes about 2 minutes
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
