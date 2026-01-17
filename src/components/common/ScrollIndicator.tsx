import { motion } from "framer-motion";
import { scrollToElement } from "@/utils/scrollUtils";

interface ScrollIndicatorProps {
  targetId: string;
  color?: "light" | "dark";
}

export default function ScrollIndicator({ targetId, color = "dark" }: ScrollIndicatorProps) {
  const textColor = color === "light" ? "text-white" : "text-muted-foreground";

  return (
    <motion.div
      className={`w-full flex justify-center items-center mt-12 ${textColor} opacity-70 hover:opacity-100 transition-opacity cursor-pointer pb-4`}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 0.7 }}
      viewport={{ once: true }}
      transition={{ delay: 0.5, duration: 0.8 }}
      whileHover={{ scale: 1.05 }}
      onClick={() => scrollToElement(targetId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          scrollToElement(targetId);
        }
      }}
      role="button"
      aria-label={`Scroll to ${targetId}`}
      tabIndex={0}
    >
      <svg
        className="w-6 h-6 animate-bounce mx-auto"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
    </motion.div>
  );
}
