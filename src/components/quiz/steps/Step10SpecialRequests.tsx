import { motion } from 'framer-motion';
import { Controller, Control } from 'react-hook-form';
import type { DreamQuizType } from '@/types/dreamQuiz';

interface Step10Props {
  control: Control<DreamQuizType>;
}

/**
 * Step 10: Special Requests
 * Asks about dietary needs and any other special requests
 */
export default function Step10SpecialRequests({ control }: Step10Props) {
  return (
    <div className="space-y-10">
      {/* Dietary Restrictions Section */}
      <section>
        <h2 className="text-xl font-medium text-foreground mb-4">
          Do you have any dietary restrictions or allergies?
        </h2>
        <p className="text-muted-foreground mb-6">
          Optional: Share any food allergies or dietary needs that may impact your travel.
        </p>
        <Controller
          name="dietaryRestrictions"
          control={control}
          render={({ field }) => (
            <textarea
              className="w-full p-4 border border-border rounded-xl bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
              rows={3}
              placeholder="e.g., gluten-free, vegetarian, nut allergies, etc."
              value={field.value || ''}
              onChange={field.onChange}
            />
          )}
        />
      </section>

      {/* Special Requests Section */}
      <section>
        <h2 className="text-xl font-medium text-foreground mb-4">
          Any other special requests or preferences?
        </h2>
        <p className="text-muted-foreground mb-6">
          Optional: Share anything else that would help us craft your perfect journey.
        </p>
        <Controller
          name="specialRequests"
          control={control}
          render={({ field }) => (
            <textarea
              className="w-full p-4 border border-border rounded-xl bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
              rows={5}
              placeholder="e.g., celebrating a special occasion, interested in specific cultural experiences, prefer female guides, etc."
              value={field.value || ''}
              onChange={field.onChange}
            />
          )}
        />
      </section>

      {/* Completion message */}
      <motion.div
        className="bg-primary/10 p-6 rounded-xl border border-primary/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <h3 className="text-lg font-medium text-primary mb-2">
          Almost There
        </h3>
        <p className="text-muted-foreground">
          Thank you for sharing your travel preferences. This information will help us create 
          personalized recommendations tailored to your interests and needs. Continue to the final step.
        </p>
      </motion.div>
    </div>
  );
}
