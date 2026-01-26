import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Sparkles, 
  Users, 
  UsersRound, 
  Map, 
  Rocket,
  ChevronRight
} from 'lucide-react';

interface NavSection {
  id: string;
  label: string;
  icon: typeof Sparkles;
}

const SECTIONS: NavSection[] = [
  { id: 'hero', label: 'Welcome', icon: Sparkles },
  { id: 'archetype-comparison', label: 'Personalization', icon: Users },
  { id: 'group-blend', label: 'Group Travel', icon: UsersRound },
  { id: 'playground', label: 'Explore Itinerary', icon: Map },
  { id: 'cta', label: 'Get Started', icon: Rocket },
];

interface DemoSideNavProps {
  showTour: boolean;
}

export function DemoSideNav({ showTour }: DemoSideNavProps) {
  const [activeSection, setActiveSection] = useState('hero');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;

      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const section = document.getElementById(SECTIONS[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Hide during tour
  if (showTour) return null;

  return (
    <motion.nav
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden lg:block"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className={cn(
        "bg-card/95 backdrop-blur-sm border rounded-2xl shadow-lg transition-all duration-300",
        isExpanded ? "w-52" : "w-14"
      )}>
        <div className="py-3">
          {SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 relative",
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                  />
                )}
                
                <Icon className={cn(
                  "h-5 w-5 shrink-0 transition-transform duration-200",
                  isActive && "scale-110"
                )} />
                
                <motion.span
                  initial={false}
                  animate={{ 
                    opacity: isExpanded ? 1 : 0,
                    width: isExpanded ? 'auto' : 0
                  }}
                  className="text-sm font-medium whitespace-nowrap overflow-hidden"
                >
                  {section.label}
                </motion.span>

                {isExpanded && isActive && (
                  <ChevronRight className="h-4 w-4 ml-auto text-primary" />
                )}
              </button>
            );
          })}
        </div>
        
        {/* Progress dots when collapsed */}
        {!isExpanded && (
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
            {SECTIONS.map((section) => (
              <div
                key={section.id}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-200",
                  activeSection === section.id 
                    ? "bg-primary scale-125" 
                    : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </motion.nav>
  );
}
