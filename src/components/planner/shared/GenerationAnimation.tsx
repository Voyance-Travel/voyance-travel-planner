/**
 * GenerationAnimation — Minimal compass + orbiting plane
 * Clean, premium feel using Framer Motion. No 3D, no canvas.
 */

import { motion } from 'framer-motion';

interface GenerationAnimationProps {
  /** 0-100 progress */
  progress?: number;
  className?: string;
}

export function GenerationAnimation({ progress = 0, className }: GenerationAnimationProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (progress / 100) * circumference;

  return (
    <div className={className}>
      <div className="relative w-32 h-32 mx-auto">
        <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="progressArc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Dotted orbit ring */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity="0.12"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />

          {/* Progress arc */}
          {progress > 0 && (
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="url(#progressArc)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: progressOffset }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              transform="rotate(-90 60 60)"
            />
          )}

          {/* Center compass dot */}
          <circle cx="60" cy="60" r="3" fill="hsl(var(--primary))" fillOpacity="0.25" />
          <circle cx="60" cy="60" r="1.5" fill="hsl(var(--primary))" fillOpacity="0.6" />

          {/* Compass crosshairs */}
          <line x1="60" y1="50" x2="60" y2="70" stroke="hsl(var(--primary))" strokeOpacity="0.1" strokeWidth="0.8" />
          <line x1="50" y1="60" x2="70" y2="60" stroke="hsl(var(--primary))" strokeOpacity="0.1" strokeWidth="0.8" />
        </svg>

        {/* Orbiting plane */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <svg
            viewBox="0 0 24 24"
            className="absolute w-5 h-5 text-primary"
            style={{ top: '2px', left: '50%', transform: 'translateX(-50%) rotate(90deg)' }}
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </svg>
        </motion.div>

        {/* Pulsing ring */}
        <motion.div
          className="absolute inset-0 rounded-full border border-primary/20"
          animate={{ scale: [1, 1.25], opacity: [0.3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />

        {/* Destination pins appearing with progress */}
        <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {progress > 20 && (
            <motion.circle
              cx="38" cy="42" r="2.5"
              fill="hsl(var(--primary))"
              fillOpacity="0.6"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            />
          )}
          {progress > 50 && (
            <motion.circle
              cx="82" cy="45" r="2.5"
              fill="hsl(var(--primary))"
              fillOpacity="0.6"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            />
          )}
          {progress > 75 && (
            <motion.circle
              cx="75" cy="80" r="2.5"
              fill="hsl(var(--primary))"
              fillOpacity="0.6"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export default GenerationAnimation;
