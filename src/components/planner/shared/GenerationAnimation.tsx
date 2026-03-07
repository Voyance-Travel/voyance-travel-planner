/**
 * GenerationAnimation — Polished airplane orbiting a colorful globe
 * Animated SVG with gradient fills, smooth motion, and visual depth.
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
        <defs>
          {/* Globe gradient — ocean blue to teal */}
          <radialGradient id="globeGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
          </radialGradient>
          {/* Highlight / shine */}
          <radialGradient id="globeShine" cx="35%" cy="30%" r="30%">
            <stop offset="0%" stopColor="white" stopOpacity="0.25" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          {/* Shadow under globe */}
          <radialGradient id="globeShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
          {/* Progress arc gradient */}
          <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Shadow ellipse */}
        <ellipse cx="100" cy="170" rx="45" ry="8" fill="url(#globeShadow)" />

        {/* Globe body — filled with gradient */}
        <circle
          cx="100"
          cy="100"
          r="58"
          fill="url(#globeGrad)"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.25"
          strokeWidth="1.5"
        />

        {/* Continent-like shapes for visual interest */}
        <path
          d="M78 72 Q85 65 95 68 Q100 75 92 82 Q84 80 78 72Z"
          fill="hsl(var(--primary))"
          fillOpacity="0.18"
        />
        <path
          d="M105 85 Q115 78 125 84 Q128 95 118 100 Q108 97 105 85Z"
          fill="hsl(var(--primary))"
          fillOpacity="0.15"
        />
        <path
          d="M80 105 Q88 98 96 103 Q98 112 90 116 Q82 113 80 105Z"
          fill="hsl(var(--primary))"
          fillOpacity="0.12"
        />
        <path
          d="M110 110 Q118 106 124 112 Q122 120 115 122 Q108 118 110 110Z"
          fill="hsl(var(--primary))"
          fillOpacity="0.14"
        />

        {/* Latitude lines — subtle, filled look */}
        <ellipse cx="100" cy="100" rx="58" ry="18" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.1" strokeWidth="0.8" />
        <ellipse cx="100" cy="100" rx="58" ry="38" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.08" strokeWidth="0.8" />
        {/* Longitude lines */}
        <ellipse cx="100" cy="100" rx="18" ry="58" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.08" strokeWidth="0.8" />
        <ellipse cx="100" cy="100" rx="38" ry="58" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.08" strokeWidth="0.8" />

        {/* Shine overlay */}
        <circle cx="100" cy="100" r="58" fill="url(#globeShine)" />

        {/* Orbit path — dashed ring */}
        <ellipse
          cx="100"
          cy="100"
          rx="82"
          ry="28"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.15"
          strokeWidth="1"
          strokeDasharray="5 4"
          transform="rotate(-12 100 100)"
        />

        {/* Progress arc — fills as generation progresses */}
        {progress > 0 && (
          <motion.ellipse
            cx="100"
            cy="100"
            rx="82"
            ry="28"
            fill="none"
            stroke="url(#progressGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform="rotate(-12 100 100)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: progress / 100 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ strokeDasharray: 1, strokeDashoffset: 0 }}
          />
        )}

        {/* Airplane — orbits the globe */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          style={{ originX: '100px', originY: '100px' }}
        >
          <g transform="rotate(-12 100 100)">
            <g transform="translate(182, 100)">
              <g transform="scale(1.1)">
                {/* Fuselage */}
                <path
                  d="M-5,-1.5 L5,0 L-5,1.5 L-3.5,0 Z"
                  fill="hsl(var(--primary))"
                  fillOpacity="0.9"
                />
                {/* Wings */}
                <path
                  d="M-2,-1 L0,-5.5 L1.5,-5 L0,-0.5"
                  fill="hsl(var(--primary))"
                  fillOpacity="0.7"
                />
                <path
                  d="M-2,1 L0,5.5 L1.5,5 L0,0.5"
                  fill="hsl(var(--primary))"
                  fillOpacity="0.7"
                />
                {/* Tail */}
                <path
                  d="M-5,-0.8 L-7,-3 L-5.5,-2.8 L-4.5,0"
                  fill="hsl(var(--primary))"
                  fillOpacity="0.5"
                />
                <path
                  d="M-5,0.8 L-7,3 L-5.5,2.8 L-4.5,0"
                  fill="hsl(var(--primary))"
                  fillOpacity="0.5"
                />
              </g>
            </g>
          </g>
        </motion.g>

        {/* Contrails — smooth fading dots */}
        {[0, 1, 2].map(i => (
          <motion.circle
            key={i}
            r="2"
            fill="hsl(var(--primary))"
            animate={{
              cx: [178, 162, 146],
              cy: [87, 91, 96],
              opacity: [0.35, 0.15, 0],
              r: [1.5, 2.5, 3],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay: i * 0.35,
              ease: 'easeOut',
            }}
          />
        ))}

        {/* Destination pins — appear as days complete */}
        {progress > 0 && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <motion.g
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.15, stiffness: 200 }}
            >
              <circle cx="86" cy="82" r="4" fill="hsl(var(--primary))" fillOpacity="0.5" />
              <circle cx="86" cy="82" r="2" fill="hsl(var(--primary))" fillOpacity="0.8" />
            </motion.g>
            {progress > 30 && (
              <motion.g
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.15, stiffness: 200 }}
              >
                <circle cx="116" cy="92" r="4" fill="hsl(var(--primary))" fillOpacity="0.5" />
                <circle cx="116" cy="92" r="2" fill="hsl(var(--primary))" fillOpacity="0.8" />
              </motion.g>
            )}
            {progress > 60 && (
              <motion.g
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.15, stiffness: 200 }}
              >
                <circle cx="96" cy="116" r="4" fill="hsl(var(--primary))" fillOpacity="0.5" />
                <circle cx="96" cy="116" r="2" fill="hsl(var(--primary))" fillOpacity="0.8" />
              </motion.g>
            )}
          </motion.g>
        )}

        {/* Pulsing aura */}
        <motion.circle
          cx="100"
          cy="100"
          r="62"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.12"
          strokeWidth="1.5"
          animate={{ r: [62, 78], opacity: [0.25, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
        />
      </svg>
    </div>
  );
}

export default GenerationAnimation;
