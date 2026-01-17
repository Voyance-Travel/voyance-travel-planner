import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Mail, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Press() {
  return (
    <MainLayout>
      <Head
        title="Press | Voyance"
        description="Press inquiries and media resources for Voyance."
      />
      
      <section className="pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Press & Media
            </h1>
            <p className="text-lg text-muted-foreground">
              Resources and contact information for press inquiries.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-8"
          >
            {/* Contact */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h2 className="text-xl font-semibold text-foreground mb-4">Media Contact</h2>
              <p className="text-muted-foreground mb-4">
                For press inquiries, interviews, or media resources, please reach out to our communications team.
              </p>
              <Button className="gap-2">
                <Mail className="h-4 w-4" />
                press@voyance.ai
              </Button>
            </div>
            
            {/* Brand Assets */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h2 className="text-xl font-semibold text-foreground mb-4">Brand Assets</h2>
              <p className="text-muted-foreground mb-4">
                Download our logo, brand guidelines, and approved imagery for media use.
              </p>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download Press Kit
              </Button>
            </div>
            
            {/* Recent Coverage */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h2 className="text-xl font-semibold text-foreground mb-4">Recent Coverage</h2>
              <p className="text-muted-foreground">
                Press coverage coming soon. Check back for updates.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
