import { motion } from 'framer-motion';

export default function TravelQuote() {
  return (
    <section className="py-32 bg-gradient-to-br from-secondary/40 via-background to-primary/5 relative overflow-hidden">
      {/* Decorative accents */}
      <div className="absolute top-1/4 left-10 w-32 h-32 bg-gold/10 rounded-full blur-2xl" />
      <div className="absolute bottom-1/4 right-10 w-40 h-40 bg-accent/10 rounded-full blur-2xl" />
      
      <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="w-12 h-[2px] bg-gradient-to-r from-primary/40 via-accent/60 to-gold/40 mx-auto mb-12" />
          
          <blockquote className="text-2xl md:text-4xl font-display font-light text-foreground mb-8 leading-relaxed italic">
            "The world is a book, and those who do not travel read only one page."
          </blockquote>
          
          <p className="text-sm tracking-widest uppercase text-accent font-medium">
            Saint Augustine
          </p>
          
          <div className="w-12 h-[2px] bg-gradient-to-r from-gold/40 via-accent/60 to-primary/40 mx-auto mt-12" />
        </motion.div>
      </div>
    </section>
  );
}
