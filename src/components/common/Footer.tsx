import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Send } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { VoyanceWordmark } from '@/components/common/VoyanceWordmark';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const footerLinks = {
  company: [
    { label: 'About', href: ROUTES.ABOUT },
    { label: 'How It Works', href: ROUTES.HOW_IT_WORKS },
    { label: 'Pricing', href: ROUTES.PRICING },
    { label: 'Careers', href: ROUTES.CAREERS },
    { label: 'Press', href: ROUTES.PRESS },
  ],
  explore: [
    { label: 'Destinations', href: ROUTES.DESTINATIONS },
    { label: 'Travel Guides', href: ROUTES.GUIDES },
    { label: 'Travel Quiz', href: ROUTES.QUIZ },
  ],
  support: [
    { label: 'Help Center', href: ROUTES.HELP_CENTER },
    { label: 'Contact Us', href: ROUTES.CONTACT },
    { label: 'FAQ', href: ROUTES.FAQ },
    { label: 'Privacy Policy', href: ROUTES.PRIVACY },
    { label: 'Terms of Service', href: ROUTES.TERMS },
  ],
};

const socialLinks = [
  { icon: Facebook, href: 'https://facebook.com/Voyance', label: 'Facebook' },
  { icon: Instagram, href: 'https://instagram.com/Voyancetravel', label: 'Instagram' },
  { icon: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ), href: 'https://x.com/Voyancetravel', label: 'X' },
  { icon: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  ), href: 'https://pinterest.com/Voyance', label: 'Pinterest' },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewsletterSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setIsSubmitting(true);
    // TODO: Integrate with email service
    await new Promise(resolve => setTimeout(resolve, 500));
    toast.success('Thanks! You\'ll receive personalized travel tips soon.');
    setEmail('');
    setIsSubmitting(false);
  };

  return (
    <footer className="bg-muted/30 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link to={ROUTES.HOME} className="flex items-center mb-4">
              <VoyanceWordmark size="md" />
            </Link>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Personalized travel experiences powered by AI
            </p>
            
            {/* Social Links */}
            <div className="flex gap-4">
              {socialLinks.map((social) => {
                const IconComponent = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={social.label}
                  >
                    <IconComponent className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Company Links */}
          <div>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Explore Links */}
          <div>
            <ul className="space-y-3">
              {footerLinks.explore.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter Signup */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <h4 className="text-sm font-medium mb-3">Get personalized travel tips</h4>
            <form onSubmit={handleNewsletterSignup} className="flex gap-2">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-sm flex-1"
                disabled={isSubmitting}
              />
              <Button 
                type="submit" 
                size="sm" 
                className="h-9 px-3"
                disabled={isSubmitting}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Weekly inspiration, no spam
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 Voyance LLC · Trademark Pending · Patents Pending
          </p>
          <div className="flex gap-6">
            <Link to={ROUTES.PRIVACY} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link to={ROUTES.TERMS} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link to={ROUTES.PRIVACY} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
