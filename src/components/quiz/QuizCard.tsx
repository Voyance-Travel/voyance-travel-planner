import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export default function QuizCard({
  title,
  description,
  icon,
  selected,
  onClick,
  className,
  disabled = false,
  role,
  tabIndex,
  onKeyDown
}: QuizCardProps) {
  return (
    <motion.button
      className={cn(
        'group w-full p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden',
        'bg-card backdrop-blur-sm',
        selected 
          ? 'border-accent bg-accent/8 shadow-md ring-1 ring-accent/20' 
          : 'border-border/60 hover:border-accent/50 hover:bg-accent/5 hover:shadow-sm',
        disabled && 'opacity-40 cursor-not-allowed grayscale',
        !disabled && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      disabled={disabled}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      whileHover={!disabled ? { scale: 1.015, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.985 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Subtle gradient overlay on hover */}
      <div className={cn(
        'absolute inset-0 opacity-0 transition-opacity duration-300',
        'bg-gradient-to-br from-accent/5 to-transparent',
        !disabled && 'group-hover:opacity-100',
        selected && 'opacity-100'
      )} />
      
      <div className="relative flex items-start gap-4">
        {icon && (
          <div className={cn(
            'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
            'transition-all duration-300',
            selected 
              ? 'bg-accent/15 scale-105' 
              : 'bg-muted/50 group-hover:bg-accent/10 group-hover:scale-105'
          )}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className={cn(
            'font-serif font-medium text-base transition-colors',
            selected ? 'text-foreground' : 'text-foreground/90 group-hover:text-foreground'
          )}>
            {title}
          </h3>
          {description && (
            <p className={cn(
              'text-sm mt-1.5 leading-relaxed transition-colors',
              selected ? 'text-muted-foreground' : 'text-muted-foreground/80'
            )}>
              {description}
            </p>
          )}
        </div>
      </div>
      
      {/* Selection indicator */}
      <motion.div 
        className={cn(
          'absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center',
          'transition-all duration-200',
          selected 
            ? 'bg-accent text-accent-foreground shadow-sm' 
            : 'border-2 border-border/40 bg-background/50 group-hover:border-accent/40'
        )}
        initial={false}
        animate={selected ? { scale: 1 } : { scale: 0.9 }}
      >
        <Check className={cn(
          'h-3.5 w-3.5 transition-all duration-200',
          selected ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        )} />
      </motion.div>
    </motion.button>
  );
}
