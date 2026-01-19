import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Sparkles, Loader2, AlertCircle, Compass, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ROUTES } from '@/config/routes';

interface SessionDetails {
  status: string;
  paymentStatus: string;
  customerEmail: string;
  amountTotal: number;
  currency: string;
  products: Array<{
    name: string;
    description: string;
    quantity: number;
    amount: number;
    currency: string;
  }>;
  metadata: Record<string, string>;
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionDetails | null>(null);

  useEffect(() => {
    async function fetchSession() {
      if (!sessionId) {
        setError('No session ID found');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-checkout-session', {
          body: { sessionId },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        setSession(data);
      } catch (err) {
        console.error('Failed to fetch session:', err);
        setError('Failed to verify payment');
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [sessionId]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // Determine what type of purchase this was
  const getProductType = () => {
    if (!session) return 'purchase';
    const productName = session.products[0]?.name.toLowerCase() || '';
    if (productName.includes('trip pass')) return 'trip_pass';
    if (productName.includes('monthly')) return 'subscription';
    if (productName.includes('yearly')) return 'subscription';
    if (productName.includes('credit')) return 'credits';
    return 'purchase';
  };

  const productType = getProductType();

  if (loading) {
    return (
      <MainLayout>
        <Head title="Processing Payment | Voyance" />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying your payment...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !session) {
    return (
      <MainLayout>
        <Head title="Payment Error | Voyance" />
        <div className="min-h-screen flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">Payment Verification Failed</h1>
              <p className="text-muted-foreground mb-6">
                {error || 'We couldn\'t verify your payment. Please contact support if you were charged.'}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" asChild>
                  <Link to={ROUTES.PRICING}>Back to Pricing</Link>
                </Button>
                <Button asChild>
                  <Link to={ROUTES.CONTACT}>Contact Support</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head 
        title="Payment Successful | Voyance" 
        description="Your payment was successful. Start planning your next adventure."
      />

      <section className="min-h-screen pt-24 pb-16 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-6"
            >
              <CheckCircle className="h-10 w-10 text-green-500" />
            </motion.div>
            
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
              Payment Successful!
            </h1>
            <p className="text-lg text-muted-foreground">
              Thank you for your purchase. You're all set!
            </p>
          </motion.div>

          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="mb-8">
              <CardContent className="pt-6">
                <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
                
                {session.products.map((product, i) => (
                  <div key={i} className="flex justify-between items-start py-3 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-muted-foreground">{product.description}</p>
                      )}
                    </div>
                    <span className="font-semibold">
                      {formatCurrency(product.amount, product.currency)}
                    </span>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-4 mt-2 border-t">
                  <span className="font-semibold">Total Paid</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(session.amountTotal, session.currency)}
                  </span>
                </div>

                {session.customerEmail && (
                  <p className="text-sm text-muted-foreground mt-4">
                    A confirmation email has been sent to {session.customerEmail}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Next Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">What's Next?</h3>
                    
                    {productType === 'subscription' && (
                      <>
                        <p className="text-muted-foreground mb-4">
                          Your subscription is now active! You have access to all premium features including unlimited itinerary builds, flight & hotel optimization, and group budgeting.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button asChild>
                            <Link to={ROUTES.QUIZ}>
                              <Compass className="mr-2 h-4 w-4" />
                              Start Planning
                            </Link>
                          </Button>
                          <Button variant="outline" asChild>
                            <Link to={ROUTES.PROFILE.VIEW}>
                              View Your Profile
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </>
                    )}

                    {productType === 'trip_pass' && (
                      <>
                        <p className="text-muted-foreground mb-4">
                          Your Trip Pass is ready! You now have unlimited rebuilds, route optimization, and all premium features for this trip.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button asChild>
                            <Link to={ROUTES.TRIP.DASHBOARD}>
                              <MapPin className="mr-2 h-4 w-4" />
                              Go to My Trips
                            </Link>
                          </Button>
                          <Button variant="outline" asChild>
                            <Link to={ROUTES.QUIZ}>
                              Plan a New Trip
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </>
                    )}

                    {productType === 'credits' && (
                      <>
                        <p className="text-muted-foreground mb-4">
                          Your credits have been added to your wallet! Use them to build individual days or optimize your routes.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button asChild>
                            <Link to={ROUTES.PROFILE.VIEW}>
                              View Your Wallet
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </>
                    )}

                    {productType === 'purchase' && (
                      <>
                        <p className="text-muted-foreground mb-4">
                          Your purchase is complete. Start exploring your new features!
                        </p>
                        <Button asChild>
                          <Link to={ROUTES.PROFILE.VIEW}>
                            Continue
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
