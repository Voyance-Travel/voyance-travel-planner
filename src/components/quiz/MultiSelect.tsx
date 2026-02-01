import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import QuizCard from './QuizCard';

interface Option {
  value: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  maxSelections?: number;
  className?: string;
}

export default function MultiSelect({
  options,
  value,
  onChange,
  maxSelections = 3,
  className
}: MultiSelectProps) {
  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      if (value.length < maxSelections) {
        onChange([...value, optionValue]);
      }
    }
  };

  const selectionProgress = value.length / maxSelections;

  return (
    <div className={cn('space-y-5', className)}>
      {/* Options grid with staggered animation */}
      <motion.div 
        className="grid gap-3 sm:gap-4"
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.05
            }
          }
        }}
      >
        {options.map((option, index) => {
          const isSelected = value.includes(option.value);
          const isDisabled = !isSelected && value.length >= maxSelections;
          
          return (
            <motion.div
              key={option.value}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <QuizCard
                title={option.title}
                description={option.description}
                icon={option.icon}
                selected={isSelected}
                onClick={() => handleToggle(option.value)}
                role="checkbox"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggle(option.value);
                  }
                }}
                disabled={isDisabled}
              />
            </motion.div>
          );
        })}
      </motion.div>
      
      {/* Selection counter with progress indicator */}
      {maxSelections > 1 && (
        <motion.div 
          className="flex items-center gap-3 pt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: maxSelections }).map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-300',
                  i < value.length 
                    ? 'bg-accent shadow-sm' 
                    : 'bg-border/50'
                )}
                initial={false}
                animate={i < value.length ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.2 }}
              />
            ))}
          </div>
          
          <p className="text-sm text-muted-foreground">
            {value.length === 0 ? (
              <span>Select up to {maxSelections}</span>
            ) : value.length === maxSelections ? (
              <span className="text-accent font-medium">All {maxSelections} selected</span>
            ) : (
              <span>
                <span className="text-foreground font-medium">{value.length}</span>
                {' '}of {maxSelections} selected
              </span>
            )}
          </p>
        </motion.div>
      )}
    </div>
  );
}
