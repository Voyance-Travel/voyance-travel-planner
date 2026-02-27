import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileAccordionSectionProps {
  title: string;
  teaser: string;
  children: ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  id?: string;
}

export default function MobileAccordionSection({
  title,
  teaser,
  children,
  isOpen = false,
  onToggle,
  id,
}: MobileAccordionSectionProps) {
  const isMobile = useIsMobile();
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen, children]);

  // On desktop, render children directly — no accordion
  if (!isMobile) {
    return <div id={id}>{children}</div>;
  }

  return (
    <div id={id} className="border-b border-border/50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4 min-h-[56px] text-left active:bg-muted/30 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex-1 min-w-0 pr-3">
          <h3 className="text-base font-semibold text-foreground leading-tight">{title}</h3>
          {!isOpen && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{teaser}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-250 ease-out",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: isOpen ? `${contentHeight}px` : '0px' }}
      >
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
