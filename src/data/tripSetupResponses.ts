/**
 * Trip Setup Responses - "You Get Me" micro-validations
 * These responses make users feel seen and understood at every selection
 */

export const tripTypeResponses: Record<string, string> = {
  solo: "Solo trips are the best. Total freedom. We'll make sure every restaurant has good bar seating.",
  honeymoon: "Congratulations! We'll build in plenty of rest. You just survived a wedding.",
  family: "Got it. We'll plan around nap time and find places where kids can be kids.",
  guys_trip: "We'll make sure there's at least one great bar and something you'll all remember.",
  girls_trip: "Brunch, something photo-worthy, and at least one great night out. We got you.",
  anniversary: "We'll make sure there's a special moment to celebrate your journey together.",
  birthday: "We'll make sure there's a proper celebration, but just one, not birthday overload.",
  babymoon: "We'll keep it gentle. No early mornings, nothing strenuous, all pregnancy-safe.",
  foodie: "Finally, someone who gets it. We'll build this trip around the meals.",
  adventure: "We'll find the experiences that make your heart race.",
  relaxation: "Permission to do absolutely nothing, granted.",
  cultural: "We'll go deeper than the guidebooks. The real stories are waiting.",
  romantic: "Every dinner has a view. Every moment is intentional.",
  bachelor: "What happens on this trip... we'll make sure it's worth remembering.",
  bachelorette: "Celebrations, photos, and moments you'll talk about forever.",
  reunion: "We'll find spaces where everyone can catch up properly.",
  wellness: "Reset, restore, return renewed. That's the plan.",
  business_leisure: "Work hard, explore harder. We'll balance both.",
};

export const visitorTypeResponses = {
  firstTime: (destination: string) => 
    `First time in ${destination}! We'll include the icons. You should see them. But we'll also show you some spots the guidebooks miss.`,
  returning: (destination: string) => 
    `Welcome back to ${destination}. We'll skip the obvious stuff and show you a different side of the city.`,
};

export const childrenAgeResponses: Record<string, string> = {
  infant: "👶 Traveling with a baby. We'll build in flexibility and find the family-friendly spots.",
  toddler: "👶 Toddler detected. Nap time is sacred. We'll build the whole day around it.",
  young: "🧒 Young kids on board. We'll keep activities short and snack breaks frequent.",
  elementary: "🎒 School-age kids coming. We'll mix education with fun—they won't even notice they're learning.",
  teen: "🎮 Teens coming too. We'll include things they'll actually think are cool.",
  mixed: "Mixed ages? We'll find experiences that work for everyone—and build in some divide-and-conquer time.",
};

export const budgetResponses: Record<string, string> = {
  budget: "We respect the hustle. Maximum experience, minimum spend.",
  moderate: "Smart balance. We'll splurge where it matters.",
  premium: "Quality first. We'll find the elevated options.",
  luxury: "No compromises. We'll find the best of the best.",
};

export const paceResponses: Record<string, string> = {
  relaxed: "Slow and steady. We'll leave room to breathe between everything.",
  balanced: "A bit of both. Enough to feel accomplished, enough to feel rested.",
  active: "You want to see it all. We'll pack it in, but smartly.",
  intense: "Full send. We'll maximize every hour.",
};

export const groupSizeResponses = {
  solo: "Just you. The most honest way to travel.",
  couple: "Two is the perfect number for exploring.",
  small: (count: number) => `${count} people. Small enough to be nimble, big enough to share the fun.`,
  medium: (count: number) => `${count} travelers. We'll find places that can handle you all.`,
  large: (count: number) => `${count} people! We'll look for group-friendly experiences and maybe some reservation magic.`,
};

/**
 * Get a contextual response based on group size
 */
export function getGroupSizeResponse(count: number): string {
  if (count === 1) return groupSizeResponses.solo;
  if (count === 2) return groupSizeResponses.couple;
  if (count <= 4) return groupSizeResponses.small(count);
  if (count <= 8) return groupSizeResponses.medium(count);
  return groupSizeResponses.large(count);
}

/**
 * Get response for children age based on actual age
 */
export function getChildAgeResponse(age: number): string {
  if (age < 1) return childrenAgeResponses.infant;
  if (age <= 3) return childrenAgeResponses.toddler;
  if (age <= 5) return childrenAgeResponses.young;
  if (age <= 12) return childrenAgeResponses.elementary;
  return childrenAgeResponses.teen;
}
