import { motion } from "framer-motion";

// SVG Icons with refined styling
const CompassIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
    <path d="M14.5 9.5L9.5 14.5M9.5 9.5L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const ChipIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 4V1M15 4V1M9 23V20M15 23V20M20 9H23M20 15H23M1 9H4M1 15H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 2V6M16 2V6M3 10H21M8 14H10M14 14H16M8 18H10M14 18H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const FocusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

const FEATURE_CARDS = [
  {
    title: "Personalized Itineraries",
    description: "Built around your style, time, and travel personality.",
    icon: <CompassIcon />
  },
  {
    title: "Explainable AI",
    description: "Not a chatbot. Real logic you can see, tweak, and trust.",
    icon: <ChipIcon />
  },
  {
    title: "Stress-Free Booking",
    description: "Lock in flights, hotels, and plans — without starting over.",
    icon: <CalendarIcon />
  },
  {
    title: "Time-Saving Tools",
    description: "No endless tabs or influencer hype. Just researched results.",
    icon: <FocusIcon />
  },
];

export default function FeatureCards() {
  return (
    <section className="bg-background py-36 px-6">
      <div className="max-w-6xl mx-auto text-center mb-20">
        <motion.h2
          className="text-3xl md:text-4xl font-serif font-semibold text-foreground mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
        >
          Why Choose Voyance
        </motion.h2>
        <motion.p
          className="text-muted-foreground mt-3 text-lg mx-auto max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          The only AI travel platform built to curate — not confuse.
        </motion.p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {FEATURE_CARDS.map(({ title, description, icon }, index) => (
          <motion.div
            key={index}
            className="bg-card rounded-xl shadow-md p-6 md:p-8 hover:scale-105 hover:shadow-lg transition h-full flex flex-col border border-border"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <div className="bg-accent/20 text-primary w-10 h-10 rounded-full flex justify-center items-center mb-4 mx-auto">
              {icon}
            </div>
            <h3 className="text-lg font-semibold text-foreground text-center">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto text-center">
              {description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
