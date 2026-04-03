import { motion } from 'framer-motion';
import { useState } from 'react';
import { Sparkles, Map, Calendar, Plane, ArrowRight } from 'lucide-react';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

const steps = [
  {
    number: '1',
    icon: Sparkles,
    title: 'Take the Travel Quiz',
    description: 'Answer a few questions about how you like to travel. Early riser or late sleeper? Packed schedule or slow mornings? We learn your style.',
    image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800',
  },
  {
    number: '2',
    icon: Map,
    title: 'AI Crafts Your Customized Itinerary',
    description: 'Our AI crafts a personalized day-by-day plan with hotels, activities, restaurants, and hidden gems matched to your preferences.',
    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
  },
  {
    number: '3',
    icon: Calendar,
    title: 'Customize Every Detail',
    description: 'Swap activities, adjust timing, add your own ideas. Lock what you love, regenerate what you don\'t. It\'s your trip.',
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800',
  },
  {
    number: '4',
    icon: Plane,
    title: 'Add Your Flight Details',
    description: 'Book your flights anywhere you like, then add your details here. We\'ll sync your itinerary to your arrival and departure times automatically.',
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800',
  },
];

export default function HowItWorksCarousel() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="py-32 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-4 mb-4"
            >
              <div className="w-8 h-px bg-primary" />
              <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
                The Process
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-foreground"
            >
              How it <em className="font-normal">works</em>
            </motion.h2>
          </div>
          
          {/* Step Navigation - Horizontal Pills */}
          <div className="flex gap-2">
            {steps.map((step, index) => (
              <button
                key={step.number}
                onClick={() => setActiveStep(index)}
                className={`px-4 py-2 text-sm font-sans transition-all duration-300 ${
                  activeStep === index
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {step.number}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content - Asymmetric Layout */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-0">
          {/* Left: Image */}
          <motion.div 
            key={activeStep}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 relative"
          >
            <div className="aspect-[4/3] lg:aspect-[16/12] overflow-hidden relative">
              {/* Animated Ken Burns effect on image */}
              <motion.img
                key={`img-${activeStep}`}
                src={steps[activeStep].image}
                alt={steps[activeStep].title}
                initial={{ scale: 1.1, x: 10 }}
                animate={{ 
                  scale: 1,
                  x: 0,
                }}
                transition={{ 
                  duration: 8,
                  ease: "easeOut"
                }}
                whileHover={{ scale: 1.02 }}
                className="w-full h-full object-cover"
              />
              {/* Subtle continuous pan animation */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
              {/* Overlay with step number */}
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/70 to-transparent">
                <motion.span 
                  key={`num-${activeStep}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-8xl md:text-9xl font-serif text-white/20"
                >
                  {steps[activeStep].number}
                </motion.span>
              </div>
            </div>
          </motion.div>

          {/* Right: Content Panel */}
          <div className="lg:col-span-5 lg:pl-12 flex flex-col justify-center">
            <motion.div
              key={`content-${activeStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                {(() => {
                  const IconComponent = steps[activeStep].icon;
                  return <IconComponent className="w-6 h-6 text-primary" />;
                })()}
              </div>

              {/* Title */}
              <h3 className="text-3xl md:text-4xl font-serif text-foreground mb-4">
                {steps[activeStep].title}
              </h3>

              {/* Description */}
              <p className="text-lg text-muted-foreground font-sans font-light leading-relaxed mb-8">
                {steps[activeStep].description}
              </p>

              {/* Progress Indicator */}
              <div className="flex items-center gap-6">
                <div className="flex gap-1">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1 transition-all duration-300 ${
                        index === activeStep ? 'w-8 bg-primary' : 'w-2 bg-border'
                      }`}
                    />
                  ))}
                </div>
                
                {activeStep < steps.length - 1 && (
                  <button
                    onClick={() => setActiveStep(activeStep + 1)}
                    className="flex items-center gap-2 text-sm text-primary font-sans hover:gap-3 transition-all"
                  >
                    Next step
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>

            {/* All Steps List - Compact */}
            <div className="mt-12 pt-8 border-t border-border">
              <div className="grid grid-cols-2 gap-4">
                {steps.map((step, index) => (
                  <button
                    key={step.number}
                    onClick={() => setActiveStep(index)}
                    className={`text-left p-3 transition-all ${
                      activeStep === index 
                        ? 'bg-secondary' 
                        : 'hover:bg-secondary/50'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground font-sans">{step.number}</span>
                    <p className={`text-sm font-sans mt-1 ${
                      activeStep === index ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {step.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}