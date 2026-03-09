/**
 * Credits & Billing page — manage credits, purchase history, and usage.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Coins, Zap, Crown, ArrowLeft, ArrowRight, Receipt, TrendingDown, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FLEXIBLE_CREDITS, VOYANCE_CLUB_PACKS, formatCredits, CREDIT_EXPIRATION_COPY } from '@/config/pricing';
import { useCredits } from '@/hooks/useCredits';
import { EmbeddedCheckoutModal } from '@/components/checkout/EmbeddedCheckoutModal';
import { ROUTES } from '@/config/routes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import { isIAPAvailable, purchaseByPackId } from '@/services/iapService';
import { useToast } from '@/hooks/use-toast';

interface LedgerEntry {
  id: string;
  transaction_type: string;
  action_type: string | null;
  credits_delta: number;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  trip_id: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  trip_generation: 'Trip Generation',
  unlock_day: 'Day Unlock',
  group_unlock: 'Bulk Day Unlock',
  group_unlock_purchase: 'Group Unlock',
  swap_activity: 'Activity Swap',
  regenerate_day: 'Day Regeneration',
  ai_message: 'AI Message',
  hotel_search: 'Hotel Search',
  restaurant_rec: 'Restaurant Rec',
  smart_finish: 'Smart Finish',
  hotel_optimization: 'Hotel Optimization',
  mystery_getaway: 'Mystery Getaway',
  transport_mode_change: 'Transport Change',
  bonus_welcome: 'Welcome Bonus',
  bonus_launch: 'Early Adopter Bonus',
  bonus_quiz_completion: 'Quiz Completion Bonus',
  refund: 'Refund',
  add_activity: 'Add Activity',
  route_optimization: 'Route Optimization',
  regenerate_trip: 'Trip Regeneration',
  admin_manual_grant: 'Credit Grant',
  monthly_free_grant: 'Monthly Free Credits',
  stripe_purchase: 'Credit Purchase',
  club_purchase: 'Club Credit Pack',
};

const PAGE_SIZE = 20;

export default function CreditsAndBilling() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: creditData, isLoading: creditsLoading } = useCredits();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [summary, setSummary] = useState<{ earned: number; spent: number } | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<{
    priceId: string;
    productId: string;
    credits: number;
    name: string;
  } | null>(null);

  // Fetch recent credit ledger entries + summary
  useEffect(() => {
    if (!user?.id) return;
    setLedgerLoading(true);

    Promise.all([
      supabase
        .from('credit_ledger_safe')
        .select('id, transaction_type, action_type, credits_delta, notes, metadata, trip_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1),
      supabase
        .from('credit_ledger_safe')
        .select('credits_delta')
        .eq('user_id', user.id),
    ]).then(([ledgerRes, summaryRes]) => {
      if (!ledgerRes.error && ledgerRes.data) {
        setHasMore(ledgerRes.data.length > PAGE_SIZE);
        setLedger((ledgerRes.data as LedgerEntry[]).slice(0, PAGE_SIZE));
      }
      if (!summaryRes.error && summaryRes.data) {
        let earned = 0;
        let spent = 0;
        for (const row of summaryRes.data) {
          if (row.credits_delta > 0) earned += row.credits_delta;
          else spent += Math.abs(row.credits_delta);
        }
        setSummary({ earned, spent });
      }
      setLedgerLoading(false);
    });
  }, [user?.id]);

  const loadMore = useCallback(async () => {
    if (!user?.id || !ledger.length || loadingMore) return;
    setLoadingMore(true);
    const lastEntry = ledger[ledger.length - 1];
    const { data, error } = await supabase
      .from('credit_ledger_safe')
      .select('id, transaction_type, action_type, credits_delta, notes, metadata, trip_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .lt('created_at', lastEntry.created_at)
      .limit(PAGE_SIZE + 1);

    if (!error && data) {
      setHasMore(data.length > PAGE_SIZE);
      setLedger(prev => [...prev, ...(data as LedgerEntry[]).slice(0, PAGE_SIZE)]);
    }
    setLoadingMore(false);
  }, [user?.id, ledger, loadingMore]);

  const { toast } = useToast();

  const handleBuyPack = async (pack: { priceId: string; productId: string; credits: number; name: string; id?: string }) => {
    if (isIAPAvailable() && pack.id) {
      const result = await purchaseByPackId(pack.id);
      if (result.success) {
        toast({ title: 'Purchase complete!', description: `${formatCredits(result.credits || pack.credits)} credits added.` });
      } else if (result.error !== 'cancelled') {
        toast({ title: 'Purchase failed', description: result.error || 'Please try again.', variant: 'destructive' });
      }
      return;
    }
    setCheckoutConfig(pack);
  };

  const totalCredits = creditData?.totalCredits ?? 0;
  const freeCredits = creditData?.effectiveFreeCredits ?? 0;
  const purchasedCredits = creditData?.purchasedCredits ?? 0;

  const getEntryLabel = (entry: LedgerEntry): string => {
    const key = entry.action_type || entry.transaction_type;
    return ACTION_LABELS[key] || key.replace(/_/g, ' ');
  };

  const getEntryDescription = (entry: LedgerEntry): string => {
    // Build a helpful description from notes and metadata
    const meta = entry.metadata as Record<string, unknown> | null;
    const parts: string[] = [];

    if (meta?.destination) parts.push(String(meta.destination));
    if (meta?.dayNumber) parts.push(`Day ${meta.dayNumber}`);
    if (meta?.days) parts.push(`${meta.days} days`);
    if (meta?.old_activity && meta?.new_activity) {
      parts.push(`${String(meta.old_activity).split(':')[0]} → ${String(meta.new_activity).split(':')[0]}`);
    }

    if (parts.length > 0) return parts.join(' · ');

    // Fall back to notes (strip the "- X credits" suffix)
    if (entry.notes) {
      const cleaned = entry.notes.replace(/\s*-\s*\d+\s*credits?\s*$/i, '').trim();
      if (cleaned && cleaned !== getEntryLabel(entry).toLowerCase()) return cleaned;
    }

    return '';
  };

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
            {/* Summary bar */}
            {summary && (
              <div className="flex gap-4 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>Total earned: <strong className="text-emerald-600">{formatCredits(summary.earned)}</strong></span>
                <span>Total spent: <strong className="text-foreground">{formatCredits(summary.spent)}</strong></span>
                <span>Remaining: <strong className="text-primary">{formatCredits(totalCredits)}</strong></span>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-3 border-t border-border pt-3">
              {CREDIT_EXPIRATION_COPY.balanceTooltip}
            </p>
          </CardContent>
        </Card>

        {/* Section 2: Credit Activity / Transaction History */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Credit Activity
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
                <>
                  <div className="divide-y divide-border">
                    {ledger.map((entry) => {
                      const isCredit = entry.credits_delta > 0;
                      const isFree = entry.credits_delta === 0;
                      const label = getEntryLabel(entry);
                      const description = getEntryDescription(entry);

                      return (
                        <div key={entry.id} className="flex items-center justify-between px-4 py-3 gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-1.5 rounded-lg shrink-0 ${isCredit ? 'bg-emerald-500/10' : isFree ? 'bg-primary/10' : 'bg-muted'}`}>
                              {isCredit ? (
                                <Coins className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {label}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {new Date(entry.created_at).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                  hour: 'numeric', minute: '2-digit',
                                })}
                                {description && ` · ${description}`}
                              </p>
                            </div>
                          </div>
                          <span className={`text-sm font-semibold whitespace-nowrap ${
                            isCredit ? 'text-emerald-600' : isFree ? 'text-muted-foreground' : 'text-foreground'
                          }`}>
                            {isFree ? 'Free' : `${isCredit ? '+' : '-'}${formatCredits(Math.abs(entry.credits_delta))}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {hasMore && (
                    <div className="border-t border-border px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full gap-2 text-muted-foreground hover:text-foreground"
                        onClick={loadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        Show more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Quick Top-Up */}
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
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Section 4: Voyance Club */}
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
