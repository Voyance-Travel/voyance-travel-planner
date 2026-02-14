import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Receipt,
  Banknote,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, isPast, differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { toast } from 'sonner';

interface ClientTrip {
  id: string;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  pipelineStage: number | null;
  totalCost: number;
  totalPaid: number;
  hasItinerary: boolean;
  shareToken: string | null;
  agent: any;
}

interface PaymentSchedule {
  id: string;
  tripId: string;
  tripName: string;
  description: string;
  amountCents: number;
  dueDate: string;
  isPaid: boolean;
  paidAt: string | null;
}

interface Payment {
  id: string;
  tripId: string;
  tripName: string;
  amountCents: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
}

interface ClientPaymentSectionProps {
  trips: ClientTrip[];
  onPaymentComplete?: () => void;
}

export default function ClientPaymentSection({ trips, onPaymentComplete }: ClientPaymentSectionProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentData();
  }, [trips]);

  const loadPaymentData = async () => {
    if (trips.length === 0) {
      setLoading(false);
      return;
    }

    const tripIds = trips.map(t => t.id);

    try {
      // Fetch payment schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('agency_payment_schedules')
        .select('*')
        .in('trip_id', tripIds)
        .order('due_date');

      if (schedulesError) throw schedulesError;

      const mappedSchedules: PaymentSchedule[] = (schedulesData || []).map(s => ({
        id: s.id,
        tripId: s.trip_id,
        tripName: trips.find(t => t.id === s.trip_id)?.name || 'Trip',
        description: s.description,
        amountCents: s.amount_cents,
        dueDate: s.due_date,
        isPaid: s.is_paid || false,
        paidAt: s.paid_at,
      }));

      setSchedules(mappedSchedules);

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('agency_payments')
        .select('*')
        .in('trip_id', tripIds)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      const mappedPayments: Payment[] = (paymentsData || []).map(p => ({
        id: p.id,
        tripId: p.trip_id,
        tripName: trips.find(t => t.id === p.trip_id)?.name || 'Trip',
        amountCents: p.amount_cents,
        paymentMethod: p.payment_method,
        paymentDate: p.payment_date,
        status: p.status || 'completed',
      }));

      setPayments(mappedPayments);
    } catch (error) {
      console.error('Failed to load payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const handleMakePayment = async (tripId: string, amount: number) => {
    setProcessingPayment(tripId);
    
    try {
      // Call the create-checkout edge function
      const { data, error } = await supabase.functions.invoke('create-agency-checkout', {
        body: {
          tripId,
          amount,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
      toast.error('Failed to initiate payment. Please contact your travel agent.');
    } finally {
      setProcessingPayment(null);
    }
  };

  // Calculate totals
  const totalOwed = trips.reduce((sum, t) => sum + (t.totalCost - t.totalPaid), 0);
  const totalPaid = trips.reduce((sum, t) => sum + t.totalPaid, 0);
  const pendingSchedules = schedules.filter(s => !s.isPaid);
  const overdueSchedules = pendingSchedules.filter(s => isPast(new Date(s.dueDate)));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Paid</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>

        <Card className={totalOwed > 0 ? 'border-amber-200' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Balance Due</span>
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
            <p className={`text-2xl font-bold ${totalOwed > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {formatCurrency(totalOwed)}
            </p>
          </CardContent>
        </Card>

        <Card className={overdueSchedules.length > 0 ? 'border-red-200 bg-red-50/50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Upcoming Payments</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{pendingSchedules.length}</p>
            {overdueSchedules.length > 0 && (
              <Badge variant="destructive" className="mt-1">
                {overdueSchedules.length} overdue
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trip Payment Status */}
      {trips.filter(t => t.totalCost > 0).map(trip => {
        const tripSchedules = schedules.filter(s => s.tripId === trip.id);
        const nextPayment = tripSchedules.find(s => !s.isPaid);
        const progress = trip.totalCost > 0 ? Math.round((trip.totalPaid / trip.totalCost) * 100) : 0;

        return (
          <Card key={trip.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{trip.name}</CardTitle>
                  <CardDescription>
                    {trip.destination}
                    {trip.startDate && ` • ${format(parseLocalDate(trip.startDate), 'MMM d, yyyy')}`}
                  </CardDescription>
                </div>
                <Badge variant={trip.totalPaid >= trip.totalCost ? 'default' : 'outline'}>
                  {trip.totalPaid >= trip.totalCost ? 'Paid in Full' : `${progress}% Paid`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Progress</span>
                  <span className="font-medium">
                    {formatCurrency(trip.totalPaid)} / {formatCurrency(trip.totalCost)}
                  </span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>

              {/* Payment Schedule */}
              {tripSchedules.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Payment Schedule</h4>
                  <div className="space-y-2">
                    {tripSchedules.map(schedule => {
                      const isOverdue = !schedule.isPaid && isPast(new Date(schedule.dueDate));
                      const daysUntil = differenceInDays(new Date(schedule.dueDate), new Date());

                      return (
                        <div 
                          key={schedule.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            schedule.isPaid 
                              ? 'bg-emerald-50 border-emerald-200'
                              : isOverdue
                                ? 'bg-red-50 border-red-200'
                                : 'bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {schedule.isPaid ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            ) : isOverdue ? (
                              <AlertCircle className="h-5 w-5 text-red-600" />
                            ) : (
                              <Clock className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium">{schedule.description}</p>
                              <p className="text-sm text-muted-foreground">
                                {schedule.isPaid 
                                  ? `Paid ${schedule.paidAt ? format(new Date(schedule.paidAt), 'MMM d') : ''}`
                                  : isOverdue 
                                    ? `Was due ${format(new Date(schedule.dueDate), 'MMM d')}`
                                    : daysUntil === 0
                                      ? 'Due today'
                                      : daysUntil === 1
                                        ? 'Due tomorrow'
                                        : `Due in ${daysUntil} days`
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className={`font-bold ${schedule.isPaid ? 'text-emerald-600' : ''}`}>
                              {formatCurrency(schedule.amountCents)}
                            </p>
                            {!schedule.isPaid && (
                              <Button 
                                size="sm"
                                onClick={() => handleMakePayment(trip.id, schedule.amountCents)}
                                disabled={processingPayment === trip.id}
                              >
                                {processingPayment === trip.id ? 'Processing...' : 'Pay Now'}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Make a Payment button for trips without schedule */}
              {tripSchedules.length === 0 && trip.totalCost > trip.totalPaid && (
                <Button 
                  className="w-full"
                  onClick={() => handleMakePayment(trip.id, trip.totalCost - trip.totalPaid)}
                  disabled={processingPayment === trip.id}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {processingPayment === trip.id ? 'Processing...' : `Pay Balance (${formatCurrency(trip.totalCost - trip.totalPaid)})`}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* No Payments Needed */}
      {trips.filter(t => t.totalCost > 0).length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Payments Due</h3>
            <p className="text-muted-foreground">
              Your travel agent will add payment details when your trip is ready
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map(payment => (
                <div 
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium">{payment.tripName}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(payment.paymentDate), 'MMM d, yyyy')} • {payment.paymentMethod.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-emerald-600">
                    +{formatCurrency(payment.amountCents)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
