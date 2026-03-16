import { useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';

export default function Privacy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const lastUpdated = 'March 16, 2026';

  return (
    <MainLayout>
      <Head
        title="Privacy Policy | Voyance"
        description="Voyance privacy policy and data usage practices."
      />
      
      <section className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl shadow-sm p-6 md:p-8"
          >
            <h1 className="text-3xl font-display font-bold text-foreground mb-6">Privacy Policy</h1>

            <div className="mb-8 text-sm text-muted-foreground">Last Updated: {lastUpdated}</div>

            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                At Voyance, we are committed to protecting your privacy and ensuring the security of
                your personal information. This Privacy Policy explains how we collect, use, disclose,
                and safeguard your information when you use our service.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
              <p>We collect several types of information from and about users of our Service:</p>
              <ul className="list-disc ml-6 mb-4">
                <li>
                  <strong>Personal Information:</strong> Name, email address, phone number, postal
                  address, payment information, and travel preferences.
                </li>
                <li>
                  <strong>Profile Information:</strong> Data you provide when creating an account or
                  completing your profile, such as profile picture, home airport, and travel
                  preferences.
                </li>
                <li>
                  <strong>Trip Information:</strong> Data about your travel plans, bookings, searches,
                  and itineraries.
                </li>
                <li>
                  <strong>Usage Data:</strong> Information about how you interact with our Service,
                  including the features you use, pages you visit, and actions you take.
                </li>
                <li>
                  <strong>Device Information:</strong> Information about your device, browser, IP
                  address, and operating system.
                </li>
                <li>
                  <strong>Cookies and Similar Technologies:</strong> We use cookies and similar
                  tracking technologies to enhance your experience, analyze usage patterns, and
                  provide personalized content.
                </li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
              <p>We use the information we collect for various purposes, including:</p>
              <ul className="list-disc ml-6 mb-4">
                <li>Providing and maintaining our Service</li>
                <li>Personalizing your experience and generating travel recommendations</li>
                <li>Processing and managing your bookings and payments</li>
                <li>
                  Communicating with you about your account, bookings, and updates to our Service
                </li>
                <li>
                  Improving our Service, including analyzing usage patterns and developing new
                  features
                </li>
                <li>
                  Detecting, preventing, and addressing technical issues, fraud, or illegal activities
                </li>
                <li>Complying with legal obligations</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">
                3. Information Sharing and Disclosure
              </h2>
              <p>
                We do not sell, trade, or otherwise transfer your personal information to third
                parties without your consent, except as described in this Privacy Policy:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li>
                  <strong>Service Providers:</strong> We may share information with trusted
                  third-party service providers who assist us in operating our Service, conducting
                  business, or serving you.
                </li>
                <li>
                  <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale
                  of assets, your information may be transferred.
                </li>
                <li>
                  <strong>Legal Requirements:</strong> We may disclose information when required by
                  law or to protect our rights, property, or safety.
                </li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Security</h2>
              <p>
                We implement appropriate security measures to protect your personal information
                against unauthorized access, alteration, disclosure, or destruction. However, no
                method of transmission over the internet or electronic storage is 100% secure.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">5. Your Rights and Choices</h2>
              <p>You have the right to:</p>
              <ul className="list-disc ml-6 mb-4">
                <li>Access, update, or delete your personal information</li>
                <li>Opt out of marketing communications</li>
                <li>Request data portability</li>
                <li>Object to processing of your personal information</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">6. Data Retention</h2>
              <p>
                We retain your personal information only as long as necessary to fulfill the purposes
                outlined in this Privacy Policy, unless a longer retention period is required by law.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">7. Children's Privacy</h2>
              <p>
                Our Service is not intended for children under the age of 13. We do not knowingly
                collect personal information from children under 13.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">8. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes
                by posting the new Privacy Policy on this page and updating the "Last
                Updated" date.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">9. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy or our data practices, please
                contact us at:
              </p>
              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="mb-2">
                  <strong>Email:</strong> contact@travelwithvoyance.com
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
