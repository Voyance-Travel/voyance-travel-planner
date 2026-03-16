import { useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';

export default function Terms() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const lastUpdated = 'March 16, 2026';

  return (
    <MainLayout>
      <Head
        title="Terms of Service | Voyance"
        description="Voyance terms of service and usage guidelines."
      />
      
      <section className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl shadow-sm p-6 md:p-8"
          >
            <h1 className="text-3xl font-display font-bold text-foreground mb-6">Terms of Service</h1>

            <div className="mb-8 text-sm text-muted-foreground">Last Updated: {lastUpdated}</div>

            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                Welcome to Voyance. By accessing or using our service, you agree to be bound by these
                Terms of Service ("Terms"). Please read them carefully.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">1. Eligibility</h2>
              <p>
                You must be at least 18 years old to use Voyance. By agreeing to these Terms, you
                represent and warrant that:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li>You are at least 18 years of age</li>
                <li>You have the legal capacity to enter into binding contracts</li>
                <li>You will provide valid identification if required for booking</li>
                <li>
                  You will comply with these Terms and all applicable local, state, national, and
                  international laws, rules, and regulations
                </li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">2. Service Description</h2>
              <p>
                Voyance provides an AI-powered travel planning and booking platform that helps users
                discover, plan, and book travel experiences. Our services include:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li>Personalized travel recommendations based on user preferences</li>
                <li>Flight and accommodation search and booking</li>
                <li>Itinerary creation and management</li>
                <li>Travel information and resources</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">3. Booking Conditions</h2>
              <p>When you make a booking through Voyance:</p>
              <ul className="list-disc ml-6 mb-4">
                <li>
                  You acknowledge that AI-generated itineraries are recommendations and not guarantees
                </li>
                <li>You accept responsibility for verifying all details before booking</li>
                <li>
                  You understand that Voyance acts as an intermediary between you and travel service
                  providers
                </li>
                <li>
                  You agree to comply with the terms and conditions of the travel service providers
                </li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">4. Price Accuracy</h2>
              <p>While we strive to provide accurate pricing information:</p>
              <ul className="list-disc ml-6 mb-4">
                <li>
                  Prices are subject to change due to currency fluctuations, taxes, or other factors
                </li>
                <li>
                  We rely on third-party APIs for pricing data which may occasionally contain errors
                </li>
                <li>The final price will be confirmed at the time of booking</li>
                <li>Special offers and promotions may have additional terms and limitations</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">5. User Accounts</h2>
              <p>
                To use certain features of our Service, you must create an account and provide
                accurate information. You are responsible for:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Immediately notifying us of any unauthorized use of your account</li>
                <li>Ensuring your account information remains current and accurate</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">6. License to Use</h2>
              <p>
                Subject to these Terms, Voyance grants you a limited, non-exclusive, non-transferable
                license to access and use our Service for personal, non-commercial purposes. This
                license does not include the right to:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li>Use data mining, robots, or similar data gathering methods</li>
                <li>
                  Modify, create derivative works, distribute, or reverse engineer any portion of the
                  Service
                </li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Resell or commercially exploit the Service or its content</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">7. User Conduct</h2>
              <p>You agree not to:</p>
              <ul className="list-disc ml-6 mb-4">
                <li>Violate any laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Submit false or misleading information</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">8. Cancellations and Refunds</h2>
              <p>
                Cancellation and refund policies vary by travel service provider. Voyance is not
                responsible for processing refunds for bookings made through third-party providers.
                You should review the cancellation and refund policies of each travel service provider
                before making a booking.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">9. Intellectual Property</h2>
              <p>
                The Service and its original content, features, and functionality are owned by Voyance
                and are protected by international copyright, trademark, and other intellectual
                property laws. You may not use our trademarks or logos without our prior written
                consent.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">10. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Voyance shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages, including but not limited to
                loss of profits, data, use, or goodwill, resulting from:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li>Your access to or use of or inability to access or use the Service</li>
                <li>Any conduct or content of any third party on the Service</li>
                <li>Any content obtained from the Service</li>
                <li>Unauthorized access, use, or alteration of your transmissions or content</li>
              </ul>

              <h2 className="text-xl font-semibold mt-8 mb-4">11. Modifications</h2>
              <p>
                We reserve the right to modify or replace these Terms at any time. We will provide
                notice of significant changes to the Terms by posting the new Terms on our website or
                through the Service. Your continued use of the Service after such modifications
                constitutes your acceptance of the revised Terms.
              </p>

              <h2 className="text-xl font-semibold mt-8 mb-4">12. Contact</h2>
              <p>If you have any questions about these Terms, please contact us at:</p>
              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="mb-0">
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
