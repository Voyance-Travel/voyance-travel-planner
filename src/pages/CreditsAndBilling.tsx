/**
 * Credits & Billing page — manage credits, purchase history, and usage.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coins, Zap, Crown, ArrowLeft, ArrowRight, Clock, Receipt, TrendingDown, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FLEXIBLE_CREDITS, VOYANCE_CLUB_PACKS, formatCredits, CREDIT_EXPIRATION_COPY } from '@/config/pricing';
import { useCredits } from '@/hooks/useCredits';
import { EmbeddedCheckoutModal } from '@/components/checkout/EmbeddedCheckoutModal';
import { ROUTES } from '@/config/routes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';

interface LedgerEntry {
  id: string;
  transaction_type: string;
  action_type: string | null;
  credits_delta: number;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function CreditsAndBilling() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: creditData, isLoading: creditsLoading } = useCredits();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [checkoutConfig, setCheckoutConfig] = useState<{
    priceId: string;
    productId: string;
    credits: number;
    name: string;
  } | null>(null);

  // Fetch recent credit ledger entries
  useEffect(() => {
    if (!user?.id) return;
    setLedgerLoading(true);
    supabase
      .from('credit_ledger')
      .select('id, transaction_type, action_type, credits_delta, notes, metadata, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!error && data) setLedger(data as LedgerEntry[]);
        setLedgerLoading(false);
      });
  }, [user?.id]);

  const handleBuyPack = (pack: { priceId: string; productId: string; credits: number; name: string }) => {
    setCheckoutConfig(pack);
  };

  const totalCredits = creditData?.totalCredits ?? 0;
  const freeCredits = creditData?.effectiveFreeCredits ?? 0;
  const purchasedCredits = creditData?.purchasedCredits ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Back nav */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-2xl sm:text-3xl font-serif font-medium text-foreground mb-2">Credits & Billing</h1>
        <p className="text-muted-foreground mb-8">Manage your credit balance and purchase history.</p>

        {/* Section 1: Credit Balance */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">{formatCredits(totalCredits)}</span>
                  <span className="text-lg text-muted-foreground">credits</span>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Free: <strong className="text-foreground">{formatCredits(freeCredits)}</strong></span>
                  <span>Purchased: <strong className="text-foreground">{formatCredits(purchasedCredits)}</strong></span>
                </div>
                {creditData?.freeCreditsExpired && (
                  <p className="text-xs text-amber-600 mt-1">Your free credits have expired.</p>
                )}
              </div>
              <Button onClick={() => document.getElementById('topup-section')?.scrollIntoView({ behavior: 'smooth' })} className="gap-2">
                <Zap className="h-4 w-4" />
                Top Up
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-4 border-t border-border pt-3">
              {CREDIT_EXPIRATION_COPY.balanceTooltip}
            </p>
          </CardContent>
        </Card>

        {/* Section 2: Quick Top-Up */}
        <div id="topup-section" className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Quick Top-Up
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FLEXIBLE_CREDITS.map((pack, i) => (
              <Card
                key={pack.id}
                className={`relative cursor-pointer transition-all hover:border-primary/40 hover:shadow-md ${
                  i === 1 ? 'border-primary/30 ring-1 ring-primary/20' : ''
                }`}
                onClick={() => handleBuyPack(pack)}
              >
                {i === 1 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-[10px]">POPULAR</Badge>
                  </div>
                )}
                {i === 2 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="secondary" className="text-[10px]">BEST VALUE</Badge>
                  </div>
                )}
                <CardContent className="p-5 text-center">
                  <p className="text-2xl font-bold text-foreground">{formatCredits(pack.credits)}</p>
                  <p className="text-sm text-muted-foreground mb-3">credits</p>
                  <p className="text-xl font-semibold text-foreground">${pack.price}</p>
                  <p className="text-xs text-muted-foreground mt-1">${pack.perCredit}/credit</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Section 3: Voyance Club */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Voyance Club Packs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {VOYANCE_CLUB_PACKS.map((pack) => (
              <Card
                key={pack.id}
                className={`cursor-pointer transition-all hover:border-primary/40 hover:shadow-md ${
                  pack.featured ? 'border-primary/30 ring-1 ring-primary/20' : ''
                }`}
                onClick={() => handleBuyPack({ priceId: pack.priceId, productId: pack.productId, credits: pack.totalCredits, name: pack.name })}
              >
                {pack.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-[10px]">MOST POPULAR</Badge>
                  </div>
                )}
                <CardContent className="p-5 text-center">
                  <p className="text-sm font-semibold text-primary mb-1">{pack.name}</p>
                  <p className="text-2xl font-bold text-foreground">{formatCredits(pack.totalCredits)}</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {formatCredits(pack.baseCredits)} base + {formatCredits(pack.bonusCredits)} bonus
                  </p>
                  <p className="text-xl font-semibold text-foreground">${pack.price}</p>
                  <p className="text-xs text-muted-foreground mt-1">${pack.perCredit}/credit</p>
                  <div className="mt-3 space-y-1">
                    {pack.perks.map((perk) => (
                      <p key={perk} className="text-[11px] text-muted-foreground flex items-center gap-1.5 justify-center">
                        <Sparkles className="h-3 w-3 text-primary shrink-0" />
                        {perk}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            <Link to={ROUTES.PRICING} className="text-primary hover:underline">
              Compare all plans in detail →
            </Link>
          </p>
        </div>

        {/* Section 4: Recent Activity */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Recent Activity
          </h2>
          <Card>
            <CardContent className="p-0">
              {ledgerLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : ledger.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No credit activity yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {ledger.map((entry) => {
                    const isCredit = entry.credits_delta > 0;
                    return (
                      <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg ${isCredit ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                            {isCredit ? (
                              <Coins className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate capitalize">
                              {(entry.action_type || entry.transaction_type).replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })}
                              {entry.notes && ` · ${entry.notes}`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm font-semibold whitespace-nowrap ${
                          isCredit ? 'text-emerald-600' : 'text-foreground'
                        }`}>
                          {isCredit ? '+' : ''}{formatCredits(entry.credits_delta)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

      {/* Embedded Checkout */}
      {checkoutConfig && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutConfig}
          onClose={() => setCheckoutConfig(null)}
          priceId={checkoutConfig.priceId}
          mode="payment"
          productName={`${checkoutConfig.name} - ${formatCredits(checkoutConfig.credits)} Credits`}
          returnPath="/profile/credits"
          productId={checkoutConfig.productId}
          credits={checkoutConfig.credits}
        />
      )}
    </div>
  );
}
