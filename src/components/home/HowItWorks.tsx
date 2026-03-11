import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { handleImageError } from '@/utils/imageFallback';
import step1Image from '@/assets/howitworks-quiz.jpg';
import step2Image from '@/assets/howitworks-step2.jpg';
import step3Image from '@/assets/howitworks-step3.jpg';
import liveTripImage from '@/assets/howitworks-livetrip.jpg';
import communityImage from '@/assets/howitworks-community.jpg';

const STEPS = [
  {
    title: "You take a smart quiz.",
    description: "We learn your travel preferences in 60 seconds.",
    image: step1Image
  },
  {
    title: "You start your way.",
    description: "Pick a city, plan multi-city, chat your dream trip, or paste an existing itinerary. Four ways to begin.",
    image: step2Image
  },
  {
    title: "We build the ideal trip.",
    description: "Flights, stays, and activities pre-selected to match your vibe and budget.",
    image: step3Image
  },
  {
    title: "Live your trip.",
    description: "Your itinerary becomes a day-by-day travel companion with real-time directions, tips, and on-the-fly changes.",
    image: liveTripImage
  },
  {
    title: "Share your story.",
    description: "Turn your experience into a community guide with photos, ratings, and tips for fellow travelers.",
    image: communityImage
  },
  {
    title: "You book and go.",
    description: "Or tweak. Or save. It's all up to you.",
    image: step3Image
  }
];

export default function HowItWorks() {
  const navigate = useNavigate();

  // Special handling for the last item
  const regularSteps = STEPS.slice(0, -1);
  const finalStep = STEPS[STEPS.length - 1];

  // Navigate to the trip planner
  const handleStartPlanning = () => {
    navigate("/start");
  };

  return (
    <section className="bg-background py-24 px-6" id="how-it-works-section">
      {/* Section title */}
      <motion.div
        className="max-w-6xl mx-auto text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-serif font-semibold text-foreground mb-4">
          Simplified Travel Planning
        </h2>
        <p className="text-muted-foreground mx-auto max-w-xl">
          Experience a streamlined approach to planning your perfect getaway
        </p>
      </motion.div>

      {/* Regular alternating steps */}
      {regularSteps.map(({ title, description, image }, index) => (
        <motion.div
          className={`max-w-6xl mx-auto flex flex-col ${
            index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
          } items-center gap-16 mb-36 py-24`}
          key={index}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          {/* Text content */}
          <div className="md:w-1/2 text-center md:text-left">
            <div className="flex items-center mb-6">
              <div className="bg-accent text-accent-foreground w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold mr-3">
                {index + 1}
              </div>
              <h3 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
                {title}
              </h3>
            </div>
            <p className="text-lg text-muted-foreground mt-2 max-w-md leading-relaxed">
              {description}
            </p>
          </div>

          {/* Image */}
          <motion.div
            className="md:w-1/2 mt-8 md:mt-0"
            whileInView={{ scale: [0.95, 1] }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <img
              src={image}
              alt={`Step ${index + 1}: ${title}`}
              className="w-full h-[320px] rounded-xl shadow-xl object-cover hover:shadow-2xl transition-shadow duration-300"
              onError={handleImageError}
            />
          </motion.div>
        </motion.div>
      ))}

      {/* Final step with full-width image and text overlay */}
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
      >
        <div className="relative rounded-xl overflow-hidden shadow-xl">
          <img
            src={finalStep.image}
            alt={`Step ${STEPS.length}: ${finalStep.title}`}
            className="w-full h-[450px] object-cover"
            onError={handleImageError}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent flex flex-col justify-end p-10 md:p-16 text-white">
            <div className="flex items-center mb-6">
              <div className="bg-accent text-accent-foreground w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold mr-3">
                {STEPS.length}
              </div>
              <h3 className="text-3xl md:text-4xl font-serif font-bold">
                {finalStep.title}
              </h3>
            </div>
            <p className="text-lg text-white/90 max-w-md leading-relaxed">
              {finalStep.description}
            </p>
            <motion.button
              className="bg-primary text-primary-foreground font-medium py-3 px-8 rounded-xl hover:bg-primary/90 transition-colors duration-300 shadow-md mt-8 self-start"
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              onClick={handleStartPlanning}
            >
              Start Planning Now
            </motion.button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
