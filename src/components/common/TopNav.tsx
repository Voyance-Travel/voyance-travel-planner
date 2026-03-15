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
  Sparkles,
  Briefcase,
  Compass,
  Map,
  Users,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/common/NotificationBell';
import { VoyanceWordmark } from '@/components/common/VoyanceWordmark';
import { usePopupCoordination } from '@/stores/popup-coordination-store';

// Explore dropdown items
const exploreItems = [
  { href: ROUTES.EXPLORE, label: 'Browse Destinations', icon: Compass, description: 'Find your next adventure' },
  { href: ROUTES.DESTINATIONS, label: 'Featured Trips', icon: Map, description: 'Curated journeys by destination' },
  { href: ROUTES.ARCHETYPES, label: 'Travel Types', icon: Users, description: 'See all 29 traveler types' },
];

const navLinks = [
  { href: ROUTES.HOW_IT_WORKS, label: 'How It Works' },
  { href: ROUTES.PRICING, label: 'Pricing' },
  { href: ROUTES.ABOUT, label: 'About' },
];

const userMenuItems = [
  { href: ROUTES.PROFILE.VIEW, label: 'My Profile', icon: User, tourId: 'profile-link' },
  { href: ROUTES.TRIP.DASHBOARD, label: 'My Trips', icon: MapPin, tourId: 'my-trips' },
  { href: ROUTES.PROFILE.CREDITS, label: 'Credits & Billing', icon: Coins, tourId: undefined },
  { href: ROUTES.PROFILE.SETTINGS, label: 'Settings', icon: Settings, tourId: undefined },
];

const agentMenuItem = { href: ROUTES.AGENT.DASHBOARD, label: 'Agent Dashboard', icon: Briefcase };

export default function TopNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const exploreMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { activePopup } = usePopupCoordination();
  const isTourActive = activePopup === 'site_tour' || activePopup === 'itinerary_tour';

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
    setIsExploreOpen(false);
  }, [location.pathname]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (exploreMenuRef.current && !exploreMenuRef.current.contains(event.target as Node)) {
        setIsExploreOpen(false);
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
        className={`sticky top-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-300 ${
          isTransparent
            ? 'bg-gradient-to-b from-black/30 to-transparent'
            : 'bg-background/95 backdrop-blur-md border-b border-border shadow-sm'
        }`}
      >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to={ROUTES.HOME} className="flex items-center">
            <VoyanceWordmark variant={isTransparent ? 'light' : 'default'} size="md" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6">
            {/* Explore Dropdown */}
            <div className="relative" ref={exploreMenuRef} data-site-tour="explore-menu">
              <button
                onClick={() => setIsExploreOpen(!isExploreOpen)}
                className={`flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80 ${
                  isTransparent ? 'text-white/80' : 'text-muted-foreground'
                }`}
              >
                Explore
                <ChevronDown className={`h-4 w-4 transition-transform ${isExploreOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isExploreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-3 w-72 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
                  >
                    <div className="py-2">
                      {exploreItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors"
                            onClick={() => setIsExploreOpen(false)}
                          >
                            <Icon className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-foreground">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Other nav links */}
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

          {/* Desktop Auth Buttons / User Menu */}
          <div className="hidden lg:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Notification Bell */}
                <div data-site-tour="notifications" className={isTransparent ? '[&_button]:text-white [&_button]:hover:bg-white/10' : ''}>
                  <NotificationBell />
                </div>

                {/* Build My Itinerary - Primary CTA */}
                <Button
                  size="sm"
                  onClick={() => navigate(ROUTES.START)}
                  data-site-tour="build-cta"
                  className={`gap-2 ${isTransparent ? 'bg-white text-foreground hover:bg-white/90' : ''}`}
                >
                  Build My Itinerary
                </Button>

                {/* User Dropdown */}
                <div className="relative" ref={userMenuRef} data-site-tour="profile">
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

                        {/* Agent Dashboard Link - shown first if agent mode enabled */}
                        {user?.travelAgentMode && (
                          <div className="py-2 border-b border-border">
                            <Link
                              to={agentMenuItem.href}
                              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                location.pathname.startsWith('/agent')
                                  ? 'bg-primary/10 text-primary font-medium' 
                                  : 'text-foreground hover:bg-muted'
                              }`}
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              <Briefcase className="h-4 w-4 text-primary" />
                              {agentMenuItem.label}
                            </Link>
                          </div>
                        )}

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
                {/* Build My Itinerary Button */}
                <Button
                  size="sm"
                  onClick={() => navigate(ROUTES.START)}
                  className={`gap-2 ${isTransparent ? 'bg-white text-foreground hover:bg-white/90' : ''}`}
                >
                  Build My Itinerary
                </Button>

                <Link
                  to={ROUTES.SIGNIN}
                  className={`text-sm font-medium transition-colors ${
                    isTransparent ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => { if (!isTourActive) setIsMenuOpen(!isMenuOpen); }}
            className={`lg:hidden p-2 transition-colors ${
              isTourActive ? 'opacity-30 cursor-not-allowed' : ''
            } ${
              isTransparent ? 'text-white' : 'text-foreground'
            }`}
            aria-label="Toggle menu"
            disabled={isTourActive}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence mode="wait">
        {isMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
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

              {/* Explore Section */}
              <div className="pb-3 mb-3 border-b border-border">
                <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Explore
                </p>
                {exploreItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                        location.pathname === item.href
                          ? 'bg-accent/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>

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
                    {user?.travelAgentMode && (
                      <Link
                        to={agentMenuItem.href}
                        className={`flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                          location.pathname.startsWith('/agent')
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <Briefcase className="h-4 w-4 text-primary" />
                        {agentMenuItem.label}
                      </Link>
                    )}
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
                        className="w-full"
                        onClick={() => navigate(ROUTES.START)}
                      >
                        Build My Itinerary
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
                    <div className="mb-4">
                      <Button
                        className="w-full"
                        onClick={() => navigate(ROUTES.START)}
                      >
                        Build My Itinerary
                      </Button>
                    </div>
                    <Link
                      to={ROUTES.SIGNIN}
                      className="block py-2.5 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors text-center"
                    >
                      Already have an account? Sign In
                    </Link>
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
