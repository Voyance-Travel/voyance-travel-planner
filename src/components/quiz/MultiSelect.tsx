import { cn } from '@/lib/utils';
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

  return (
    <div className={cn('grid gap-4', className)}>
      {options.map((option) => {
        const isSelected = value.includes(option.value);
        const isDisabled = !isSelected && value.length >= maxSelections;
        
        return (
          <QuizCard
            key={option.value}
            title={option.title}
            description={option.description}
            icon={option.icon}
            selected={isSelected}
            onClick={() => handleToggle(option.value)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle(option.value);
              }
            }}
            disabled={isDisabled}
          />
        );
      })}
      
      {maxSelections > 1 && (
        <p className="text-sm text-muted-foreground mt-2">
          {value.length === 0
            ? `Select up to ${maxSelections} options`
            : `Selected ${value.length} of ${maxSelections} options`}
        </p>
      )}
    </div>
  );
}
