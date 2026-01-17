import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';

export default function Privacy() {
  return (
    <MainLayout>
      <Head
        title="Privacy Policy | Voyance"
        description="Voyance privacy policy - how we collect, use, and protect your data."
      />
      
      <section className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-display font-bold text-foreground mb-4">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground mb-8">
              Last updated: January 2025
            </p>
            
            <div className="prose prose-gray max-w-none">
              <h2>1. Information We Collect</h2>
              <p>
                We collect information you provide directly to us, including your name, 
                email address, and travel preferences when you create an account or use our services.
              </p>
              
              <h2>2. How We Use Your Information</h2>
              <p>
                We use the information we collect to provide, maintain, and improve our services, 
                including personalizing your travel recommendations and itineraries.
              </p>
              
              <h2>3. Information Sharing</h2>
              <p>
                We do not sell, trade, or otherwise transfer your personal information to outside parties 
                without your consent, except as described in this policy.
              </p>
              
              <h2>4. Data Security</h2>
              <p>
                We implement appropriate security measures to protect your personal information 
                against unauthorized access, alteration, disclosure, or destruction.
              </p>
              
              <h2>5. Your Rights</h2>
              <p>
                You have the right to access, update, or delete your personal information at any time. 
                You can do this through your account settings or by contacting us.
              </p>
              
              <h2>6. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at privacy@voyance.ai.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
