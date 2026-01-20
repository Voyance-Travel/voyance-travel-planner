import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Plane, 
  DollarSign, 
  Plus, 
  Calendar,
  Clock,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Mail,
  ChevronRight
} from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getAgentClients, 
  getAgentDashboardStats,
  type AgentClient 
} from '@/services/agentCRMAPI';
import { getTrips, getTasks, getDashboardStats, type AgencyTrip, type AgencyTask } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

// Stat Card Component
function StatCard({ 
  label, 
  value, 
  subtext, 
  icon: Icon, 
  onClick, 
  accent = false,
  badge
}: { 
  label: string; 
  value: string | number; 
  subtext?: string; 
  icon: React.ElementType; 
  onClick?: () => void;
  accent?: boolean;
  badge?: { text: string; variant: 'destructive' | 'default' | 'secondary' };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        "relative group cursor-pointer rounded-2xl p-6 transition-all duration-300",
        accent 
          ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg" 
          : "bg-card border border-border hover:border-primary/30 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className={cn(
            "text-sm font-medium tracking-wide uppercase",
            accent ? "text-primary-foreground/80" : "text-muted-foreground"
          )}>
            {label}
          </p>
          <p className={cn(
            "text-4xl font-serif font-bold tracking-tight",
            accent ? "text-primary-foreground" : "text-foreground"
          )}>
            {value}
          </p>
          {subtext && (
            <p className={cn(
              "text-sm",
              accent ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {subtext}
            </p>
          )}
          {badge && (
            <Badge variant={badge.variant} className="mt-1">
              {badge.text}
            </Badge>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-xl transition-colors",
          accent 
            ? "bg-white/10" 
            : "bg-muted group-hover:bg-primary/10"
        )}>
          <Icon className={cn(
            "h-5 w-5",
            accent ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
          )} />
        </div>
      </div>
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl transition-opacity opacity-0 group-hover:opacity-100",
        accent ? "bg-white/20" : "bg-primary/20"
      )} />
    </motion.div>
  );
}

// Trip Card Component
function TripPreviewCard({ 
  trip, 
  onClick 
}: { 
  trip: AgencyTrip; 
  onClick: () => void;
}) {
  const daysUntil = differenceInDays(new Date(trip.start_date!), new Date());
  
  const getUrgencyStyles = () => {
    if (daysUntil <= 7) return { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' };
    if (daysUntil <= 14) return { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' };
    return { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/20' };
  };
  
  const styles = getUrgencyStyles();
  
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 4 }}
      onClick={onClick}
      className="group flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all duration-200"
    >
      <div className={cn(
        "flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-serif border",
        styles.bg,
        styles.border
      )}>
        <span className={cn("text-2xl font-bold leading-none", styles.text)}>{daysUntil}</span>
        <span className={cn("text-[10px] uppercase tracking-wider", styles.text)}>days</span>
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
          {trip.name}
        </h4>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{trip.destination || 'No destination set'}</span>
        </p>
      </div>
      
      <div className="flex-shrink-0 text-right">
        <p className="font-semibold text-foreground">
          {formatCurrency(trip.total_cost_cents || 0)}
        </p>
        {trip.traveler_count && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {trip.traveler_count} traveler{trip.traveler_count > 1 ? 's' : ''}
          </p>
        )}
      </div>
      
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </motion.div>
  );
}

// Task Item Component
function TaskItem({ 
  task, 
  onClick 
}: { 
  task: AgencyTask; 
  onClick: () => void;
}) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const isDueToday = task.due_date && isToday(new Date(task.due_date));
  const isUrgent = task.priority === 'urgent' || task.priority === 'high';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: 4 }}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
        isOverdue 
          ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" 
          : "hover:bg-muted/50"
      )}
    >
      <div className={cn(
        "w-2 h-2 rounded-full flex-shrink-0",
        isOverdue ? 'bg-red-500' :
        isDueToday ? 'bg-amber-500' :
        isUrgent ? 'bg-orange-500' : 'bg-muted-foreground/50'
      )} />
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
          {task.title}
        </p>
        {task.due_date && (
          <p className={cn(
            "text-xs mt-0.5",
            isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'
          )}>
            {isOverdue ? 'Overdue: ' : isDueToday ? 'Due today' : 'Due: '}
            {!isDueToday && format(new Date(task.due_date), 'MMM d')}
          </p>
        )}
      </div>
      
      <Badge 
        variant={isUrgent ? 'destructive' : 'secondary'} 
        className="flex-shrink-0 capitalize text-xs"
      >
        {task.priority}
      </Badge>
    </motion.div>
  );
}

// Client Card Component
function ClientCard({ 
  client, 
  onClick 
}: { 
  client: AgentClient; 
  onClick: () => void;
}) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group p-5 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md cursor-pointer transition-all duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-serif font-bold text-primary">
            {client.first_name[0]}{client.last_name[0]}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
            {client.first_name} {client.last_name}
          </h4>
          {client.email && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {client.email}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Plane className="h-3 w-3" />
          <span>{client.total_trips || 0} trips</span>
        </div>
        {client.total_revenue_cents && client.total_revenue_cents > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>{formatCurrency(client.total_revenue_cents)}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Section Header Component
function SectionHeader({ 
  icon: Icon, 
  title, 
  onViewAll 
}: { 
  icon: React.ElementType; 
  title: string; 
  onViewAll: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </h2>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onViewAll}
        className="text-muted-foreground hover:text-primary group"
      >
        View All 
        <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
      </Button>
    </div>
  );
}

// Empty State Component
function EmptyState({ 
  icon: Icon, 
  message, 
  action 
}: { 
  icon: React.ElementType; 
  message: string; 
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          <Plus className="h-4 w-4 mr-1.5" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Loading Skeleton
function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-pulse">
      <div className="h-10 bg-muted rounded w-48 mb-2" />
      <div className="h-5 bg-muted rounded w-72 mb-8" />
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-muted rounded-2xl" />
        ))}
      </div>
      
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="h-80 bg-muted rounded-xl" />
        <div className="h-80 bg-muted rounded-xl" />
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
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
  const [isLoading, setIsLoading] = useState(true);

  // Wait for auth to finish loading before redirecting
  useEffect(() => {
    if (authLoading) return; // Don't do anything while auth is loading
    
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    loadData();
  }, [isAuthenticated, authLoading, navigate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
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
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
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

  // Show loading while auth is being checked
  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <AgentLayout>
        <DashboardSkeleton />
      </AgentLayout>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <AgentLayout taskCount={urgentTasks.length}>
      <Head
        title="Travel Agent Dashboard | Voyance"
        description="Manage your travel clients and build custom itineraries"
      />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"
        >
          <div>
            <p className="text-sm font-medium text-primary mb-1 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              {format(new Date(), 'EEEE, MMMM d')}
            </p>
            <h1 className="text-4xl font-serif font-bold text-foreground">
              Welcome back, {firstName}
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Here's what needs your attention today.
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/agent/clients/new')}
              className="rounded-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
            <Button 
              onClick={() => navigate('/agent/trips/new')}
              className="rounded-lg bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Trip
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Clients"
            value={stats?.totalClients || 0}
            icon={Users}
            onClick={() => navigate('/agent/clients')}
          />
          <StatCard
            label="Active Trips"
            value={stats?.activeTrips || 0}
            subtext={`${stats?.totalTrips || 0} total`}
            icon={Plane}
            onClick={() => navigate('/agent/trips')}
          />
          <StatCard
            label="Pending Tasks"
            value={stats?.upcomingDeadlines || 0}
            icon={Clock}
            onClick={() => navigate('/agent/tasks')}
            badge={urgentTasks.length > 0 ? { text: `${urgentTasks.length} urgent`, variant: 'destructive' } : undefined}
          />
          <StatCard
            label="Pipeline"
            value={formatCurrency(stats?.pipelineValue || 0)}
            icon={TrendingUp}
            accent
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Upcoming Departures */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl border border-border p-6"
          >
            <SectionHeader
              icon={Plane}
              title="Upcoming Departures"
              onViewAll={() => navigate('/agent/trips')}
            />
            
            {upcomingTrips.length === 0 ? (
              <EmptyState
                icon={Calendar}
                message="No departures in the next 30 days"
                action={{ label: 'Plan a Trip', onClick: () => navigate('/agent/trips/new') }}
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {upcomingTrips.map((trip, index) => (
                    <TripPreviewCard
                      key={trip.id}
                      trip={trip}
                      onClick={() => navigate(`/agent/trips/${trip.id}`)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Tasks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-2xl border border-border p-6"
          >
            <SectionHeader
              icon={AlertTriangle}
              title="Tasks Needing Attention"
              onViewAll={() => navigate('/agent/tasks')}
            />
            
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm text-muted-foreground">All caught up! Great work.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onClick={() => task.trip_id && navigate(`/agent/trips/${task.trip_id}`)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>

        {/* Recent Clients */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border p-6"
        >
          <SectionHeader
            icon={Users}
            title="Recent Clients"
            onViewAll={() => navigate('/agent/clients')}
          />
          
          {clients.length === 0 ? (
            <EmptyState
              icon={Users}
              message="No clients yet. Add your first client to get started."
              action={{ label: 'Add Client', onClick: () => navigate('/agent/clients/new') }}
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {clients.slice(0, 6).map((client, index) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onClick={() => navigate(`/agent/clients/${client.id}`)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </AgentLayout>
  );
}
