import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { 
  Search, 
  BookOpen, 
  CreditCard, 
  User, 
  Map, 
  HelpCircle, 
  Mail,
  MessageSquare,
  ChevronRight,
  Compass,
  Heart,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CONTACT_CONFIG } from '@/config/contact';

const helpCategories = [
  {
    icon: Compass,
    title: 'Getting Started',
    description: 'Begin your Voyance journey',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    articles: [
      'Creating your account',
      'Taking the Travel DNA quiz',
      'Understanding your travel profile',
      'Exploring destinations',
    ],
  },
  {
    icon: Map,
    title: 'Trip Planning',
    description: 'Create your perfect itinerary',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    articles: [
      'Generating your first itinerary',
      'Customizing activities',
      'Adding travel companions',
      'Saving and sharing trips',
    ],
  },
  {
    icon: CreditCard,
    title: 'Booking & Payments',
    description: 'Manage reservations',
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    articles: [
      'Making a booking',
      'Payment methods',
      'Cancellation policy',
      'Refund requests',
    ],
  },
  {
    icon: User,
    title: 'Account & Profile',
    description: 'Your settings & preferences',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    articles: [
      'Updating your profile',
      'Retaking the quiz',
      'Notification preferences',
      'Deleting your account',
    ],
  },
];

const popularArticles = [
  { title: 'How to book a complete trip', category: 'Booking', icon: CreditCard },
  { title: 'Understanding your Travel DNA results', category: 'Profile', icon: Heart },
  { title: 'Customizing your generated itinerary', category: 'Trips', icon: Map },
  { title: 'Sharing trips with travel companions', category: 'Trips', icon: User },
  { title: 'Cancellation and refund policies', category: 'Booking', icon: BookOpen },
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <MainLayout>
      <Head
        title="Help Center | Voyance"
        description="Get help with Voyance. Find answers, tutorials, and support for your travel planning needs."
      />
      
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              How Can We Help?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Find answers, tutorials, and support for all your Voyance questions
            </p>
          </motion.div>
          
          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-lg mx-auto relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg rounded-xl border-2 focus:border-primary"
            />
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-display font-bold text-center mb-10">Browse by Category</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {helpCategories.map((category, index) => (
              <motion.div
                key={category.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-xl ${category.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <category.icon className={`h-6 w-6 ${category.color}`} />
                </div>
                <h3 className="font-semibold text-lg mb-1">{category.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                <ul className="space-y-2">
                  {category.articles.slice(0, 3).map((article, i) => (
                    <li key={i} className="text-sm text-muted-foreground hover:text-primary cursor-pointer flex items-center gap-1 group/item">
                      <ChevronRight className="h-3 w-3 group-hover/item:translate-x-0.5 transition-transform" />
                      {article}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-10">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-display font-bold">Popular Articles</h2>
          </div>
          <div className="space-y-3">
            {popularArticles.map((article, index) => (
              <motion.div
                key={article.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/50 hover:shadow-md cursor-pointer group transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <article.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-medium group-hover:text-primary transition-colors">{article.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full hidden sm:block">
                    {article.category}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-8 md:p-12 text-center border border-primary/20"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-4">Still Need Help?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Our support team is here to help you with any questions or issues you might have.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/contact" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Contact Support
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={`mailto:${CONTACT_CONFIG.SUPPORT_EMAIL}`} className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email Us
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-8 border-t border-border">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">
              FAQ
            </Link>
            <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">
              Contact Us
            </Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}