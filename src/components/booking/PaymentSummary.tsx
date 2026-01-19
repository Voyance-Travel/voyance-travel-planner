/**
 * Payment Summary Component
 * Shows paid vs outstanding amounts for a trip
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  Check, 
  Clock, 
  Plane, 
  Hotel, 
  Calendar,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  TripPayment, 
  PaymentTotals,
  getTripPayments, 
  formatCurrency, 
  getStatusLabel,
  getStatusColor 
} from '@/services/tripPaymentsAPI';

interface PaymentSummaryProps {
  tripId: string;
  className?: string;
  onPaymentClick?: (payment: TripPayment) => void;
}

const itemTypeIcons = {
  flight: Plane,
  hotel: Hotel,
  activity: Calendar,
};

export function PaymentSummary({ tripId, className, onPaymentClick }: PaymentSummaryProps) {
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [totals, setTotals] = useState<PaymentTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    
    const result = await getTripPayments(tripId);
    
    if (result.success) {
      setPayments(result.payments || []);
      setTotals(result.totals || null);
    } else {
      setError(result.error || 'Failed to load payments');
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (tripId) {
      fetchPayments();
    }
  }, [tripId]);

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPayments} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const paidPayments = payments.filter(p => p.status === 'paid');
  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'processing');

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Summary
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchPayments}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totals */}
        {totals && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Check className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Paid</span>
              </div>
              <p className="text-xl font-bold text-green-700">
                {formatCurrency(totals.paid)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Outstanding</span>
              </div>
              <p className="text-xl font-bold text-amber-700">
                {formatCurrency(totals.pending)}
              </p>
            </div>
          </div>
        )}

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No payments recorded yet. Book flights, hotels, or activities to track payments.
          </p>
        ) : (
          <>
            <Separator />

            {/* Paid Items */}
            {paidPayments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  Paid ({paidPayments.length})
                </h4>
                <div className="space-y-2">
                  {paidPayments.map((payment) => {
                    const Icon = itemTypeIcons[payment.item_type];
                    return (
                      <div 
                        key={payment.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/10"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">{payment.item_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-green-600">
                            {formatCurrency(payment.amount_cents * payment.quantity, payment.currency)}
                          </span>
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                            Paid ✓
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending Items */}
            {pendingPayments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-amber-600 mb-2 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Outstanding ({pendingPayments.length})
                </h4>
                <div className="space-y-2">
                  {pendingPayments.map((payment) => {
                    const Icon = itemTypeIcons[payment.item_type];
                    return (
                      <div 
                        key={payment.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-secondary/50 transition-colors",
                          payment.status === 'processing' 
                            ? "bg-amber-500/5 border-amber-500/20" 
                            : "bg-muted/50 border-border"
                        )}
                        onClick={() => onPaymentClick?.(payment)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{payment.item_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {formatCurrency(payment.amount_cents * payment.quantity, payment.currency)}
                          </span>
                          <Badge variant="outline" className={cn(getStatusColor(payment.status))}>
                            {getStatusLabel(payment.status)}
                          </Badge>
                          {payment.external_booking_url && (
                            <a 
                              href={payment.external_booking_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Total */}
        {totals && totals.total > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-medium text-muted-foreground">Trip Total</span>
              <span className="text-lg font-bold">{formatCurrency(totals.total)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
