import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Briefcase, 
  User, 
  FileText, 
  CreditCard, 
  MapPin,
  Calendar,
  Plane,
  Hotel,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  MessageSquare,
  Phone,
  Mail,
  AlertCircle,
  ChevronRight,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import ClientIntakeSection from './ClientIntakeSection';
import ClientPaymentSection from './ClientPaymentSection';

interface AgentInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  businessName?: string;
}

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
  agent: AgentInfo | null;
}

interface PendingQuote {
  id: string;
  tripId: string;
  tripName: string;
  name: string | null;
  totalCents: number;
  status: string | null;
  expiresAt: string | null;
  lineItems: any[];
}

export default function ClientAgentPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trips');
  const [trips, setTrips] = useState<ClientTrip[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<PendingQuote[]>([]);
  const [hasAgentRelationship, setHasAgentRelationship] = useState(false);

  useEffect(() => {
    if (user?.email) {
      loadClientData();
    }
  }, [user?.email]);

  const loadClientData = async () => {
    if (!user?.email) return;
    setLoading(true);

    try {
      // Find accounts where user email matches billing_email
      // This links the consumer user to their agent's client record
      const { data: accounts, error: accountsError } = await supabase
        .from('agency_accounts')
        .select(`
          id,
          name,
          billing_email,
          agent_id
        `)
        .eq('billing_email', user.email);

      if (accountsError) throw accountsError;

      if (!accounts || accounts.length === 0) {
        setHasAgentRelationship(false);
        setLoading(false);
        return;
      }

      setHasAgentRelationship(true);
      const accountIds = accounts.map(a => a.id);

      // Fetch trips for these accounts
      const { data: tripsData, error: tripsError } = await supabase
        .from('agency_trips')
        .select(`
          id,
          name,
          destination,
          start_date,
          end_date,
          status,
          pipeline_stage,
          total_cost_cents,
          total_paid_cents,
          itinerary_data,
          share_token,
          share_enabled,
          agent_id
        `)
        .in('account_id', accountIds)
        .order('created_at', { ascending: false });

      if (tripsError) throw tripsError;

      // Get agent info for each unique agent
      const agentIds = [...new Set((tripsData || []).map(t => t.agent_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', agentIds);

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('user_id, agent_business_name, agent_business_email')
        .in('user_id', agentIds);

      const agentMap = new Map<string, AgentInfo>();
      (profiles || []).forEach(p => {
        const pref = (prefs as any[])?.find(pr => pr.user_id === p.id);
        agentMap.set(p.id, {
          id: p.id,
          name: p.display_name || 'Your Travel Agent',
          businessName: pref?.agent_business_name || undefined,
          email: pref?.agent_business_email || undefined,
        });
      });

      const mappedTrips: ClientTrip[] = (tripsData || []).map(t => ({
        id: t.id,
        name: t.name,
        destination: t.destination,
        startDate: t.start_date,
        endDate: t.end_date,
        status: t.status,
        pipelineStage: t.pipeline_stage,
        totalCost: t.total_cost_cents || 0,
        totalPaid: t.total_paid_cents || 0,
        hasItinerary: !!(t.itinerary_data as any)?.days?.length,
        shareToken: t.share_enabled ? t.share_token : null,
        agent: agentMap.get(t.agent_id) || null,
      }));

      setTrips(mappedTrips);

      // Fetch pending quotes that need approval
      const tripIds = (tripsData || []).map(t => t.id);
      if (tripIds.length > 0) {
        const { data: quotesData } = await supabase
          .from('agency_quotes')
          .select(`
            id,
            trip_id,
            name,
            total_cents,
            status,
            expires_at,
            line_items,
            is_current_version
          `)
          .in('trip_id', tripIds)
        .eq('is_current_version', true)
        .eq('status', 'sent');

        const mappedQuotes: PendingQuote[] = (quotesData || []).map(q => {
          const trip = tripsData?.find(t => t.id === q.trip_id);
          return {
            id: q.id,
            tripId: q.trip_id,
            tripName: trip?.name || 'Trip',
            name: q.name,
            totalCents: q.total_cents || 0,
            status: q.status,
            expiresAt: q.expires_at,
            lineItems: (q.line_items as any[]) || [],
          };
        });

        setPendingQuotes(mappedQuotes);
      }
    } catch (error) {
      console.error('Failed to load client data:', error);
      toast.error('Failed to load your travel agent information');
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

  const handleApproveQuote = async (quoteId: string) => {
    try {
      const { error } = await supabase
        .from('agency_quotes')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (error) throw error;

      toast.success('Quote approved! Your travel agent will be notified.');
      loadClientData();
    } catch (error) {
      toast.error('Failed to approve quote');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!hasAgentRelationship) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Briefcase className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Travel Agent Connected</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            If you're working with a travel agent, they'll add you as a client using your email address. 
            Once connected, you'll see your trips, quotes, and payment information here.
          </p>
          <Button variant="outline" asChild>
            <Link to="/start">
              <Plane className="h-4 w-4 mr-2" />
              Plan Your Own Trip
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pendingPaymentTrips = trips.filter(t => t.totalCost > t.totalPaid);
  const upcomingTrips = trips.filter(t => t.startDate && new Date(t.startDate) > new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">My Travel Agent</h2>
          <p className="text-muted-foreground">Trips, quotes, and payments from your agent</p>
        </div>
        {trips[0]?.agent && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{trips[0].agent.businessName || trips[0].agent.name}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {trips[0].agent.email && (
                    <a href={`mailto:${trips[0].agent.email}`} className="flex items-center gap-1 hover:text-primary">
                      <Mail className="h-3 w-3" />
                      Contact
                    </a>
                  )}
                  {trips[0].agent.phone && (
                    <a href={`tel:${trips[0].agent.phone}`} className="flex items-center gap-1 hover:text-primary">
                      <Phone className="h-3 w-3" />
                      Call
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Pending Approvals Alert */}
      {pendingQuotes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900">
                  {pendingQuotes.length} Quote{pendingQuotes.length > 1 ? 's' : ''} Awaiting Approval
                </h3>
                <p className="text-sm text-amber-700 mb-3">
                  Review and approve quotes from your travel agent
                </p>
                <div className="space-y-2">
                  {pendingQuotes.map(quote => (
                    <div key={quote.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div>
                        <p className="font-medium">{quote.tripName}</p>
                        <p className="text-sm text-muted-foreground">
                          {quote.name || 'Quote'} • {formatCurrency(quote.totalCents)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                        <Button size="sm" onClick={() => handleApproveQuote(quote.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="trips">
            <MapPin className="h-4 w-4 mr-2" />
            My Trips ({trips.length})
          </TabsTrigger>
          <TabsTrigger value="intake">
            <User className="h-4 w-4 mr-2" />
            My Profile
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="h-4 w-4 mr-2" />
            Payments
            {pendingPaymentTrips.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                {pendingPaymentTrips.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Trips Tab */}
        <TabsContent value="trips">
          {trips.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Trips Yet</h3>
                <p className="text-muted-foreground">
                  Your travel agent hasn't created any trips for you yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {trips.map(trip => {
                const daysUntil = trip.startDate 
                  ? differenceInDays(new Date(trip.startDate), new Date())
                  : null;
                const paymentProgress = trip.totalCost > 0 
                  ? Math.round((trip.totalPaid / trip.totalCost) * 100)
                  : 0;

                return (
                  <Card key={trip.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        {/* Trip Info */}
                        <div className="flex-1 p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-semibold">{trip.name}</h3>
                              {trip.destination && (
                                <p className="text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {trip.destination}
                                </p>
                              )}
                            </div>
                            <Badge variant={
                              trip.status === 'confirmed' ? 'default' :
                              trip.status === 'booked' ? 'default' :
                              'secondary'
                            }>
                              {trip.status || 'Planning'}
                            </Badge>
                          </div>

                          {/* Trip Details Grid */}
                          <div className="grid sm:grid-cols-2 gap-4 mb-4">
                            {trip.startDate && (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {format(new Date(trip.startDate), 'MMM d')}
                                  {trip.endDate && ` – ${format(new Date(trip.endDate), 'MMM d, yyyy')}`}
                                </span>
                                {daysUntil !== null && daysUntil > 0 && daysUntil <= 30 && (
                                  <Badge variant="outline" className="ml-2">
                                    {daysUntil} days away
                                  </Badge>
                                )}
                              </div>
                            )}
                            {trip.totalCost > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <span>{formatCurrency(trip.totalPaid)} / {formatCurrency(trip.totalCost)}</span>
                              </div>
                            )}
                          </div>

                          {/* Payment Progress */}
                          {trip.totalCost > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Payment Progress</span>
                                <span>{paymentProgress}%</span>
                              </div>
                              <Progress value={paymentProgress} className="h-2" />
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="border-t lg:border-t-0 lg:border-l p-4 lg:p-6 flex flex-row lg:flex-col gap-2 bg-muted/30">
                          {trip.hasItinerary && trip.shareToken && (
                            <Button variant="outline" className="flex-1 lg:flex-none" asChild>
                              <Link to={`/share/${trip.shareToken}`}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Itinerary
                              </Link>
                            </Button>
                          )}
                          {trip.totalCost > trip.totalPaid && (
                            <Button className="flex-1 lg:flex-none" onClick={() => setActiveTab('payments')}>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Make Payment
                            </Button>
                          )}
                          {!trip.hasItinerary && !trip.shareToken && (
                            <p className="text-sm text-muted-foreground text-center">
                              Itinerary in progress
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Intake/Profile Tab */}
        <TabsContent value="intake">
          <ClientIntakeSection />
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <ClientPaymentSection trips={trips} onPaymentComplete={loadClientData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
