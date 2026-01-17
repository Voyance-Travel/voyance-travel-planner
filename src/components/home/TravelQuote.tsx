import { motion } from 'framer-motion';

export default function TravelQuote() {
  return (
    <section className="py-32 bg-muted/20">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="w-12 h-[1px] bg-foreground/20 mx-auto mb-12" />
          
          <blockquote className="text-2xl md:text-4xl font-display font-light text-foreground mb-8 leading-relaxed italic">
            "The world is a book, and those who do not travel read only one page."
          </blockquote>
          
          <p className="text-sm tracking-widest uppercase text-muted-foreground">
            Saint Augustine
          </p>
          
          <div className="w-12 h-[1px] bg-foreground/20 mx-auto mt-12" />
        </motion.div>
      </div>
    </section>
  );
}
