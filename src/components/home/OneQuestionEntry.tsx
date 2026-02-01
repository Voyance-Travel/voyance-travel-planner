import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ONE_QUESTION_HOOK } from '@/lib/archetypeTeasers';
import ArchetypeTeaser from './ArchetypeTeaser';

export default function OneQuestionEntry() {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const selectedOption = selectedAnswer 
    ? ONE_QUESTION_HOOK.options.find(o => o.value === selectedAnswer) 
    : null;

  if (selectedOption) {
    return (
      <ArchetypeTeaser 
        archetype={selectedOption.archetype}
        onReset={() => setSelectedAnswer(null)}
      />
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl md:text-3xl lg:text-4xl font-serif font-normal text-center mb-10 text-foreground"
      >
        {ONE_QUESTION_HOOK.question}
      </motion.h2>

      <div className="space-y-3">
        {ONE_QUESTION_HOOK.options.map((option, index) => (
          <motion.button
            key={option.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.1 }}
            onClick={() => setSelectedAnswer(option.value)}
            className={cn(
              "w-full p-4 text-left rounded-xl border transition-all duration-200",
              "hover:border-primary hover:bg-primary/5",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              "bg-background border-border"
            )}
          >
            <span className="text-foreground">{option.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
