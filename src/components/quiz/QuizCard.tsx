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
        'w-full p-4 rounded-xl border transition-all text-left relative',
        selected 
          ? 'border-primary bg-primary/10 shadow-sm' 
          : 'border-border hover:border-primary/40 hover:bg-primary/5',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      disabled={disabled}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
    >
      <div className="flex items-center">
        {icon && (
          <span className="text-2xl mr-3 text-primary">
            {icon}
          </span>
        )}
        <div>
          <h3 className="font-medium text-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
          <Check className="h-3 w-3" />
        </div>
      )}
    </motion.button>
  );
}
