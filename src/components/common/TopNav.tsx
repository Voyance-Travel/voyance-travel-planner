import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  X, 
  User, 
  MapPin, 
  Settings, 
  LogOut,
  ChevronDown,
  Plane
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/common/NotificationBell';

// Elegant V logo component - adapts to transparent/solid nav states
const VoyanceLogo = ({ isTransparent }: { isTransparent: boolean }) => (
  <span 
    className={`font-serif text-2xl font-semibold leading-none transition-colors ${
      isTransparent ? 'text-white' : 'text-primary'
    }`}
    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
  >
    V
  </span>
);

const navLinks = [
  { href: ROUTES.START, label: 'Start Planning', highlight: true },
  { href: ROUTES.EXPLORE, label: 'Explore' },
  { href: ROUTES.DESTINATIONS, label: 'Destinations' },
  { href: ROUTES.HOW_IT_WORKS, label: 'How It Works' },
];

const userMenuItems = [
  { href: ROUTES.PROFILE.VIEW, label: 'My Profile', icon: User },
  { href: ROUTES.TRIP.DASHBOARD, label: 'My Trips', icon: MapPin },
  { href: ROUTES.PROFILE.SETTINGS, label: 'Settings', icon: Settings },
];

export default function TopNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
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

  // Close menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine if nav should be transparent (only on home page, not scrolled)
  const isTransparent = location.pathname === '/' && !hasScrolled && !isMenuOpen;

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    navigate(ROUTES.HOME);
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    return names.length > 1 
      ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      : names[0][0].toUpperCase();
  };

  return (
    <>
      {/* Fixed gradient backdrop for hero pages - ensures header text is always readable */}
      {location.pathname === '/' && !hasScrolled && (
        <div className="fixed top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/50 via-black/25 to-transparent z-40 pointer-events-none" />
      )}
      
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
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
            className={`flex items-center gap-2.5 font-display text-xl font-semibold transition-colors ${
              isTransparent ? 'text-white' : 'text-foreground'
            }`}
          >
            <VoyanceLogo isTransparent={isTransparent} />
            <span>Voyance</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm font-medium transition-colors hover:opacity-80 ${
                  link.highlight
                    ? isTransparent
                      ? 'text-white font-semibold'
                      : 'text-primary font-semibold'
                    : location.pathname === link.href
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

          {/* Desktop Auth Buttons / User Menu */}
          <div className="hidden lg:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {/* Notification Bell */}
                <div className={isTransparent ? '[&_button]:text-white [&_button]:hover:bg-white/10' : ''}>
                  <NotificationBell />
                </div>

                <Button
                  variant={isTransparent ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => navigate(ROUTES.START)}
                  className={`gap-2 ${isTransparent ? 'border-white text-white hover:bg-white/10' : ''}`}
                >
                  <Plane className="h-4 w-4" />
                  Plan a Trip
                </Button>

                {/* User Dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-full transition-colors ${
                      isTransparent 
                        ? 'hover:bg-white/10' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isTransparent 
                        ? 'bg-white/20 text-white' 
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {user?.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getUserInitials()
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    } ${isTransparent ? 'text-white/80' : 'text-muted-foreground'}`} />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
                      >
                        {/* User Info Header */}
                        <div className="px-4 py-3 bg-muted/50 border-b border-border">
                          <p className="text-sm font-medium text-foreground truncate">
                            {user?.name || 'User'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user?.email}
                          </p>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                          {userMenuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.href;
                            return (
                              <Link
                                key={item.href}
                                to={item.href}
                                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                  isActive 
                                    ? 'bg-accent/10 text-accent-foreground font-medium' 
                                    : 'text-foreground hover:bg-muted'
                                }`}
                                onClick={() => setIsUserMenuOpen(false)}
                              >
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>

                        {/* Logout */}
                        <div className="py-2 border-t border-border">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
            <div className="px-4 py-4 space-y-1">
              {/* User Info (if authenticated) */}
              {isAuthenticated && user && (
                <div className="pb-4 mb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getUserInitials()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.name || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Nav Links */}
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`block py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === link.href
                      ? 'bg-accent/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="pt-4 border-t border-border space-y-1">
                {isAuthenticated ? (
                  <>
                    {userMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                    <div className="pt-2">
                      <Button
                        className="w-full gap-2"
                        onClick={() => navigate(ROUTES.START)}
                      >
                        <Plane className="h-4 w-4" />
                        Plan a Trip
                      </Button>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full py-2.5 px-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to={ROUTES.SIGNIN}
                      className="block py-2.5 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Sign In
                    </Link>
                    <Button
                      className="w-full mt-2"
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
    </>
  );
}
