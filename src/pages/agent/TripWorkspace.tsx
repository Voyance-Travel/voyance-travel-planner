import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plane,
  Hotel,
  Car,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  FileText,
  MessageSquare,
  CheckSquare,
  Plus,
  Edit,
  MoreHorizontal,
  Clock,
  CreditCard,
  AlertCircle,
  Link2,
  Download,
  Copy,
  Library
} from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getTrip, 
  getSegments, 
  getTasks,
  getQuotes,
  getDocuments,
  type AgencyTrip, 
  type BookingSegment,
  type AgencyTask,
  type AgencyQuote,
  type AgencyDocument,
  SEGMENT_TYPE_LABELS,
  PIPELINE_STAGES
} from '@/services/agencyCRM';
import { format, differenceInDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import ShareTripModal from '@/components/agent/ShareTripModal';
import CloneTripModal from '@/components/agent/CloneTripModal';
import LibraryModal from '@/components/agent/LibraryModal';
import { generateTripPdf, type TripPdfData, type BookingItem } from '@/utils/tripPdfGenerator';
import { getAgentSettings } from '@/services/agentCRMAPI';
import type { EditorialDay } from '@/components/itinerary/EditorialItinerary';

const SEGMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: Car,
  transfer: Car,
  tour: MapPin,
  default: MapPin,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-200',
  confirmed: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  ticketed: 'bg-blue-500/10 text-blue-600 border-blue-200',
  cancelled: 'bg-red-500/10 text-red-600 border-red-200',
};

export default function TripWorkspace() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [trip, setTrip] = useState<AgencyTrip | null>(null);
  const [segments, setSegments] = useState<BookingSegment[]>([]);
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [quotes, setQuotes] = useState<AgencyQuote[]>([]);
  const [documents, setDocuments] = useState<AgencyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    if (tripId) {
      loadTripData();
    }
  }, [isAuthenticated, tripId, navigate]);

  const loadTripData = async () => {
    if (!tripId) return;
    setIsLoading(true);
    
    const [tripData, segmentsData, tasksData, quotesData, docsData] = await Promise.all([
      getTrip(tripId),
      getSegments(tripId),
      getTasks({ tripId }),
      getQuotes(tripId),
      getDocuments({ tripId }),
    ]);
    
    setTrip(tripData);
    setSegments(segmentsData);
    setTasks(tasksData);
    setQuotes(quotesData);
    setDocuments(docsData);
    setIsLoading(false);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const getPaymentProgress = () => {
    if (!trip?.total_cost_cents) return 0;
    return Math.round(((trip.total_paid_cents || 0) / trip.total_cost_cents) * 100);
  };

  const getPipelineStageName = (stageNum: number | null) => {
    const stage = PIPELINE_STAGES.find(s => s.stage === stageNum);
    return stage?.name || 'Inquiry';
  };

  const handleExportPdf = async () => {
    if (!trip) return;
    
    try {
      toast({ title: 'Generating PDF...' });
      
      // Get agent branding
      const settings = await getAgentSettings();
      
      // Prepare bookings data
      const bookings: BookingItem[] = segments.map(seg => ({
        type: seg.segment_type as BookingItem['type'],
        vendorName: seg.vendor_name || undefined,
        confirmationNumber: seg.confirmation_number || undefined,
        details: seg.origin && seg.destination 
          ? `${seg.origin} → ${seg.destination}` 
          : seg.start_date 
            ? format(new Date(seg.start_date), 'MMM d, yyyy')
            : undefined,
        startDate: seg.start_date || undefined,
        endDate: seg.end_date || undefined,
      }));
      
      // Get itinerary days
      const itineraryDays = (trip.itinerary_data?.days || []) as EditorialDay[];
      
      const pdfData: TripPdfData = {
        tripName: trip.name,
        destination: trip.destination || '',
        startDate: trip.start_date || '',
        endDate: trip.end_date || '',
        travelerCount: trip.traveler_count || 1,
        clientName: trip.account?.name,
        notes: trip.notes || undefined,
        days: itineraryDays,
        bookings,
        branding: {
          businessName: settings?.agent_business_name || 'Travel Advisor',
          email: settings?.agent_business_email || undefined,
        },
      };
      
      await generateTripPdf(pdfData);
      toast({ title: 'PDF downloaded!' });
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <AgentLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="grid grid-cols-3 gap-4 mt-8">
              <div className="h-32 bg-muted rounded" />
              <div className="h-32 bg-muted rounded" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </div>
        </div>
      </AgentLayout>
    );
  }

  if (!trip) {
    return (
      <AgentLayout>
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <h2 className="text-xl font-semibold">Trip not found</h2>
          <Button onClick={() => navigate('/agent/trips')} className="mt-4">
            Back to Trips
          </Button>
        </div>
      </AgentLayout>
    );
  }

  const daysUntilTrip = trip.start_date 
    ? differenceInDays(new Date(trip.start_date), new Date())
    : null;

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const currentQuote = quotes.find(q => q.is_current_version);

  return (
    <AgentLayout 
      breadcrumbs={[
        { label: 'Dashboard', href: '/agent' },
        { label: 'Trips', href: '/agent/trips' },
        { label: trip.name }
      ]}
    >
      <Head
        title={`${trip.name} | Trip Workspace`}
        description="Manage trip details, bookings, and communications"
      />

      <div className="max-w-7xl mx-auto px-4 py-2 lg:px-6">

        {/* Trip Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                {trip.name}
              </h1>
              <Badge variant="outline">
                {getPipelineStageName(trip.pipeline_stage)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {trip.destination && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {trip.destination}
                </span>
              )}
              {trip.start_date && trip.end_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}
                </span>
              )}
              {trip.traveler_count && (
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {trip.traveler_count} travelers
                </span>
              )}
              {daysUntilTrip !== null && daysUntilTrip > 0 && (
                <Badge variant={daysUntilTrip <= 14 ? 'destructive' : 'secondary'}>
                  <Clock className="h-3 w-3 mr-1" />
                  {daysUntilTrip} days until departure
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShareModalOpen(true)}>
              <Link2 className="h-4 w-4" />
              Share with Client
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/agent/trips/${tripId}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Trip
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCloneModalOpen(true)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone Trip
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLibraryModalOpen(true)}>
                  <Library className="h-4 w-4 mr-2" />
                  My Library
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  Cancel Trip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Value</span>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(trip.total_cost_cents || 0)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Paid</span>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(trip.total_paid_cents || 0)}
              </p>
              <Progress value={getPaymentProgress()} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Commission</span>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(trip.total_commission_cents || 0)}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Pending Tasks</span>
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">
                {pendingTasks.length}
              </p>
              {pendingTasks.some(t => t.priority === 'urgent') && (
                <Badge variant="destructive" className="mt-1">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Urgent items
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({segments.length})</TabsTrigger>
            <TabsTrigger value="quotes">Quotes ({quotes.length})</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Upcoming Deadlines */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Upcoming Deadlines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending tasks</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingTasks.slice(0, 5).map(task => (
                        <div key={task.id} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            task.priority === 'urgent' ? 'bg-red-500' :
                            task.priority === 'high' ? 'bg-orange-500' : 'bg-amber-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            {task.due_date && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(task.due_date), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Booking Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plane className="h-5 w-5" />
                    Booking Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {segments.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-3">No bookings yet</p>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Booking
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {segments.slice(0, 4).map(segment => {
                        const Icon = SEGMENT_ICONS[segment.segment_type] || SEGMENT_ICONS.default;
                        return (
                          <div key={segment.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {SEGMENT_TYPE_LABELS[segment.segment_type]}
                                {segment.vendor_name && ` • ${segment.vendor_name}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {segment.confirmation_number || 'No confirmation yet'}
                              </p>
                            </div>
                            <Badge variant="outline" className={STATUS_COLORS[segment.status || 'pending']}>
                              {segment.status || 'pending'}
                            </Badge>
                          </div>
                        );
                      })}
                      {segments.length > 4 && (
                        <Button 
                          variant="ghost" 
                          className="w-full" 
                          size="sm"
                          onClick={() => setActiveTab('bookings')}
                        >
                          View all {segments.length} bookings →
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Notes */}
            {(trip.notes || trip.internal_notes) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {trip.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Client Notes</h4>
                      <p className="text-sm">{trip.notes}</p>
                    </div>
                  )}
                  {trip.internal_notes && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Internal Notes</h4>
                      <p className="text-sm">{trip.internal_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">All Bookings</h3>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Booking
              </Button>
            </div>
            {segments.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No bookings yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add flights, hotels, and other bookings to this trip
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Booking
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {segments.map(segment => {
                  const Icon = SEGMENT_ICONS[segment.segment_type] || SEGMENT_ICONS.default;
                  return (
                    <Card key={segment.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">
                                {SEGMENT_TYPE_LABELS[segment.segment_type]}
                              </h4>
                              <Badge variant="outline" className={STATUS_COLORS[segment.status || 'pending']}>
                                {segment.status}
                              </Badge>
                            </div>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-3">
                              {segment.vendor_name && (
                                <div>
                                  <p className="text-muted-foreground">Vendor</p>
                                  <p className="font-medium">{segment.vendor_name}</p>
                                </div>
                              )}
                              {segment.confirmation_number && (
                                <div>
                                  <p className="text-muted-foreground">Confirmation</p>
                                  <p className="font-medium font-mono">{segment.confirmation_number}</p>
                                </div>
                              )}
                              {segment.start_date && (
                                <div>
                                  <p className="text-muted-foreground">Date</p>
                                  <p className="font-medium">
                                    {format(new Date(segment.start_date), 'MMM d, yyyy')}
                                  </p>
                                </div>
                              )}
                              {segment.sell_price_cents && (
                                <div>
                                  <p className="text-muted-foreground">Price</p>
                                  <p className="font-medium">{formatCurrency(segment.sell_price_cents)}</p>
                                </div>
                              )}
                            </div>
                            {/* Flight specific details */}
                            {segment.segment_type === 'flight' && segment.flight_number && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm">
                                  <span className="font-medium">{segment.flight_number}</span>
                                  {segment.origin_code && segment.destination_code && (
                                    <span className="text-muted-foreground">
                                      {' '}• {segment.origin_code} → {segment.destination_code}
                                    </span>
                                  )}
                                  {segment.cabin_class && (
                                    <span className="text-muted-foreground"> • {segment.cabin_class}</span>
                                  )}
                                </p>
                              </div>
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

          {/* Quotes Tab */}
          <TabsContent value="quotes">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Quotes & Proposals</h3>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Quote
              </Button>
            </div>
            {quotes.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No quotes yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a quote to send to your client
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Quote
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {quotes.map(quote => (
                  <Card key={quote.id} className={quote.is_current_version ? 'ring-2 ring-primary' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{quote.name || `Quote v${quote.version_number}`}</h4>
                            {quote.is_current_version && (
                              <Badge>Current</Badge>
                            )}
                            <Badge variant="outline">{quote.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Created {format(new Date(quote.created_at), 'MMM d, yyyy')}
                            {quote.expires_at && ` • Expires ${format(new Date(quote.expires_at), 'MMM d')}`}
                          </p>
                        </div>
                        <p className="text-xl font-bold">
                          {formatCurrency(quote.total_cents || 0)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Tasks & Deadlines</h3>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
            {tasks.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No tasks</h3>
                  <p className="text-muted-foreground mb-4">
                    Add tasks to track deadlines for this trip
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <Card key={task.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          task.status === 'completed' ? 'bg-emerald-500' :
                          task.priority === 'urgent' ? 'bg-red-500' :
                          task.priority === 'high' ? 'bg-orange-500' : 'bg-amber-500'
                        }`} />
                        <div className="flex-1">
                          <p className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          {task.due_date && (
                            <p className="text-sm text-muted-foreground">
                              Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">{task.priority}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Documents</h3>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Upload
              </Button>
            </div>
            {documents.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No documents</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload confirmations, vouchers, and other trip documents
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map(doc => (
                  <Card key={doc.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">{doc.document_type}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Share Modal */}
      <ShareTripModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        tripId={trip.id}
        tripName={trip.name}
      />

      {/* Clone Modal */}
      <CloneTripModal
        open={cloneModalOpen}
        onOpenChange={setCloneModalOpen}
        tripId={trip.id}
        originalName={trip.name}
      />

      {/* Library Modal */}
      <LibraryModal
        open={libraryModalOpen}
        onOpenChange={setLibraryModalOpen}
        mode="browse"
      />
    </AgentLayout>
  );
}
