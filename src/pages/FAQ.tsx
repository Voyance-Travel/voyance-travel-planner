import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { ChevronDown, Search, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link } from 'react-router-dom';

const CONTACT_EMAIL = 'hello@voyance.travel';

const faqCategories = [
  {
    id: 'general',
    title: 'General',
    questions: [
      {
        q: 'What is Voyance?',
        a: 'Voyance is an AI-powered travel planning platform that creates personalized itineraries based on your unique preferences, travel style, and interests. We handle everything from flights and hotels to daily activities, so you can focus on enjoying your trip.',
      },
      {
        q: 'How does Voyance personalize my trip?',
        a: 'When you take our Travel DNA quiz, we learn about your travel style, pace preferences, interests, budget, and more. Our AI uses this information to curate destinations, activities, and accommodations that match your unique profile.',
      },
      {
        q: 'Is Voyance free to use?',
        a: 'Voyance offers a free tier that includes access to our Travel DNA quiz and destination exploration. Premium features like full itinerary generation, booking assistance, and trip management are available with a subscription.',
      },
      {
        q: 'What destinations does Voyance support?',
        a: 'We currently support thousands of destinations worldwide, from major cities to hidden gems. Our destination database is constantly growing as we add new locations and experiences.',
      },
    ],
  },
  {
    id: 'booking',
    title: 'Booking & Payments',
    questions: [
      {
        q: 'How do I book a trip through Voyance?',
        a: 'After generating your personalized itinerary, you can review and customize each element. Once satisfied, proceed to checkout where you can book flights, hotels, and activities in one seamless transaction.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit cards (Visa, Mastercard, American Express), debit cards, and select digital payment methods. All payments are processed securely through Stripe.',
      },
      {
        q: 'Can I cancel or modify my booking?',
        a: 'Cancellation and modification policies vary by booking type and provider. Generally, you can modify or cancel bookings up to 48 hours before the scheduled date. Check your booking confirmation for specific terms.',
      },
      {
        q: 'Is my payment information secure?',
        a: 'Absolutely. We use industry-standard SSL encryption and never store your full payment details. All transactions are processed through PCI-compliant payment providers.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & Profile',
    questions: [
      {
        q: 'How do I create an account?',
        a: 'Click "Sign Up" on our homepage and enter your email address. You can also sign up using your Google account for faster access. Complete the Travel DNA quiz to get personalized recommendations.',
      },
      {
        q: 'Can I retake the Travel DNA quiz?',
        a: 'Yes! Your travel preferences may evolve over time. You can retake the quiz anytime from your profile settings to update your Travel DNA and get fresh recommendations.',
      },
      {
        q: 'How do I update my profile information?',
        a: 'Navigate to your Profile page and click "Edit Profile" to update your personal information, travel preferences, and notification settings.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes, you can delete your account from the Settings page. Please note this action is permanent and will remove all your saved trips, preferences, and booking history.',
      },
    ],
  },
  {
    id: 'trips',
    title: 'Trip Planning',
    questions: [
      {
        q: 'How long does it take to generate an itinerary?',
        a: 'Our AI typically generates a complete, personalized itinerary within 30-60 seconds. More complex trips with multiple destinations may take slightly longer.',
      },
      {
        q: 'Can I customize my generated itinerary?',
        a: 'Absolutely! Every generated itinerary is fully customizable. You can swap activities, change restaurants, adjust timing, and add your own discoveries.',
      },
      {
        q: 'Can I share my trip with friends or family?',
        a: 'Yes! Each trip has a unique sharing link that lets you invite collaborators. They can view the itinerary and even contribute suggestions.',
      },
      {
        q: 'What if my plans change during the trip?',
        a: 'Your Voyance itinerary is accessible on any device. You can make real-time adjustments, and we\'ll help you find alternatives for any changes in your plans.',
      },
    ],
  },
];

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('general');

  const filteredFAQs = faqCategories.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => 
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(category => category.questions.length > 0);

  return (
    <MainLayout>
      <Head
        title="FAQ | Voyance"
        description="Find answers to frequently asked questions about Voyance travel planning."
      />
      
      {/* Hero */}
      <section className="pt-24 pb-12 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
          >
            Frequently Asked Questions
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            Everything you need to know about Voyance
          </motion.p>
          
          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md mx-auto relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </motion.div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {faqCategories.map(category => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
              >
                {category.title}
              </Button>
            ))}
          </div>

          {/* Questions */}
          {(searchQuery ? filteredFAQs : faqCategories.filter(c => c.id === activeCategory)).map(category => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8"
            >
              {searchQuery && (
                <h2 className="text-xl font-semibold mb-4">{category.title}</h2>
              )}
              <Accordion type="single" collapsible className="space-y-3">
                {category.questions.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`${category.id}-${index}`}
                    className="bg-card border border-border rounded-xl px-6"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <span className="text-left font-medium">{faq.q}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          ))}

          {searchQuery && filteredFAQs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No questions found matching "{searchQuery}"
            </div>
          )}
        </div>
      </section>

      {/* Still Need Help */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-semibold mb-4">Still Have Questions?</h2>
          <p className="text-muted-foreground mb-6">
            Can't find the answer you're looking for? Our team is here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link to="/contact">Contact Us</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={`mailto:${CONTACT_EMAIL}`} className="gap-2">
                <Mail className="h-4 w-4" />
                {CONTACT_EMAIL}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
