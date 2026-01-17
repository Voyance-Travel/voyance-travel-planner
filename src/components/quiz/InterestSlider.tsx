import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type InterestLevel = 'notInterested' | 'slightlyInterested' | 'interested' | 'veryInterested' | 'mustHave';

interface InterestSliderProps {
  title: string;
  icon?: React.ReactNode;
  description?: string;
  value: InterestLevel;
  onChange: (value: InterestLevel) => void;
  className?: string;
}

const interestLevelData: Record<InterestLevel, { value: number; title: string }> = {
  notInterested: { value: 1, title: 'Not Important' },
  slightlyInterested: { value: 2, title: 'Nice to Have' },
  interested: { value: 3, title: 'Interested' },
  veryInterested: { value: 4, title: 'Very Important' },
  mustHave: { value: 5, title: 'Must Have' },
};

export default function InterestSlider({
  title,
  icon,
  description,
  value,
  onChange,
  className
}: InterestSliderProps) {
  const getNumericValue = (level: InterestLevel): number => {
    return interestLevelData[level]?.value || 3;
  };

  const getInterestLevel = (numValue: number): InterestLevel => {
    const entries = Object.entries(interestLevelData);
    const found = entries.find(([_, data]) => data.value === numValue);
    return (found?.[0] as InterestLevel) || 'interested';
  };

  const [sliderValue, setSliderValue] = useState(getNumericValue(value));
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    if (isChanging) {
      const timer = setTimeout(() => {
        onChange(getInterestLevel(sliderValue));
        setIsChanging(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [sliderValue, onChange, isChanging]);

  useEffect(() => {
    if (!isChanging) {
      setSliderValue(getNumericValue(value));
    }
  }, [value, isChanging]);

  const progressPercent = ((sliderValue - 1) / 4) * 100;

  return (
    <div className={cn('p-4 border border-border rounded-xl bg-card', className)}>
      <div className="flex items-center mb-2">
        {icon && <span className="text-2xl mr-3 text-primary">{icon}</span>}
        <div>
          <h3 className="font-medium text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="relative h-8">
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={sliderValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setIsChanging(true);
              setSliderValue(Number(e.target.value));
            }}
            className="w-full h-2 absolute top-3 appearance-none rounded-full focus:outline-none cursor-pointer"
            style={{
              WebkitAppearance: 'none',
              background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${progressPercent}%, hsl(var(--muted)) ${progressPercent}%, hsl(var(--muted)) 100%)`
            }}
          />
          {/* Custom thumb indicator */}
          <motion.div
            className="absolute h-6 w-6 bg-card border-2 border-primary rounded-full shadow-md pointer-events-none"
            style={{
              left: `calc(${progressPercent}% - ${(sliderValue - 1) * 3}px)`,
              top: '1px'
            }}
            animate={{ scale: isChanging ? 1.1 : 1 }}
            transition={{ duration: 0.2 }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-3">
          <span className="text-xs font-medium text-muted-foreground">
            Not Important
          </span>
          <span className="text-xs font-medium text-primary">
            Must Have
          </span>
        </div>

        {/* Selected value */}
        <div className="text-center mt-2">
          <span className="text-sm font-medium text-foreground">
            {interestLevelData[getInterestLevel(sliderValue)]?.title}
          </span>
        </div>
      </div>
    </div>
  );
}

export type { InterestLevel };
