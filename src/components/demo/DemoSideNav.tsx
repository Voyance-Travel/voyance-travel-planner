import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Sparkles, 
  Users, 
  UsersRound, 
  Map, 
  Rocket,
  ChevronDown
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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = Math.min((window.scrollY / docHeight) * 100, 100);
      setProgress(scrollProgress);

      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const section = document.getElementById(SECTIONS[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsExpanded(false);
  };

  const activeIndex = SECTIONS.findIndex(s => s.id === activeSection);
  const ActiveIcon = SECTIONS[activeIndex]?.icon || Sparkles;

  if (showTour) return null;

  return (
    <>
      {/* Mobile/Tablet - Bottom floating pill */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 lg:hidden"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2.5 bg-card/95 backdrop-blur-md border shadow-lg rounded-full"
        >
          <ActiveIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{SECTIONS[activeIndex]?.label}</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )} />
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-card/95 backdrop-blur-md border shadow-xl rounded-2xl overflow-hidden"
            >
              {SECTIONS.map((section, idx) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                const isPast = idx < activeIndex;
                
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : isPast
                        ? "text-muted-foreground"
                        : "text-foreground hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Desktop - Side rail with vertical progress */}
      <motion.nav
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-row-reverse items-center gap-4"
      >
        {/* Progress bar */}
        <div className="relative h-64 w-1 bg-muted rounded-full overflow-hidden">
          <motion.div 
            className="absolute top-0 left-0 w-full bg-primary rounded-full"
            style={{ height: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Navigation items */}
        <div className="flex flex-col gap-1">
          {SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            const isPast = idx < activeIndex;
            
            return (
              <motion.button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className="group relative flex items-center"
                whileHover={{ x: -4 }}
                transition={{ duration: 0.2 }}
              >
                {/* Icon circle */}
                <div className={cn(
                  "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                    : isPast
                    ? "bg-primary/20 text-primary"
                    : "bg-card border text-muted-foreground group-hover:border-primary/50 group-hover:text-foreground"
                )}>
                  <Icon className="h-4 w-4" />
                  
                  {/* Pulse ring for active */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-xl border-2 border-primary"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.3, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Label tooltip */}
                <div className={cn(
                  "absolute right-14 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200",
                  "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-card border text-foreground shadow-sm"
                )}>
                  {section.label}
                  {/* Arrow */}
                  <div className={cn(
                    "absolute right-0 top-1/2 translate-x-1 -translate-y-1/2 w-2 h-2 rotate-45",
                    isActive ? "bg-primary" : "bg-card border-r border-t"
                  )} />
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.nav>
    </>
  );
}
