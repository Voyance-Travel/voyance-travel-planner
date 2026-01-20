import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Edit,
  Trash2,
  Plus,
  Users,
  Mail,
  Phone,
  MapPin,
  Plane,
  Calendar,
  DollarSign,
  User,
  FileText,
  CreditCard,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Check,
  X
} from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getAccount, 
  getTravelers, 
  getTrips, 
  deleteAccount,
  generateIntakeLink,
  toggleIntakeEnabled,
  type AgencyAccount,
  type AgencyTraveler,
  type AgencyTrip 
} from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';
import TravelerModal from '@/components/agent/TravelerModal';
import IntakeLinkCard from '@/components/agent/IntakeLinkCard';

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [account, setAccount] = useState<AgencyAccount | null>(null);
  const [travelers, setTravelers] = useState<AgencyTraveler[]>([]);
  const [trips, setTrips] = useState<AgencyTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [travelerModalOpen, setTravelerModalOpen] = useState(false);
  const [editingTraveler, setEditingTraveler] = useState<AgencyTraveler | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    if (clientId) loadData();
  }, [isAuthenticated, authLoading, clientId, navigate]);

  const loadData = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const [accountData, travelersData, tripsData] = await Promise.all([
        getAccount(clientId),
        getTravelers(clientId),
        getTrips({ accountId: clientId }),
      ]);
      setAccount(accountData);
      setTravelers(travelersData);
      setTrips(tripsData);
    } catch (error) {
      console.error('Error loading client:', error);
      toast({ title: 'Failed to load client', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this client and all associated data? This cannot be undone.')) return;
    try {
      await deleteAccount(clientId!);
      toast({ title: 'Client deleted' });
      navigate('/agent/clients');
    } catch (error) {
      toast({ title: 'Failed to delete client', variant: 'destructive' });
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <AgentLayout>
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-40 bg-muted rounded" />
            <div className="h-60 bg-muted rounded" />
          </div>
        </div>
      </AgentLayout>
    );
  }

  if (!account) {
    return (
      <AgentLayout>
        <div className="max-w-5xl mx-auto px-6 py-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Client not found</h2>
          <Button variant="outline" onClick={() => navigate('/agent/clients')}>
            Back to Clients
          </Button>
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/agent' },
        { label: 'Clients', href: '/agent/clients' },
        { label: account.name }
      ]}
    >
      <Head title={`${account.name} | Travel Agent CRM`} />

      <div className="max-w-5xl mx-auto px-4 py-2 lg:px-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold">{account.name}</h1>
            {account.company_name && (
              <p className="text-muted-foreground">{account.company_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/agent/clients/${clientId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" size="icon" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Trips</p>
              <p className="text-2xl font-bold">{account.total_trips || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(account.total_revenue_cents || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Travelers</p>
              <p className="text-2xl font-bold">{travelers.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Lifetime Value</p>
              <p className="text-2xl font-bold">{formatCurrency(account.lifetime_value_cents || 0)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="travelers" className="space-y-6">
          <TabsList>
            <TabsTrigger value="travelers">Travelers</TabsTrigger>
            <TabsTrigger value="trips">Trips</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          {/* Travelers Tab */}
          <TabsContent value="travelers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Travelers</CardTitle>
                <Button size="sm" onClick={() => { setEditingTraveler(null); setTravelerModalOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Traveler
                </Button>
              </CardHeader>
              <CardContent>
                {travelers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No travelers added yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {travelers.map((traveler) => (
                      <div 
                        key={traveler.id}
                        className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => { setEditingTraveler(traveler); setTravelerModalOpen(true); }}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {traveler.legal_first_name} {traveler.legal_middle_name} {traveler.legal_last_name}
                            </p>
                            {traveler.is_primary_contact && (
                              <Badge variant="secondary">Primary</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {traveler.email && <span>{traveler.email}</span>}
                            {traveler.date_of_birth && (
                              <span>DOB: {format(new Date(traveler.date_of_birth), 'MMM d, yyyy')}</span>
                            )}
                            {traveler.passport_expiry && (
                              <span className={
                                new Date(traveler.passport_expiry) < new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
                                  ? 'text-destructive font-medium'
                                  : ''
                              }>
                                Passport exp: {format(new Date(traveler.passport_expiry), 'MMM yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {traveler.known_traveler_number && (
                            <p>TSA: {traveler.known_traveler_number}</p>
                          )}
                          {traveler.seat_preference && (
                            <p>{traveler.seat_preference} seat</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trips Tab */}
          <TabsContent value="trips">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Trips</CardTitle>
                <Button size="sm" onClick={() => navigate('/agent/trips/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Trip
                </Button>
              </CardHeader>
              <CardContent>
                {trips.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Plane className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No trips yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trips.map((trip) => (
                      <div 
                        key={trip.id}
                        className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/agent/trips/${trip.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{trip.name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {trip.destination && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {trip.destination}
                              </span>
                            )}
                            {trip.start_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(trip.start_date), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline">{trip.status}</Badge>
                        <p className="font-medium">{formatCurrency(trip.total_cost_cents || 0)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            {/* Client Intake Form Card */}
            <IntakeLinkCard 
              account={account} 
              onUpdate={loadData} 
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Account Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Account Type</p>
                    <p className="capitalize">{account.account_type}</p>
                  </div>
                  {account.billing_email && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Billing Email</p>
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {account.billing_email}
                      </p>
                    </div>
                  )}
                  {account.billing_phone && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Billing Phone</p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {account.billing_phone}
                      </p>
                    </div>
                  )}
                  {account.referral_source && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Referral Source</p>
                      <p>{account.referral_source}</p>
                    </div>
                  )}
                </div>

                {account.billing_address && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Billing Address</p>
                      <p>
                        {account.billing_address.street}<br />
                        {account.billing_address.city}, {account.billing_address.state} {account.billing_address.postal_code}<br />
                        {account.billing_address.country}
                      </p>
                    </div>
                  </>
                )}

                {account.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                      <p className="whitespace-pre-wrap">{account.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <TravelerModal
        open={travelerModalOpen}
        onOpenChange={setTravelerModalOpen}
        accountId={clientId!}
        traveler={editingTraveler}
        onSuccess={loadData}
      />
    </AgentLayout>
  );
}
