import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useIsMobile } from '@/hooks/use-mobile';

export default function StickyMobileCTA() {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobile) return;

    const onScroll = () => {
      // Show after scrolling past ~80vh (hero)
      const pastHero = window.scrollY > window.innerHeight * 0.7;
      // Hide when near footer (last 300px)
      const nearFooter = window.scrollY + window.innerHeight >= document.body.scrollHeight - 300;
      setVisible(pastHero && !nearFooter);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  if (!isMobile || !visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary shadow-lg safe-area-bottom">
      <Link
        to={ROUTES.START}
        className="flex items-center justify-center gap-2 w-full h-14 text-primary-foreground font-semibold text-base"
      >
        Start Planning
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
