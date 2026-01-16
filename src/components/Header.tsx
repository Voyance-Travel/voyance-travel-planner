import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  
  const isHome = location.pathname === '/';
  const isTransparent = isHome;

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/explore', label: 'Explore' },
    { to: '/trip/new', label: 'Start Planning' },
    { to: '/profile', label: 'Profile' },
    { to: '/about', label: 'About Us' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isTransparent 
          ? 'bg-transparent' 
          : 'bg-background/95 backdrop-blur-md border-b border-border shadow-soft'
      }`}
    >
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="group">
            <span 
              className={`font-serif text-2xl font-semibold tracking-tight transition-colors ${
                isTransparent ? 'text-primary-foreground' : 'text-foreground'
              }`}
            >
              <span className="text-accent">V</span>oyance
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
            className={`md:hidden p-2 transition-colors ${
              isTransparent ? 'text-primary-foreground' : 'text-foreground'
            }`}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-medium"
          >
            <div className="container mx-auto px-6 py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link 
                  key={link.to}
                  to={link.to} 
                  className={`py-2 ${isActive(link.to) ? 'text-accent' : 'text-foreground'}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <button 
                  className="text-foreground py-2 text-left"
                  onClick={() => { logout(); setIsMenuOpen(false); }}
                >
                  Sign Out
                </button>
              ) : (
                <Link 
                  to="/signin" 
                  className="text-foreground py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </nav>
    </header>
  );
}
