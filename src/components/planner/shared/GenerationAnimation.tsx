/**
 * GenerationAnimation — Pulsing pin with orbiting dots and progress ring
 * Clean motion graphic shown during itinerary generation.
 */

import { motion } from 'framer-motion';

interface GenerationAnimationProps {
  progress?: number;
  className?: string;
}

const ORBITING_DOTS = [
  { radius: 70, duration: 3, size: 4, startAngle: 0 },
  { radius: 58, duration: 4.5, size: 3, startAngle: 120 },
  { radius: 80, duration: 6, size: 3.5, startAngle: 240 },
];

const SPARKLES = [
  { cx: 40, cy: 50, delay: 0 },
  { cx: 155, cy: 65, delay: 1.2 },
  { cx: 60, cy: 155, delay: 2.4 },
  { cx: 150, cy: 145, delay: 0.8 },
  { cx: 100, cy: 30, delay: 1.8 },
];

export function GenerationAnimation({ progress = 0, className }: GenerationAnimationProps) {
  const circumference = 2 * Math.PI * 50;
  const strokeOffset = circumference - (circumference * progress) / 100;

  return (
    <div className={className}>
      <svg
        viewBox="0 0 200 200"
        className="w-32 h-32 mx-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background glow */}
        <motion.circle
          cx="100" cy="100" r="55"
          className="fill-primary/5"
          animate={{ r: [55, 60, 55], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Progress ring track */}
        <circle
          cx="100" cy="100" r="50"
          className="fill-none stroke-muted"
          strokeWidth="3"
        />

        {/* Progress ring fill */}
        <motion.circle
          cx="100" cy="100" r="50"
          className="fill-none stroke-primary/60"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: strokeOffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          transform="rotate(-90 100 100)"
        />

        {/* Center pin body */}
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Pin shape */}
          <path
            d="M100 125 L100 112"
            className="stroke-primary/40"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="14" className="fill-primary/15 stroke-primary/30" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="8" className="fill-primary" />
          {/* Plane silhouette inside pin */}
          <path
            d="M97 100 L103 100 M100 97 L100 103 M98 98.5 L96 96 M102 98.5 L104 96"
            className="stroke-primary-foreground"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </motion.g>

        {/* Pin shadow */}
        <motion.ellipse
          cx="100" cy="128" rx="8" ry="2"
          className="fill-foreground/10"
          animate={{ rx: [8, 6, 8], opacity: [0.1, 0.06, 0.1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Orbiting dots — using animateMotion-style approach via keyframes */}
        {ORBITING_DOTS.map((dot, i) => {
          // Pre-compute 60 positions along the orbit for smooth animation
          const steps = 60;
          const cxFrames: number[] = [];
          const cyFrames: number[] = [];
          for (let s = 0; s <= steps; s++) {
            const angle = (dot.startAngle + (s / steps) * 360) * (Math.PI / 180);
            cxFrames.push(100 + dot.radius * Math.cos(angle));
            cyFrames.push(100 + dot.radius * 0.45 * Math.sin(angle));
          }
          return (
            <motion.circle
              key={i}
              r={dot.size}
              className="fill-primary/40"
              animate={{ cx: cxFrames, cy: cyFrames }}
              transition={{
                duration: dot.duration,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          );
        })}

        {/* Sparkle particles */}
        {SPARKLES.map((s, i) => (
          <motion.g key={i} transform={`translate(${s.cx}, ${s.cy})`}>
            <motion.path
              d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z"
              className="fill-primary/30"
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: s.delay,
                ease: 'easeInOut',
              }}
            />
          </motion.g>
        ))}

        {/* Outer pulse ring */}
        <motion.circle
          cx="100" cy="100" r="50"
          className="fill-none stroke-primary/20"
          strokeWidth="1"
          animate={{ r: [50, 65], opacity: [0.3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
        />
      </svg>
    </div>
  );
}

export default GenerationAnimation;
