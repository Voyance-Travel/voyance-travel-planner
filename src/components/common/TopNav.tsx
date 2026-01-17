import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { Button } from '@/components/ui/button';

const navLinks = [
  { href: ROUTES.EXPLORE, label: 'Explore' },
  { href: ROUTES.DESTINATIONS, label: 'Destinations' },
  { href: ROUTES.ABOUT, label: 'About' },
  { href: ROUTES.HOW_IT_WORKS, label: 'How It Works' },
];

export default function TopNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Determine if nav should be transparent (only on home page, not scrolled)
  const isTransparent = location.pathname === '/' && !hasScrolled && !isMenuOpen;

  const handleLogout = () => {
    logout();
    navigate(ROUTES.HOME);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isTransparent
          ? 'bg-transparent'
          : 'bg-background/95 backdrop-blur-md border-b border-border shadow-sm'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link
            to={ROUTES.HOME}
            className={`flex items-center gap-2 font-display text-xl font-semibold transition-colors ${
              isTransparent ? 'text-white' : 'text-foreground'
            }`}
          >
            <Compass className="h-6 w-6" />
            <span>Voyance</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm font-medium transition-colors hover:opacity-80 ${
                  location.pathname === link.href
                    ? isTransparent
                      ? 'text-white'
                      : 'text-primary'
                    : isTransparent
                    ? 'text-white/80'
                    : 'text-muted-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  to={ROUTES.PROFILE.VIEW}
                  className={`text-sm font-medium transition-colors ${
                    isTransparent ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {user?.name || 'Profile'}
                </Link>
                <Button
                  variant={isTransparent ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => navigate(ROUTES.START)}
                  className={isTransparent ? 'border-white text-white hover:bg-white/10' : ''}
                >
                  Plan a Trip
                </Button>
                <button
                  onClick={handleLogout}
                  className={`text-sm font-medium transition-colors ${
                    isTransparent ? 'text-white/60 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to={ROUTES.SIGNIN}
                  className={`text-sm font-medium transition-colors ${
                    isTransparent ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign In
                </Link>
                <Button
                  variant={isTransparent ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => navigate(ROUTES.SIGNUP)}
                  className={isTransparent ? 'border-white text-white hover:bg-white/10' : ''}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`lg:hidden p-2 transition-colors ${
              isTransparent ? 'text-white' : 'text-foreground'
            }`}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-b border-border"
          >
            <div className="px-4 py-4 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`block py-2 text-sm font-medium transition-colors ${
                    location.pathname === link.href
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="pt-4 border-t border-border space-y-2">
                {isAuthenticated ? (
                  <>
                    <Link
                      to={ROUTES.PROFILE.VIEW}
                      className="block py-2 text-sm font-medium text-muted-foreground"
                    >
                      Profile
                    </Link>
                    <Button
                      className="w-full"
                      onClick={() => navigate(ROUTES.START)}
                    >
                      Plan a Trip
                    </Button>
                    <button
                      onClick={handleLogout}
                      className="block w-full py-2 text-sm font-medium text-muted-foreground text-left"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to={ROUTES.SIGNIN}
                      className="block py-2 text-sm font-medium text-muted-foreground"
                    >
                      Sign In
                    </Link>
                    <Button
                      className="w-full"
                      onClick={() => navigate(ROUTES.SIGNUP)}
                    >
                      Get Started
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
