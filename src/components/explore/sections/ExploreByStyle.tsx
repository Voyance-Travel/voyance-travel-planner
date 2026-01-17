import { motion } from 'framer-motion';
import { Sparkles, Mountain, Palette, Wine, Heart, Compass } from 'lucide-react';

const styles = [
  { id: 'luxury', label: 'Luxury', icon: Sparkles, color: 'text-amber-500' },
  { id: 'adventure', label: 'Adventure', icon: Mountain, color: 'text-emerald-500' },
  { id: 'culture', label: 'Culture', icon: Palette, color: 'text-violet-500' },
  { id: 'foodie', label: 'Foodie', icon: Wine, color: 'text-rose-500' },
  { id: 'romance', label: 'Romance', icon: Heart, color: 'text-pink-500' },
  { id: 'explorer', label: 'Explorer', icon: Compass, color: 'text-blue-500' },
];

export default function ExploreByStyle() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
            Explore by Travel Style
          </h2>
          <p className="text-muted-foreground">
            Find destinations that match your travel personality
          </p>
        </motion.div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {styles.map((style, index) => (
            <motion.button
              key={style.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group flex flex-col items-center p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className={`p-3 rounded-full bg-muted group-hover:bg-primary/10 transition-colors mb-3`}>
                <style.icon className={`h-6 w-6 ${style.color}`} />
              </div>
              <span className="text-sm font-medium text-foreground">
                {style.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
