import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plane, 
  Plus, 
  Search,
  Calendar,
  Users,
  MapPin,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { getTrips, type AgencyTrip, PIPELINE_STAGES } from '@/services/agencyCRM';
import { format, differenceInDays, isPast, isFuture } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-500/10 text-blue-600 border-blue-200',
  planning: 'bg-purple-500/10 text-purple-600 border-purple-200',
  quoted: 'bg-amber-500/10 text-amber-600 border-amber-200',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  booked: 'bg-teal-500/10 text-teal-600 border-teal-200',
  deposited: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  paid: 'bg-green-500/10 text-green-600 border-green-200',
  traveling: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  completed: 'bg-gray-500/10 text-gray-600 border-gray-200',
  cancelled: 'bg-red-500/10 text-red-600 border-red-200',
};

export default function AgentTrips() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [trips, setTrips] = useState<AgencyTrip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    loadTrips();
  }, [isAuthenticated, navigate]);

  const loadTrips = async () => {
    setIsLoading(true);
    const data = await getTrips();
    setTrips(data);
    setIsLoading(false);
  };

  const filteredTrips = trips.filter(trip => {
    const matchesSearch = 
      trip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.destination?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || trip.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return differenceInDays(date, new Date());
  };

  const getTripsByStage = (stageNum: number) => {
    return filteredTrips.filter(trip => trip.pipeline_stage === stageNum);
  };

  return (
    <MainLayout>
      <Head
        title="Trips | Travel Agent CRM"
        description="Manage all your client trips"
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Trips
            </h1>
            <p className="text-muted-foreground mt-1">
              {trips.length} total trips • {trips.filter(t => t.status === 'traveling').length} currently traveling
            </p>
          </div>
          <Button onClick={() => navigate('/agent/trips/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Trip
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search trips by name or destination..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="inquiry">Inquiry</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="traveling">Traveling</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'pipeline')}>
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-4 bg-muted rounded w-1/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredTrips.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {searchQuery || statusFilter !== 'all' ? 'No trips found' : 'No trips yet'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'Try adjusting your filters' 
                      : 'Create your first trip to get started'}
                  </p>
                  {!searchQuery && statusFilter === 'all' && (
                    <Button onClick={() => navigate('/agent/trips/new')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Trip
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredTrips.map((trip, index) => {
                  const daysUntilStart = getDaysUntil(trip.start_date);
                  const isUpcoming = daysUntilStart !== null && daysUntilStart > 0 && daysUntilStart <= 14;
                  
                  return (
                    <motion.div
                      key={trip.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/agent/trips/${trip.id}`)}
                      >
                        <CardContent className="p-6">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            {/* Main Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-foreground truncate">
                                  {trip.name}
                                </h3>
                                <Badge 
                                  variant="outline" 
                                  className={STATUS_COLORS[trip.status || 'inquiry']}
                                >
                                  {trip.status || 'Inquiry'}
                                </Badge>
                                {isUpcoming && (
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {daysUntilStart} days
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                {trip.destination && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {trip.destination}
                                  </span>
                                )}
                                {trip.start_date && trip.end_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}
                                  </span>
                                )}
                                {trip.traveler_count && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {trip.traveler_count} travelers
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Financial Info */}
                            <div className="flex items-center gap-6 text-sm">
                              <div className="text-right">
                                <p className="text-muted-foreground">Total</p>
                                <p className="font-semibold text-foreground">
                                  {formatCurrency(trip.total_cost_cents || 0)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-muted-foreground">Paid</p>
                                <p className="font-semibold text-emerald-600">
                                  {formatCurrency(trip.total_paid_cents || 0)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-muted-foreground">Commission</p>
                                <p className="font-semibold text-primary">
                                  {formatCurrency(trip.total_commission_cents || 0)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {trip.tags && trip.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t">
                              {trip.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Pipeline View */}
        {viewMode === 'pipeline' && (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
            {PIPELINE_STAGES.slice(0, 6).map((stage) => {
                const stageTrips = getTripsByStage(stage.stage);
                return (
                  <div key={stage.stage} className="w-72 flex-shrink-0">
                    <div className="bg-muted/50 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-foreground">{stage.name}</h3>
                        <Badge variant="secondary">{stageTrips.length}</Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {stageTrips.map((trip) => (
                        <Card 
                          key={trip.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate(`/agent/trips/${trip.id}`)}
                        >
                          <CardContent className="p-4">
                            <h4 className="font-medium text-foreground mb-1 truncate">
                              {trip.name}
                            </h4>
                            {trip.destination && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                                <MapPin className="h-3 w-3" />
                                {trip.destination}
                              </p>
                            )}
                            {trip.start_date && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(trip.start_date), 'MMM d, yyyy')}
                              </p>
                            )}
                            <div className="mt-2 pt-2 border-t">
                              <p className="text-sm font-medium text-foreground">
                                {formatCurrency(trip.total_cost_cents || 0)}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {stageTrips.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No trips
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
