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
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const CONTACT_EMAIL = 'hello@voyance.travel';

const helpCategories = [
  {
    icon: BookOpen,
    title: 'Getting Started',
    description: 'Learn the basics of using Voyance',
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
    description: 'Plan and customize your trips',
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
    description: 'Manage bookings and payments',
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
    description: 'Manage your account settings',
    articles: [
      'Updating your profile',
      'Retaking the quiz',
      'Notification preferences',
      'Deleting your account',
    ],
  },
];

const popularArticles = [
  { title: 'How to book a complete trip', category: 'Booking' },
  { title: 'Understanding your Travel DNA results', category: 'Profile' },
  { title: 'Customizing your generated itinerary', category: 'Trips' },
  { title: 'Sharing trips with travel companions', category: 'Trips' },
  { title: 'Cancellation and refund policies', category: 'Booking' },
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
      <section className="pt-24 pb-16 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
          >
            How Can We Help?
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            Find answers, tutorials, and support for all your Voyance questions
          </motion.p>
          
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
              className="pl-12 h-14 text-lg rounded-xl"
            />
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-semibold text-center mb-8">Browse by Category</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {helpCategories.map((category, index) => (
              <motion.div
                key={category.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                  <category.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{category.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                <ul className="space-y-2">
                  {category.articles.slice(0, 3).map((article, i) => (
                    <li key={i} className="text-sm text-muted-foreground hover:text-primary cursor-pointer flex items-center gap-1">
                      <ChevronRight className="h-3 w-3" />
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
          <h2 className="text-2xl font-semibold text-center mb-8">Popular Articles</h2>
          <div className="space-y-3">
            {popularArticles.map((article, index) => (
              <motion.div
                key={article.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/50 cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{article.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {article.category}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-2xl font-semibold mb-4">Can't Find What You're Looking For?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Our support team is available to help you with any questions or issues.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/contact" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Contact Support
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={`mailto:${CONTACT_EMAIL}`} className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email Us
                </a>
              </Button>
            </div>
          </div>
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
