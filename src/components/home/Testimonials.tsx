import { motion } from 'framer-motion';

const testimonials = [
  {
    quote: 'It felt like someone planned my dream trip for me — and they nailed it.',
    tag: 'Anonymous beta user, 2025',
  },
  {
    quote: 'I saved 12 hours and booked a better trip. I\'m never planning manually again.',
    tag: 'Anonymous beta user, 2025',
  },
  {
    quote: 'The only AI I\'ve ever used that made my life easier, not harder.',
    tag: 'Anonymous beta user, 2025',
  },
];

export default function Testimonials() {
  return (
    <section className="bg-background py-36 px-6">
      <motion.div
        className="max-w-6xl mx-auto text-center mb-20"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl md:text-4xl font-serif font-semibold text-foreground mb-4">
          The Experience in Their Words
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Discover how Voyance transforms the travel planning experience.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {testimonials.map(({ quote, tag }, index) => (
          <motion.div
            key={index}
            className="p-8 rounded-xl bg-card shadow-md text-left border border-border"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
            whileHover={{
              y: -5,
              boxShadow: '0 15px 30px -10px rgba(0,0,0,0.1)',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="text-muted mb-2"
              fill="currentColor"
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <p className="text-lg italic text-foreground mb-8 leading-relaxed">"{quote}"</p>
            <div className="flex items-center">
              {/* Initial avatar placeholder */}
              <div className="w-8 h-8 rounded-full bg-muted text-xs font-medium text-muted-foreground flex items-center justify-center">
                A
              </div>
              <footer className="ml-4 text-sm font-medium text-muted-foreground">{tag}</footer>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
