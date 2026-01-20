import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  Plane, 
  DollarSign, 
  TrendingUp, 
  Plus, 
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  Clock,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getAgentClients, 
  getAgentDashboardStats,
  deleteAgentClient,
  type AgentClient 
} from '@/services/agentCRMAPI';
import { getTrips, getTasks, getDashboardStats, type AgencyTrip, type AgencyTask } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, isPast, isToday, isTomorrow } from 'date-fns';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [clients, setClients] = useState<AgentClient[]>([]);
  const [trips, setTrips] = useState<AgencyTrip[]>([]);
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [stats, setStats] = useState<{
    totalClients: number;
    totalTrips: number;
    activeTrips: number;
    totalRevenue: number;
    upcomingDeadlines: number;
    pipelineValue: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    loadData();
  }, [isAuthenticated, navigate]);

  const loadData = async () => {
    setIsLoading(true);
    const [clientsData, legacyStats, tripsData, tasksData, crmStats] = await Promise.all([
      getAgentClients(),
      getAgentDashboardStats(),
      getTrips(),
      getTasks({ dueSoon: true }),
      getDashboardStats(),
    ]);
    setClients(clientsData);
    setTrips(tripsData);
    setTasks(tasksData.filter(t => t.status !== 'completed').slice(0, 5));
    setStats({
      totalClients: crmStats?.totalAccounts || legacyStats?.totalClients || 0,
      totalTrips: crmStats?.totalTrips || legacyStats?.totalTrips || 0,
      activeTrips: crmStats?.activeTrips || legacyStats?.activeTrips || 0,
      totalRevenue: legacyStats?.totalRevenue || 0,
      upcomingDeadlines: crmStats?.upcomingDeadlines || 0,
      pipelineValue: crmStats?.pipelineValue || 0,
    });
    setIsLoading(false);
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client? This cannot be undone.')) {
      return;
    }
    
    const success = await deleteAgentClient(clientId);
    if (success) {
      toast({ title: 'Client deleted successfully' });
      loadData();
    } else {
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

  // Get trips departing soon
  const upcomingTrips = trips
    .filter(trip => {
      if (!trip.start_date) return false;
      const daysUntil = differenceInDays(new Date(trip.start_date), new Date());
      return daysUntil >= 0 && daysUntil <= 30;
    })
    .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime())
    .slice(0, 5);

  // Get overdue/urgent tasks
  const urgentTasks = tasks.filter(t => 
    t.priority === 'urgent' || t.priority === 'high' || 
    (t.due_date && (isPast(new Date(t.due_date)) || isToday(new Date(t.due_date))))
  );

  return (
    <AgentLayout taskCount={urgentTasks.length}>
      <Head
        title="Travel Agent Dashboard | Voyance"
        description="Manage your travel clients and build custom itineraries"
      />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Welcome back! Here's what needs your attention.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/agent/clients/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
            <Button onClick={() => navigate('/agent/trips/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Trip
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/agent/clients')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clients
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/agent/trips')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Trips
              </CardTitle>
              <Plane className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeTrips || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.totalTrips || 0} total trips
              </p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/agent/tasks')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Tasks
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.upcomingDeadlines || 0}</div>
              {urgentTasks.length > 0 && (
                <Badge variant="destructive" className="mt-1">
                  {urgentTasks.length} urgent
                </Badge>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pipeline Value
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.pipelineValue || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Departures */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plane className="h-5 w-5" />
                Upcoming Departures
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/agent/trips')}>
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {upcomingTrips.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No upcoming departures in the next 30 days
                </p>
              ) : (
                <div className="space-y-4">
                  {upcomingTrips.map(trip => {
                    const daysUntil = differenceInDays(new Date(trip.start_date!), new Date());
                    return (
                      <div 
                        key={trip.id} 
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/agent/trips/${trip.id}`)}
                      >
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold ${
                          daysUntil <= 7 ? 'bg-red-100 text-red-700' : 
                          daysUntil <= 14 ? 'bg-amber-100 text-amber-700' : 
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {daysUntil}d
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{trip.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {trip.destination || 'No destination'}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-medium">{formatCurrency(trip.total_cost_cents || 0)}</p>
                          {trip.traveler_count && (
                            <p className="text-muted-foreground">{trip.traveler_count} travelers</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Urgent Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Tasks Needing Attention
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/agent/tasks')}>
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm text-muted-foreground">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => {
                    const isOverdue = task.due_date && isPast(new Date(task.due_date));
                    const isUrgent = task.priority === 'urgent' || task.priority === 'high';
                    
                    return (
                      <div 
                        key={task.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          isOverdue ? 'bg-red-50 border border-red-200' : 'hover:bg-muted/50'
                        } cursor-pointer transition-colors`}
                        onClick={() => task.trip_id && navigate(`/agent/trips/${task.trip_id}`)}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isOverdue ? 'bg-red-500' :
                          isUrgent ? 'bg-orange-500' : 'bg-amber-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{task.title}</p>
                          {task.due_date && (
                            <p className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                              {isOverdue ? 'Overdue: ' : 'Due: '}
                              {format(new Date(task.due_date), 'MMM d')}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="flex-shrink-0">
                          {task.priority}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Clients */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recent Clients
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/agent/clients')}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse p-4 rounded-lg border">
                    <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No clients yet</p>
                <Button onClick={() => navigate('/agent/clients/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Client
                </Button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.slice(0, 6).map((client) => (
                  <div
                    key={client.id}
                    className="p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/agent/clients/${client.id}`)}
                  >
                    <h4 className="font-medium">
                      {client.first_name} {client.last_name}
                    </h4>
                    {client.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{client.total_trips || 0} trips</span>
                      {client.total_revenue_cents && client.total_revenue_cents > 0 && (
                        <span>{formatCurrency(client.total_revenue_cents)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
}
