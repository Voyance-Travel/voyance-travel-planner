import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Compass, User, Info, Home, Sparkles, LogOut, LogIn } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AccessibilitySettingsPanel } from '@/components/common/AccessibilitySettingsPanel';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  
  const isHome = location.pathname === '/';
  const hasHeroImage = isHome || location.pathname.startsWith('/trip/') && location.pathname.includes('/itinerary');
  
  // Only transparent when at top of page AND on a hero page
  const isTransparent = hasHeroImage && !hasScrolled;

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu and reset scroll state on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setHasScrolled(window.scrollY > 20);
  }, [location.pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/explore', label: 'Explore', icon: Compass },
    // Only show Start Planning in nav for non-authenticated users
    ...(isAuthenticated ? [] : [{ to: '/start', label: 'Start Planning', icon: Sparkles }]),
    { to: '/profile', label: 'Profile', icon: User },
    { to: '/about', label: 'About Us', icon: Info },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <header 
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isTransparent 
            ? 'bg-transparent' 
            : 'bg-background/95 backdrop-blur-md border-b border-border shadow-soft'
        }`}
      >
        <nav className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="group relative z-[60]">
              <span 
                className={`font-serif text-xl sm:text-2xl font-semibold tracking-tight transition-colors ${
                  isTransparent && !isMenuOpen ? 'text-primary-foreground' : 'text-foreground'
                }`}
              >
                <span className={isTransparent && !isMenuOpen ? 'text-primary-foreground' : 'text-accent'}>V</span>oyance
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link 
                  key={link.to}
                  to={link.to} 
                  className={`text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? 'text-accent'
                      : isTransparent 
                        ? 'text-primary-foreground/90 hover:text-primary-foreground' 
                        : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              <AccessibilitySettingsPanel />

              {isAuthenticated ? (
                <button 
                  onClick={logout}
                  className={`text-sm font-medium transition-colors ${
                    isTransparent 
                      ? 'text-primary-foreground/90 hover:text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign Out
                </button>
              ) : (
                <Link 
                  to="/signin"
                  className={`text-sm font-medium transition-colors ${
                    isTransparent 
                      ? 'text-primary-foreground/90 hover:text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`md:hidden p-2 -mr-2 relative z-[60] transition-colors rounded-lg ${
                isMenuOpen 
                  ? 'text-foreground' 
                  : isTransparent 
                    ? 'text-primary-foreground' 
                    : 'text-foreground'
              }`}
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {isMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="h-6 w-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="h-6 w-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu - Full Screen Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            {/* Backdrop */}
            <motion.div 
              className="absolute inset-0 bg-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
            />
            
            {/* Menu Content */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="relative h-full flex flex-col pt-20 px-6 pb-8"
            >
              {/* Navigation Links */}
              <nav className="flex-1 flex flex-col gap-2">
                {navLinks.map((link, index) => {
                  const Icon = link.icon;
                  return (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                    >
                      <Link 
                        to={link.to} 
                        className={`flex items-center gap-4 py-4 px-4 rounded-xl transition-colors ${
                          isActive(link.to) 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-foreground hover:bg-muted'
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-lg font-medium">{link.label}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Auth Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="pt-6 border-t border-border"
              >
                {isAuthenticated ? (
                  <button 
                    className="flex items-center gap-4 w-full py-4 px-4 rounded-xl text-foreground hover:bg-muted transition-colors"
                    onClick={() => { logout(); setIsMenuOpen(false); }}
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="text-lg font-medium">Sign Out</span>
                  </button>
                ) : (
                  <Link 
                    to="/signin" 
                    className="flex items-center gap-4 w-full py-4 px-4 rounded-xl bg-primary text-primary-foreground"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <LogIn className="h-5 w-5" />
                    <span className="text-lg font-medium">Sign In</span>
                  </Link>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
