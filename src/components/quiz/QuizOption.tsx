import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizOptionProps {
  value: string;
  label: string;
  description: string;
  isSelected: boolean;
  onSelect: (value: string) => void;
  index: number;
}

export function QuizOption({ 
  value, 
  label, 
  description, 
  isSelected, 
  onSelect,
  index 
}: QuizOptionProps) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(value)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.08,
        type: 'spring',
        stiffness: 300,
        damping: 25
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative p-5 rounded-xl border-2 text-left transition-all w-full group',
        'hover:shadow-md',
        isSelected
          ? 'border-accent bg-accent/5 shadow-sm'
          : 'border-border bg-card hover:border-accent/50'
      )}
    >
      {/* Selection indicator */}
      <motion.div
        initial={false}
        animate={{
          scale: isSelected ? 1 : 0.8,
          opacity: isSelected ? 1 : 0,
        }}
        className="absolute top-4 right-4"
      >
        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
          <Check className="w-4 h-4 text-accent-foreground" />
        </div>
      </motion.div>
      
      {/* Unselected indicator */}
      <motion.div
        initial={false}
        animate={{
          scale: isSelected ? 0.8 : 1,
          opacity: isSelected ? 0 : 1,
        }}
        className="absolute top-4 right-4"
      >
        <div className="w-6 h-6 rounded-full border-2 border-border group-hover:border-accent/50 transition-colors" />
      </motion.div>
      
      {/* Content */}
      <div className="pr-10">
        <div className={cn(
          'font-medium text-lg mb-1 transition-colors',
          isSelected ? 'text-foreground' : 'text-foreground group-hover:text-foreground'
        )}>
          {label}
        </div>
        <div className={cn(
          'text-sm transition-colors',
          isSelected ? 'text-muted-foreground' : 'text-muted-foreground'
        )}>
          {description}
        </div>
      </div>
      
      {/* Subtle background animation on selection */}
      {isSelected && (
        <motion.div
          layoutId="selected-bg"
          className="absolute inset-0 bg-accent/5 rounded-xl -z-10"
          initial={false}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </motion.button>
  );
}
