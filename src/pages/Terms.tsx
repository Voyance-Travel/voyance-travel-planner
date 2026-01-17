import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';

export default function Terms() {
  return (
    <MainLayout>
      <Head
        title="Terms of Service | Voyance"
        description="Voyance terms of service - the rules and guidelines for using our platform."
      />
      
      <section className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-display font-bold text-foreground mb-4">
              Terms of Service
            </h1>
            <p className="text-muted-foreground mb-8">
              Last updated: January 2025
            </p>
            
            <div className="prose prose-gray max-w-none">
              <h2>1. Acceptance of Terms</h2>
              <p>
                By accessing and using Voyance, you accept and agree to be bound by the terms 
                and provision of this agreement.
              </p>
              
              <h2>2. Use of Service</h2>
              <p>
                You agree to use Voyance only for lawful purposes and in accordance with these Terms. 
                You agree not to use the service in any way that could damage or impair the service.
              </p>
              
              <h2>3. Account Registration</h2>
              <p>
                To access certain features, you must register for an account. You agree to provide 
                accurate information and keep your account credentials secure.
              </p>
              
              <h2>4. Intellectual Property</h2>
              <p>
                All content on Voyance, including text, graphics, logos, and software, is the property 
                of Voyance and protected by intellectual property laws.
              </p>
              
              <h2>5. Limitation of Liability</h2>
              <p>
                Voyance shall not be liable for any indirect, incidental, special, consequential, 
                or punitive damages resulting from your use of the service.
              </p>
              
              <h2>6. Changes to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. We will notify you of any 
                changes by posting the new terms on this page.
              </p>
              
              <h2>7. Contact Us</h2>
              <p>
                If you have any questions about these Terms, please contact us at legal@voyance.ai.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
