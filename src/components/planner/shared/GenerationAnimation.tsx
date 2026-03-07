/**
 * GenerationAnimation — Airplane flying around a globe
 * Animated SVG showing a plane orbiting Earth during itinerary generation.
 */

import { motion } from 'framer-motion';

interface GenerationAnimationProps {
  /** 0-100 progress */
  progress?: number;
  className?: string;
}

export function GenerationAnimation({ progress = 0, className }: GenerationAnimationProps) {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 200 200"
        className="w-32 h-32 mx-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Globe */}
        <circle
          cx="100"
          cy="100"
          r="60"
          className="fill-primary/5 stroke-primary/20"
          strokeWidth="1.5"
        />
        {/* Globe latitude lines */}
        <ellipse cx="100" cy="100" rx="60" ry="20" className="fill-none stroke-primary/10" strokeWidth="1" />
        <ellipse cx="100" cy="100" rx="60" ry="40" className="fill-none stroke-primary/10" strokeWidth="1" />
        {/* Globe longitude lines */}
        <ellipse cx="100" cy="100" rx="20" ry="60" className="fill-none stroke-primary/10" strokeWidth="1" />
        <ellipse cx="100" cy="100" rx="40" ry="60" className="fill-none stroke-primary/10" strokeWidth="1" />
        {/* Equator */}
        <ellipse cx="100" cy="100" rx="60" ry="8" className="fill-none stroke-primary/15" strokeWidth="1.5" />

        {/* Orbit path (visible trail) */}
        <ellipse
          cx="100"
          cy="100"
          rx="80"
          ry="30"
          className="fill-none stroke-primary/20"
          strokeWidth="1"
          strokeDasharray="4 4"
          transform="rotate(-15 100 100)"
        />

        {/* Progress arc — fills as generation progresses */}
        <motion.ellipse
          cx="100"
          cy="100"
          rx="80"
          ry="30"
          className="fill-none stroke-primary/40"
          strokeWidth="2"
          strokeLinecap="round"
          transform="rotate(-15 100 100)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: progress / 100 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ strokeDasharray: 1, strokeDashoffset: 0 }}
        />

        {/* Airplane — orbits the globe */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          style={{ originX: '100px', originY: '100px' }}
        >
          <g transform="rotate(-15 100 100)">
            {/* Position plane at top of orbit ellipse */}
            <g transform="translate(180, 100)">
              {/* Airplane icon pointing right */}
              <g transform="rotate(0) scale(0.9)">
                <path
                  d="M-4,-2 L4,0 L-4,2 L-3,0 Z"
                  className="fill-primary"
                />
                {/* Wings */}
                <path
                  d="M-2,-1 L0,-5 L1,-5 L0,-1"
                  className="fill-primary/80"
                />
                <path
                  d="M-2,1 L0,5 L1,5 L0,1"
                  className="fill-primary/80"
                />
                {/* Tail */}
                <path
                  d="M-4,-1 L-6,-3 L-5,-3 L-4,0"
                  className="fill-primary/60"
                />
                <path
                  d="M-4,1 L-6,3 L-5,3 L-4,0"
                  className="fill-primary/60"
                />
              </g>
            </g>
          </g>
        </motion.g>

        {/* Contrail particles */}
        {[0, 1, 2].map(i => (
          <motion.circle
            key={i}
            r="1.5"
            className="fill-primary/20"
            animate={{
              cx: [180, 160, 140],
              cy: [85, 90, 95],
              opacity: [0.4, 0.2, 0],
              r: [1.5, 2, 2.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeOut',
            }}
          />
        ))}

        {/* Building markers on globe — appear as days complete */}
        {progress > 0 && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.circle
              cx="85" cy="80" r="3"
              className="fill-primary/60"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            />
            {progress > 30 && (
              <motion.circle
                cx="115" cy="90" r="3"
                className="fill-primary/60"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
              />
            )}
            {progress > 60 && (
              <motion.circle
                cx="95" cy="115" r="3"
                className="fill-primary/60"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
              />
            )}
          </motion.g>
        )}

        {/* Pulsing ring around globe */}
        <motion.circle
          cx="100"
          cy="100"
          r="65"
          className="fill-none stroke-primary/15"
          strokeWidth="1"
          animate={{ r: [65, 75], opacity: [0.3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      </svg>
    </div>
  );
}

export default GenerationAnimation;
