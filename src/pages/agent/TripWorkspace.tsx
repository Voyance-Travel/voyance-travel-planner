import { useState, useEffect, useCallback } from 'react';
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
  Library,
  ListTodo,
  Wallet,
  Receipt,
  CalendarDays,
  ArrowRight,
  Send,
  Banknote,
  Sparkles,
  ShoppingCart
} from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  getTripPayments,
  getPaymentSchedules,
  getInvoices,
  updateTrip,
  type AgencyTrip, 
  type BookingSegment,
  type AgencyTask,
  type AgencyQuote,
  type AgencyDocument,
  type AgencyPayment,
  type PaymentSchedule,
  type AgencyInvoice,
  SEGMENT_TYPE_LABELS,
  PIPELINE_STAGES
} from '@/services/agencyCRM';
import { format, differenceInDays, isPast } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { toast } from '@/hooks/use-toast';
import ShareTripModal from '@/components/agent/ShareTripModal';
// CloneTripModal removed - agent features disabled
// LibraryModal removed - agent features disabled
import ImportBookingModal from '@/components/agent/ImportBookingModal';
import DocumentUploadModal from '@/components/agent/DocumentUploadModal';
import TaskModal from '@/components/agent/TaskModal';
import { generateTripPdf, type TripPdfData, type BookingItem } from '@/utils/tripPdfGenerator';
import { getAgentSettings } from '@/services/agentCRMAPI';
import EditorialItinerary, { type EditorialDay } from '@/components/itinerary/EditorialItinerary';
import FinanceLedger from '@/components/agent/FinanceLedger';
import TripCockpit from '@/components/agent/TripCockpit';
import InvoiceBuilderModal from '@/components/agent/InvoiceBuilderModal';
import PaymentScheduleModal from '@/components/agent/PaymentScheduleModal';
import QuickConfirmationCapture from '@/components/agent/QuickConfirmationCapture';
import BookingSegmentModal from '@/components/agent/BookingSegmentModal';
import FlightStatusTracker from '@/components/agent/FlightStatusTracker';
import AgentHotelSearch from '@/components/agent/AgentHotelSearch';
import { TripCart, TripCartBadge } from '@/components/booking/TripCart';
import { InventoryDrawer, type InventoryType, type InventoryItem } from '@/components/booking/InventoryDrawer';
import BookingsTable, { segmentToBookingRow } from '@/components/agent/BookingsTable';

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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Core data
  const [trip, setTrip] = useState<AgencyTrip | null>(null);
  const [segments, setSegments] = useState<BookingSegment[]>([]);
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [quotes, setQuotes] = useState<AgencyQuote[]>([]);
  const [documents, setDocuments] = useState<AgencyDocument[]>([]);
  const [payments, setPayments] = useState<AgencyPayment[]>([]);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [invoices, setInvoices] = useState<AgencyInvoice[]>([]);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // Library/Clone states removed - agent features disabled
  const [importBookingModalOpen, setImportBookingModalOpen] = useState(false);
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AgencyTask | null>(null);
  const [invoiceBuilderOpen, setInvoiceBuilderOpen] = useState(false);
  const [paymentScheduleOpen, setPaymentScheduleOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [bookingSegmentModalOpen, setBookingSegmentModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<BookingSegment | null>(null);
  
  // Inventory drawer state
  const [inventoryDrawerOpen, setInventoryDrawerOpen] = useState(false);
  const [inventoryDrawerType, setInventoryDrawerType] = useState<InventoryType>('activity');
  
  // Notes state
  const [clientNotes, setClientNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    if (tripId) {
      loadTripData();
    }
  }, [isAuthenticated, authLoading, tripId, navigate]);

  const loadTripData = async () => {
    if (!tripId) return;
    setIsLoading(true);
    
    try {
      const [tripData, segmentsData, tasksData, quotesData, docsData, paymentsData, schedulesData, invoicesData] = await Promise.all([
        getTrip(tripId),
        getSegments(tripId),
        getTasks({ tripId }),
        getQuotes(tripId),
        getDocuments({ tripId }),
        getTripPayments(tripId),
        getPaymentSchedules(tripId),
        getInvoices({ tripId }),
      ]);
      
      setTrip(tripData);
      setSegments(segmentsData);
      setTasks(tasksData);
      setQuotes(quotesData);
      setDocuments(docsData);
      setPayments(paymentsData);
      setPaymentSchedules(schedulesData);
      setInvoices(invoicesData);
      
      // Initialize notes
      if (tripData) {
        setClientNotes(tripData.notes || '');
        setInternalNotes(tripData.internal_notes || '');
      }
    } catch (error) {
      console.error('Failed to load trip data:', error);
      toast({ title: 'Failed to load trip', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: trip?.currency || 'USD',
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
      
      const settings = await getAgentSettings();
      
      const bookings: BookingItem[] = segments.map(seg => ({
        type: seg.segment_type as BookingItem['type'],
        vendorName: seg.vendor_name || undefined,
        confirmationNumber: seg.confirmation_number || undefined,
        details: seg.origin && seg.destination 
          ? `${seg.origin} → ${seg.destination}` 
          : seg.start_date 
            ? format(parseLocalDate(seg.start_date), 'MMM d, yyyy')
            : undefined,
        startDate: seg.start_date || undefined,
        endDate: seg.end_date || undefined,
      }));
      
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

  const handleSaveNotes = async () => {
    if (!tripId) return;
    setNotesLoading(true);
    try {
      await updateTrip(tripId, { 
        notes: clientNotes, 
        internal_notes: internalNotes 
      });
      toast({ title: 'Notes saved' });
    } catch (error) {
      toast({ title: 'Failed to save notes', variant: 'destructive' });
    } finally {
      setNotesLoading(false);
    }
  };

  const handleSaveItinerary = useCallback(async (days: EditorialDay[]) => {
    if (!tripId || !trip) return;
    try {
      await updateTrip(tripId, {
        itinerary_data: { days } as unknown as AgencyTrip['itinerary_data']
      });
      setTrip(prev => prev ? { ...prev, itinerary_data: { days } as unknown as AgencyTrip['itinerary_data'] } : null);
    } catch (error) {
      console.error('Failed to save itinerary:', error);
      throw error;
    }
  }, [tripId, trip]);

  // Inventory drawer handlers
  const openInventoryDrawer = useCallback((type: InventoryType) => {
    setInventoryDrawerType(type);
    setInventoryDrawerOpen(true);
  }, []);

  const handleInventorySelect = useCallback((item: InventoryItem) => {
    // TODO: Add item to itinerary or create booking segment
    toast({ title: `Added ${item.title} to trip` });
    setInventoryDrawerOpen(false);
    loadTripData();
  }, [loadTripData]);

  // Computed values
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const itineraryDays = (trip?.itinerary_data?.days || []) as EditorialDay[];
  const totalOwed = (trip?.total_cost_cents || 0) - (trip?.total_paid_cents || 0);
  const upcomingSchedules = paymentSchedules.filter(s => !s.is_paid && s.due_date);

  if (isLoading) {
    return (
      <AgentLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="grid grid-cols-4 gap-4 mt-8">
              <div className="h-32 bg-muted rounded" />
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
    ? differenceInDays(parseLocalDate(trip.start_date), new Date())
    : null;

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
                  {format(parseLocalDate(trip.start_date), 'MMM d')} – {format(parseLocalDate(trip.end_date), 'MMM d, yyyy')}
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
            {/* Trip Cart Badge */}
            <TripCartBadge tripId={trip.id} />
            
            <Button variant="outline" className="gap-2" onClick={() => setShareModalOpen(true)}>
              <Link2 className="h-4 w-4" />
              Share with Client
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/agent/trips/${tripId}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Trip
                </DropdownMenuItem>
                {/* Clone/Library menu items removed - agent features disabled */}
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
                <Banknote className="h-4 w-4 text-muted-foreground" />
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
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="itinerary">
              <CalendarDays className="h-4 w-4 mr-1" />
              Itinerary
            </TabsTrigger>
            <TabsTrigger value="flights">
              <Plane className="h-4 w-4 mr-1" />
              Flights
            </TabsTrigger>
            <TabsTrigger value="hotels">
              <Hotel className="h-4 w-4 mr-1" />
              Hotels
            </TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({segments.length})</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="h-4 w-4 mr-1" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="finance">
              <Wallet className="h-4 w-4 mr-1" />
              Finance
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Trip Cockpit - The Command Center */}
            <TripCockpit
              trip={trip}
              segments={segments}
              tasks={tasks}
              paymentSchedules={paymentSchedules}
              onOpenShareModal={() => setShareModalOpen(true)}
              onOpenTab={setActiveTab}
              formatCurrency={formatCurrency}
            />
          </TabsContent>

          {/* Itinerary Tab */}
          <TabsContent value="itinerary">
            {/* Quick Add Bar */}
            <div className="flex items-center gap-2 mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => openInventoryDrawer('activity')}
              >
                <Plus className="h-4 w-4" />
                Add Activity
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => openInventoryDrawer('hotel')}
              >
                <Hotel className="h-4 w-4" />
                Add Hotel
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => openInventoryDrawer('transfer')}
              >
                <Car className="h-4 w-4" />
                Add Transfer
              </Button>
            </div>

            {itineraryDays.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No itinerary yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Build a day-by-day itinerary for this trip
                  </p>
                  <Button onClick={() => toast({ title: 'Start creating your itinerary', description: 'Add activities and bookings to get started.' })}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Itinerary
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <EditorialItinerary
                tripId={trip.id}
                destination={trip.destination || ''}
                startDate={trip.start_date || ''}
                endDate={trip.end_date || ''}
                travelers={trip.traveler_count || 1}
                days={itineraryDays}
                isEditable={true}
                onSave={handleSaveItinerary}
              />
            )}
          </TabsContent>

          {/* Flights Tab - PNR & Status Tracking */}
          <TabsContent value="flights">
            <div className="space-y-6">
              <FlightStatusTracker segments={segments} />
              
              {segments.filter(s => s.segment_type === 'flight').length === 0 && (
                <Card className="text-center py-12">
                  <CardContent>
                    <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No flights to track</h3>
                    <p className="text-muted-foreground mb-4">
                      Add flight bookings with PNR/confirmation numbers to enable status tracking
                    </p>
                    <Button onClick={() => setBookingSegmentModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Flight
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Hotels Tab - Search & Add Hotels */}
          <TabsContent value="hotels">
            <AgentHotelSearch
              tripId={trip.id}
              defaultDestination={trip.destination || ''}
              defaultCheckIn={trip.start_date || ''}
              defaultCheckOut={trip.end_date || ''}
              defaultGuests={trip.traveler_count || 2}
              onHotelAdded={(segment) => {
                setSegments(prev => [...prev, segment]);
                toast({ title: 'Hotel added to bookings' });
              }}
              onManualEntry={() => {
                setEditingSegment(null);
                setBookingSegmentModalOpen(true);
              }}
            />
            
            {/* Existing hotel bookings */}
            {segments.filter(s => s.segment_type === 'hotel').length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-4">Booked Hotels</h3>
                <div className="space-y-3">
                  {segments.filter(s => s.segment_type === 'hotel').map(segment => (
                    <Card 
                      key={segment.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => {
                        setEditingSegment(segment);
                        setBookingSegmentModalOpen(true);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Hotel className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{segment.vendor_name || 'Hotel'}</h4>
                              <Badge variant="outline" className={STATUS_COLORS[segment.status || 'pending']}>
                                {segment.status}
                              </Badge>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-4 text-sm mt-2">
                              {segment.destination && (
                                <div>
                                  <p className="text-muted-foreground">Location</p>
                                  <p className="font-medium">{segment.destination}</p>
                                </div>
                              )}
                              {segment.start_date && segment.end_date && (
                                <div>
                                  <p className="text-muted-foreground">Dates</p>
                                  <p className="font-medium">
                                    {format(parseLocalDate(segment.start_date), 'MMM d')} – {format(parseLocalDate(segment.end_date), 'MMM d')}
                                  </p>
                                </div>
                              )}
                              {segment.confirmation_number && (
                                <div>
                                  <p className="text-muted-foreground">Confirmation</p>
                                  <p className="font-medium font-mono">{segment.confirmation_number}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(segment.sell_price_cents || 0)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Bookings Tab - Consolidated Table View */}
          <TabsContent value="bookings">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">All Bookings</h3>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setQuickCaptureOpen(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Quick Capture
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setImportBookingModalOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Import AI
                </Button>
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => {
                    setEditingSegment(null);
                    setBookingSegmentModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add Booking
                </Button>
              </div>
            </div>

            {segments.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No bookings yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add flights, hotels, and other bookings to this trip
                  </p>
                  <Button onClick={() => setQuickCaptureOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Booking
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <BookingsTable
                bookings={segments.map(segmentToBookingRow)}
                currency={trip.currency || 'USD'}
                onEditBooking={(booking) => {
                  const segment = segments.find(s => s.id === booking.id);
                  if (segment) {
                    setEditingSegment(segment);
                    setBookingSegmentModalOpen(true);
                  }
                }}
              />
            )}
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Tasks & Deadlines</h3>
              <Button 
                size="sm" 
                className="gap-2"
                onClick={() => {
                  setEditingTask(null);
                  setTaskModalOpen(true);
                }}
              >
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
                  <Button onClick={() => {
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <Card 
                    key={task.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setEditingTask(task);
                      setTaskModalOpen(true);
                    }}
                  >
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
              <Button size="sm" className="gap-2" onClick={() => setDocumentUploadOpen(true)}>
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
                  <Button onClick={() => setDocumentUploadOpen(true)}>
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

          {/* Messages/Notes Tab */}
          <TabsContent value="messages">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Client Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Client Notes
                  </CardTitle>
                  <CardDescription>Notes visible to client on shared itinerary</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add notes for your client..."
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    rows={6}
                    className="mb-3"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSaveNotes}
                    disabled={notesLoading}
                  >
                    {notesLoading ? 'Saving...' : 'Save Notes'}
                  </Button>
                </CardContent>
              </Card>

              {/* Internal Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Internal Notes
                  </CardTitle>
                  <CardDescription>Private notes (not shared with client)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add internal notes..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={6}
                    className="mb-3"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSaveNotes}
                    disabled={notesLoading}
                  >
                    {notesLoading ? 'Saving...' : 'Save Notes'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Finance Tab - Travel Subledger */}
          <TabsContent value="finance" className="space-y-6">
            {/* Finance Ledger with ARC/BSP, Supplier Direct, Commission Track */}
            <FinanceLedger
              segments={segments}
              tripTotalCents={trip.total_cost_cents || 0}
              tripPaidCents={trip.total_paid_cents || 0}
              tripCommissionCents={trip.total_commission_cents || 0}
              currency={trip.currency}
            />

            {/* Payment Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Collected</span>
                    <span className="font-medium">{getPaymentProgress()}%</span>
                  </div>
                  <Progress value={getPaymentProgress()} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(trip.total_paid_cents || 0)} paid</span>
                    <span>{formatCurrency(totalOwed)} remaining</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Payment Schedule</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setPaymentScheduleOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              </CardHeader>
              <CardContent>
                {paymentSchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No payment schedule set
                  </p>
                ) : (
                  <div className="space-y-3">
                    {paymentSchedules.map(schedule => (
                      <div 
                        key={schedule.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          schedule.is_paid 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : isPast(new Date(schedule.due_date)) 
                              ? 'bg-red-50 border-red-200' 
                              : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            schedule.is_paid ? 'bg-emerald-100' : 'bg-background'
                          }`}>
                            {schedule.is_paid ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{schedule.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {schedule.is_paid 
                                ? `Paid ${schedule.paid_at ? format(new Date(schedule.paid_at), 'MMM d') : ''}` 
                                : `Due ${format(new Date(schedule.due_date), 'MMM d, yyyy')}`}
                            </p>
                          </div>
                        </div>
                        <p className={`font-bold ${schedule.is_paid ? 'text-emerald-600' : ''}`}>
                          {formatCurrency(schedule.amount_cents)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Payments */}
            {payments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {payments.map(payment => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">{payment.payment_method.replace('_', ' ')}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-emerald-600">
                          +{formatCurrency(payment.amount_cents)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invoices */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Invoices</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setInvoiceBuilderOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No invoices yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {invoices.map(invoice => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium font-mono">{invoice.invoice_number}</p>
                          <p className="text-sm text-muted-foreground">
                            Issued {format(new Date(invoice.issue_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(invoice.total_cents || 0)}</p>
                          <Badge variant={
                            invoice.status === 'paid' ? 'default' :
                            invoice.status === 'overdue' ? 'destructive' : 'outline'
                          }>
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <ShareTripModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        tripId={trip.id}
        tripName={trip.name}
      />

      {/* CloneTripModal and LibraryModal removed - agent features disabled */}

      <ImportBookingModal
        open={importBookingModalOpen}
        onOpenChange={setImportBookingModalOpen}
        tripId={trip.id}
        onSuccess={loadTripData}
      />

      <DocumentUploadModal
        open={documentUploadOpen}
        onOpenChange={setDocumentUploadOpen}
        tripId={trip.id}
        accountId={trip.account_id}
        onSuccess={loadTripData}
      />

      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        tripId={trip.id}
        task={editingTask}
        onSuccess={loadTripData}
      />

      <InvoiceBuilderModal
        open={invoiceBuilderOpen}
        onOpenChange={setInvoiceBuilderOpen}
        trip={trip}
        segments={segments}
        onSuccess={loadTripData}
      />

      <PaymentScheduleModal
        open={paymentScheduleOpen}
        onOpenChange={setPaymentScheduleOpen}
        trip={trip}
        existingSchedules={paymentSchedules}
        onSuccess={loadTripData}
      />

      <QuickConfirmationCapture
        open={quickCaptureOpen}
        onOpenChange={setQuickCaptureOpen}
        tripId={trip.id}
        onSuccess={loadTripData}
      />

      <BookingSegmentModal
        open={bookingSegmentModalOpen}
        onOpenChange={setBookingSegmentModalOpen}
        tripId={trip.id}
        segment={editingSegment}
        onSuccess={loadTripData}
      />

      {/* Trip Cart - Floating */}
      <TripCart
        tripId={trip.id}
        onCheckout={() => {
          toast({ title: 'Checkout flow coming soon' });
        }}
      />

      {/* Inventory Drawer */}
      <InventoryDrawer
        isOpen={inventoryDrawerOpen}
        onClose={() => setInventoryDrawerOpen(false)}
        type={inventoryDrawerType}
        destination={trip.destination || ''}
        date={trip.start_date || undefined}
        onSelectItem={handleInventorySelect}
      />
    </AgentLayout>
  );
}
