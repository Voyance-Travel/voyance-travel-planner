import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, User, Compass } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  
  const isHome = location.pathname === '/';
  const isTransparent = isHome;

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
          <Link to="/" className="flex items-center gap-2 group">
            <Compass 
              className={`h-7 w-7 transition-colors ${
                isTransparent ? 'text-primary-foreground' : 'text-accent'
              }`} 
            />
            <span 
              className={`font-serif text-2xl font-semibold tracking-tight transition-colors ${
                isTransparent ? 'text-primary-foreground' : 'text-foreground'
              }`}
            >
              Voyance
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link 
              to="/explore" 
              className={`text-sm font-medium transition-colors hover:opacity-80 ${
                isTransparent ? 'text-primary-foreground/90' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Explore
            </Link>
            
            {isAuthenticated ? (
              <>
                <Link 
                  to="/profile" 
                  className={`text-sm font-medium transition-colors hover:opacity-80 ${
                    isTransparent ? 'text-primary-foreground/90' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  My Trips
                </Link>
                <Button 
                  variant={isTransparent ? 'heroOutline' : 'outline'} 
                  size="sm"
                  onClick={logout}
                  className={isTransparent ? 'border-primary-foreground/40 text-primary-foreground h-9 px-4 py-2' : ''}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Link to="/signin">
                <Button 
                  variant={isTransparent ? 'heroOutline' : 'default'} 
                  size="sm"
                  className={isTransparent ? 'border-primary-foreground/40 text-primary-foreground h-9 px-4 py-2' : ''}
                >
                  Sign In
                </Button>
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
              <Link 
                to="/explore" 
                className="text-foreground py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Explore
              </Link>
              {isAuthenticated ? (
                <>
                  <Link 
                    to="/profile" 
                    className="text-foreground py-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    My Trips
                  </Link>
                  <Button 
                    variant="outline" 
                    onClick={() => { logout(); setIsMenuOpen(false); }}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <Link to="/signin" onClick={() => setIsMenuOpen(false)}>
                  <Button className="w-full">Sign In</Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </nav>
    </header>
  );
}
