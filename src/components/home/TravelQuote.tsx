import { motion } from 'framer-motion';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';

export default function TravelQuote() {
  return (
    <section className="relative py-16 sm:py-24 md:py-32 overflow-hidden">
      {/* Full-width background image */}
      <div className="absolute inset-0">
        <img
          src={toSiteImageUrlFromPhotoId('photo-1682687982501-1e58ab814714')}
          alt="Inspirational landscape"
          className="w-full h-full object-cover"
          onError={(e) => { const t = e.currentTarget; if (!t.dataset.fallbackApplied) { t.dataset.fallbackApplied = 'true'; t.style.display = 'none'; } }}
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-8 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center text-white"
        >
          {/* Large decorative quote mark */}
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="block text-[8rem] sm:text-[12rem] md:text-[16rem] font-serif leading-none text-white/10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
          >
            "
          </motion.span>

          {/* Quote text */}
          <blockquote className="relative">
            <p className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-serif font-normal leading-snug mb-8 sm:mb-12">
              The real voyage of discovery consists not in seeking new landscapes, 
              but in having <em>new eyes.</em>
            </p>
          </blockquote>

          {/* Attribution with decorative elements */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-16 h-px bg-white/30" />
            <span className="text-sm tracking-[0.3em] uppercase text-white/60 font-sans">
              Marcel Proust
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Side decorative elements */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden lg:block">
        <div className="w-px h-32 bg-white/20" />
      </div>
      <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block">
        <div className="w-px h-32 bg-white/20" />
      </div>
    </section>
  );
}