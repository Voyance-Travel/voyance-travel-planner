/**
 * GenerationAnimation — Polished loading animation with orbiting dots,
 * pulsing rings, floating particles, and a gradient progress ring.
 */

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface GenerationAnimationProps {
  progress?: number;
  className?: string;
}

const ORBITING_DOTS = [
  { radius: 72, duration: 20, size: 5, startAngle: 0 },
  { radius: 72, duration: 20, size: 4, startAngle: 180 },
  { radius: 60, duration: 15, size: 3.5, startAngle: 90 },
];

const PARTICLES = [
  { angle: 30, distance: 85, delay: 0, duration: 3 },
  { angle: 90, distance: 80, delay: 0.5, duration: 3.5 },
  { angle: 150, distance: 88, delay: 1, duration: 2.8 },
  { angle: 210, distance: 82, delay: 1.5, duration: 3.2 },
  { angle: 270, distance: 86, delay: 2, duration: 3 },
  { angle: 330, distance: 84, delay: 2.5, duration: 2.6 },
];

export function GenerationAnimation({ progress = 0, className }: GenerationAnimationProps) {
  const circumference = 2 * Math.PI * 52;
  const strokeOffset = circumference - (circumference * progress) / 100;

  return (
    <div className={className}>
      <div className="relative w-40 h-40 mx-auto">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="50%" stopColor="hsl(var(--accent))" />
              <stop offset="100%" stopColor="hsl(var(--primary))" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Pulse rings */}
          <motion.circle
            cx={100} cy={100} r={52}
            className="fill-none stroke-primary/15"
            strokeWidth="1"
            animate={{ r: [52, 72], opacity: [0.4, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.circle
            cx={100} cy={100} r={52}
            className="fill-none stroke-primary/10"
            strokeWidth="1"
            animate={{ r: [52, 80], opacity: [0.3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
          />

          {/* Background glow */}
          <motion.circle
            cx={100} cy={100} r={48}
            className="fill-primary/5"
            animate={{ r: [48, 52, 48], opacity: [0.06, 0.12, 0.06] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Progress ring track */}
          <circle
            cx={100} cy={100} r={52}
            className="fill-none stroke-muted/40"
            strokeWidth="3"
          />

          {/* Progress ring fill — gradient */}
          <motion.circle
            cx={100} cy={100} r={52}
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            transform="rotate(-90 100 100)"
            filter="url(#glow)"
          />

          {/* Orbiting dots */}
          {ORBITING_DOTS.map((dot, i) => {
            const steps = 80;
            const cxFrames: number[] = [];
            const cyFrames: number[] = [];
            for (let s = 0; s <= steps; s++) {
              const angle = (dot.startAngle + (s / steps) * 360) * (Math.PI / 180);
              cxFrames.push(100 + dot.radius * Math.cos(angle));
              cyFrames.push(100 + dot.radius * Math.sin(angle));
            }
            const initialCx = 100 + dot.radius * Math.cos(dot.startAngle * (Math.PI / 180));
            const initialCy = 100 + dot.radius * Math.sin(dot.startAngle * (Math.PI / 180));
            return (
              <motion.circle
                key={i}
                cx={initialCx}
                cy={initialCy}
                r={dot.size}
                className="fill-primary/50"
                animate={{ cx: cxFrames, cy: cyFrames }}
                transition={{
                  duration: dot.duration,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            );
          })}

          {/* Floating particles */}
          {PARTICLES.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const cx = 100 + p.distance * Math.cos(rad);
            const cy = 100 + p.distance * Math.sin(rad);
            return (
              <motion.circle
                key={`p-${i}`}
                cx={cx}
                cy={cy}
                r={1}
                className="fill-primary/30"
                animate={{
                  cy: [cy, cy - 12, cy],
                  opacity: [0, 0.7, 0],
                  r: [1, 2, 1],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  delay: p.delay,
                  ease: 'easeInOut',
                }}
              />
            );
          })}
        </svg>

        {/* Center icon — breathing sparkle */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default GenerationAnimation;
