import MainLayout from '@/components/layout/MainLayout';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { 
  Search, 
  Compass, 
  CreditCard, 
  User, 
  Map, 
  ChevronRight,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CONTACT_CONFIG } from '@/config/contact';
import { ROUTES } from '@/config/routes';

// Define routes for each article
const articleRoutes: Record<string, string> = {
  // Getting Started
  'create-account': ROUTES.SIGNUP,
  'travel-dna-quiz': ROUTES.QUIZ,
  'profile-guide': ROUTES.PROFILE.VIEW,
  'browse-destinations': ROUTES.DESTINATIONS,
  // Trip Planning
  'first-itinerary': ROUTES.START,
  'customize-activities': ROUTES.PLANNER.ITINERARY,
  'add-companions': ROUTES.START,
  'share-trips': ROUTES.TRIP.DASHBOARD,
  // Booking & Payments
  'booking-guide': ROUTES.HOW_IT_WORKS,
  'payment-methods': ROUTES.FAQ,
  'cancellations': ROUTES.FAQ,
  'refunds': ROUTES.CONTACT,
  // Account Settings
  'edit-profile': ROUTES.PROFILE.EDIT,
  'retake-quiz': ROUTES.QUIZ,
  'notifications': ROUTES.PROFILE.SETTINGS,
  'delete-account': ROUTES.CONTACT,
};

const helpCategories = [
  {
    icon: Compass,
    title: 'Getting Started',
    description: 'Set up your account and take your first steps',
    articles: [
      { title: 'Creating your account', slug: 'create-account' },
      { title: 'Taking the Travel DNA quiz', slug: 'travel-dna-quiz' },
      { title: 'Understanding your profile', slug: 'profile-guide' },
      { title: 'Browsing destinations', slug: 'browse-destinations' },
    ],
  },
  {
    icon: Map,
    title: 'Trip Planning',
    description: 'Build and customize your perfect itinerary',
    articles: [
      { title: 'Generating your first itinerary', slug: 'first-itinerary' },
      { title: 'Customizing activities', slug: 'customize-activities' },
      { title: 'Adding travel companions', slug: 'add-companions' },
      { title: 'Saving and sharing trips', slug: 'share-trips' },
    ],
  },
  {
    icon: CreditCard,
    title: 'Booking & Payments',
    description: 'Complete your reservations with confidence',
    articles: [
      { title: 'How booking works', slug: 'booking-guide' },
      { title: 'Accepted payment methods', slug: 'payment-methods' },
      { title: 'Cancellation policy', slug: 'cancellations' },
      { title: 'Requesting a refund', slug: 'refunds' },
    ],
  },
  {
    icon: User,
    title: 'Account Settings',
    description: 'Manage your preferences and profile',
    articles: [
      { title: 'Editing your profile', slug: 'edit-profile' },
      { title: 'Retaking the quiz', slug: 'retake-quiz' },
      { title: 'Notification settings', slug: 'notifications' },
      { title: 'Deleting your account', slug: 'delete-account' },
    ],
  },
];

const quickAnswers = [
  { 
    question: 'How do I change my itinerary after booking?', 
    answer: 'You can modify most activities up to 48 hours before your trip starts. Go to your Trip Dashboard, select the trip, and click on any activity to make changes.'
  },
  { 
    question: 'Is my payment information secure?', 
    answer: 'Yes, we use industry-standard encryption and never store full card details. All payments are processed through secure, PCI-compliant payment processors.'
  },
  { 
    question: 'Can I plan a trip for a group?', 
    answer: 'Absolutely! Add companions during planning and share the itinerary with them. Each person can view the trip details and make suggestions.'
  },
  { 
    question: 'How does the Travel DNA quiz work?', 
    answer: 'Our quiz takes about 5 minutes and asks about your travel preferences, budget, interests, and style. We use this to personalize all your recommendations.'
  },
  { 
    question: 'Can I retake the quiz?', 
    answer: 'Yes! You can retake the Travel DNA quiz anytime from your profile settings. Your preferences will be updated based on your new answers.'
  },
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const navigate = useNavigate();

  const q = searchQuery.toLowerCase().trim();

  const filteredCategories = q
    ? helpCategories.map(cat => ({
        ...cat,
        articles: cat.articles.filter(a => a.title.toLowerCase().includes(q)),
      })).filter(cat => cat.articles.length > 0 || cat.title.toLowerCase().includes(q) || cat.description.toLowerCase().includes(q))
    : helpCategories;

  const filteredFaqs = q
    ? quickAnswers.filter(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))
    : quickAnswers;

  const handleArticleClick = (slug: string) => {
    const route = articleRoutes[slug];
    if (route) {
      navigate(route);
    }
  };

  const handleCategoryViewAll = (categoryTitle: string) => {
    // Navigate to relevant section based on category
    switch (categoryTitle) {
      case 'Getting Started':
        navigate(ROUTES.HOW_IT_WORKS);
        break;
      case 'Trip Planning':
        navigate(ROUTES.START);
        break;
      case 'Booking & Payments':
        navigate(ROUTES.FAQ);
        break;
      case 'Account Settings':
        navigate(ROUTES.PROFILE.VIEW);
        break;
      default:
        navigate(ROUTES.FAQ);
    }
  };

  return (
    <MainLayout>
      <Head
        title="Help Center | Voyance"
        description="Get help with Voyance. Find answers, tutorials, and support for your travel planning needs."
      />
      
      {/* Hero */}
      <section className="relative pt-20 pb-24 overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={toSiteImageUrlFromPhotoId('photo-1469474968028-56623f02e42e')}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
              How can we help you?
            </h1>
            <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
              Find answers, explore guides, or reach out to our team
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
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg rounded-xl bg-white shadow-lg border-0"
            />
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 -mt-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={category.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-lg transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{category.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                  <ul className="space-y-2">
                    {category.articles.slice(0, 3).map((article) => (
                      <li key={article.slug}>
                        <button 
                          onClick={() => handleArticleClick(article.slug)}
                          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 group/item w-full text-left transition-colors"
                        >
                          <ChevronRight className="h-3 w-3 group-hover/item:translate-x-0.5 transition-transform" />
                          {article.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={() => handleCategoryViewAll(category.title)}
                    className="mt-4 text-sm text-primary font-medium flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    View all
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              );
            })}
          </div>
          {q && filteredCategories.length === 0 && filteredFaqs.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-lg font-medium text-muted-foreground">No results for "{searchQuery}"</p>
              <p className="text-sm text-muted-foreground mt-1">Try different keywords or <Link to="/contact" className="text-primary hover:underline">contact us</Link></p>
            </div>
          )}
        </div>
      </section>

      {/* Quick Answers */}
      {filteredFaqs.length > 0 && (
      <section className="py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-display font-bold">Quick Answers</h2>
          </div>
          
          <div className="space-y-3">
            {filteredFaqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium pr-4">{faq.question}</span>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${expandedFaq === index ? 'rotate-90' : ''}`} />
                </button>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="px-5 pb-5"
                  >
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Contact CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="relative rounded-2xl overflow-hidden">
            <img 
              src={toSiteImageUrlFromPhotoId('photo-1507525428034-b723cf961d3e')}
              alt=""
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/40 flex items-center">
              <div className="px-8 md:px-12">
                <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-3">
                  Still have questions?
                </h2>
                <p className="text-white/80 mb-6 max-w-md">
                  Our team is ready to help. Reach out and we'll get back to you within {CONTACT_CONFIG.RESPONSE_TIME}.
                </p>
                <Button size="lg" asChild>
                  <Link to="/contact" className="gap-2">
                    Contact Us
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
