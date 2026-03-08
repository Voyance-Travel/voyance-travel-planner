import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Mail, Download, Building2, Globe, FileText, Palette, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import { CONTACT_CONFIG } from '@/config/contact';
import { 
  generatePressKitPDF, 
  companyInfo, 
  keyStats,
  platformCapabilities
} from '@/utils/pressKitGenerator';

export default function Press() {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPressKit = async () => {
    setIsGenerating(true);
    try {
      await generatePressKitPDF();
      toast.success('Press kit downloaded successfully!');
    } catch (error) {
      console.error('Error generating press kit:', error);
      toast.error('Failed to generate press kit. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <MainLayout>
      <Head
        title="Press | Voyance"
        description="Press inquiries, media resources, and company information for Voyance."
      />
      
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <FileText className="w-16 h-16 mx-auto mb-6 text-primary" />
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Press & Media
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Resources, brand assets, and contact information for media inquiries
            </p>
          </motion.div>
        </div>
      </section>

      {/* Company Overview */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* About */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-semibold mb-4">About Voyance</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {companyInfo.mission}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-card border border-border rounded-xl">
                  <Building2 className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Founded</p>
                  <p className="font-semibold">{companyInfo.founded}</p>
                </div>
                <div className="p-4 bg-card border border-border rounded-xl">
                  <Globe className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Headquarters</p>
                  <p className="font-semibold">{companyInfo.headquarters}</p>
                </div>
              </div>
            </motion.div>

            {/* Key Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-2xl font-semibold mb-4">By the Numbers</h2>
              <div className="grid grid-cols-2 gap-4">
                {keyStats.map((stat, index) => (
                  <div 
                    key={stat.label}
                    className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border border-border rounded-xl"
                  >
                    <p className="text-2xl font-bold text-primary">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">What Makes Each Itinerary Unique</h2>
            <p className="text-muted-foreground">
              Our platform combines multiple AI systems to create truly personalized travel experiences
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-4">
            {platformCapabilities.map((capability, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 bg-card border border-border rounded-xl"
              >
                <p className="text-sm text-foreground">{capability}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Download & Contact */}
      <section className="py-16 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Press Kit Download */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 bg-card border border-border rounded-2xl text-center"
            >
              <Palette className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Press Kit</h3>
              <p className="text-muted-foreground mb-6">
                Download our complete press kit including logos, brand guidelines, company facts, and leadership bios.
              </p>
              <Button 
                size="lg" 
                onClick={handleDownloadPressKit}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download Press Kit (PDF)
                  </>
                )}
              </Button>
            </motion.div>

            {/* Media Contact */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-8 bg-card border border-border rounded-2xl text-center"
            >
              <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Media Contact</h3>
              <p className="text-muted-foreground mb-6">
                For press inquiries, interviews, speaking opportunities, or additional materials.
              </p>
              <Button size="lg" variant="outline" asChild className="gap-2">
                <a href="mailto:contact@travelwithvoyance.com">
                  <Mail className="h-4 w-4" />
                  contact@travelwithvoyance.com
                </a>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Usage Guidelines */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-semibold mb-4">Usage Guidelines</h2>
          <p className="text-muted-foreground mb-8">
            When using Voyance brand assets, please adhere to our brand guidelines. For any questions about usage or to request custom assets, please contact our press team.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="font-medium text-green-600 dark:text-green-400 mb-2">✓ Do</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use official logos from the press kit</li>
                <li>• Maintain logo proportions</li>
                <li>• Use brand colors consistently</li>
                <li>• Credit Voyance when referencing data</li>
              </ul>
            </div>
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="font-medium text-red-600 dark:text-red-400 mb-2">✗ Don't</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Alter logo colors or proportions</li>
                <li>• Use outdated brand assets</li>
                <li>• Imply endorsement without permission</li>
                <li>• Use assets for commercial purposes</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
