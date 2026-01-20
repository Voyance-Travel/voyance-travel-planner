import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertTriangle,
  Calendar,
  Filter,
  Plus,
  Plane,
  CreditCard,
  FileText,
  Bell
} from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { getTasks, completeTask, type AgencyTask } from '@/services/agencyCRM';
import { format, differenceInDays, isToday, isTomorrow, isPast } from 'date-fns';

const PRIORITY_COLORS = {
  urgent: 'text-red-600 bg-red-50 border-red-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

const TASK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  payment: CreditCard,
  ticketing: Plane,
  document: FileText,
  reminder: Bell,
  default: Clock,
};

export default function AgentTasks() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    loadTasks();
  }, [isAuthenticated, authLoading, navigate]);

  const loadTasks = async () => {
    setIsLoading(true);
    const data = await getTasks({ status: filter === 'completed' ? 'completed' : undefined });
    setTasks(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadTasks();
    }
  }, [filter]);

  const handleCompleteTask = async (taskId: string) => {
    const success = await completeTask(taskId);
    if (success) {
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString() } : t
      ));
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending' && task.status === 'completed') return false;
    if (filter === 'completed' && task.status !== 'completed') return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    return true;
  });

  // Group tasks by due date
  const overdueeTasks = filteredTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'completed');
  const todayTasks = filteredTasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const tomorrowTasks = filteredTasks.filter(t => t.due_date && isTomorrow(new Date(t.due_date)));
  const upcomingTasks = filteredTasks.filter(t => {
    if (!t.due_date) return false;
    const days = differenceInDays(new Date(t.due_date), new Date());
    return days > 1 && days <= 7;
  });
  const laterTasks = filteredTasks.filter(t => {
    if (!t.due_date) return true;
    const days = differenceInDays(new Date(t.due_date), new Date());
    return days > 7;
  });

  const TaskCard = ({ task }: { task: AgencyTask }) => {
    const Icon = TASK_ICONS[task.task_type || 'default'] || TASK_ICONS.default;
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="group"
      >
        <Card className={`transition-all ${task.status === 'completed' ? 'opacity-60' : ''} ${isOverdue ? 'border-red-300 bg-red-50/50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={task.status === 'completed'}
                onCheckedChange={() => handleCompleteTask(task.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </h4>
                  <Badge 
                    variant="outline" 
                    className={PRIORITY_COLORS[task.priority || 'medium']}
                  >
                    {task.priority || 'medium'}
                  </Badge>
                </div>
                
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {task.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {task.due_date && (
                    <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                      <Calendar className="h-3 w-3" />
                      {isOverdue ? 'Overdue: ' : ''}
                      {format(new Date(task.due_date), 'MMM d, yyyy')}
                      {task.due_time && ` at ${task.due_time}`}
                    </span>
                  )}
                  {task.trip_id && (
                    <Button 
                      variant="link" 
                      className="h-auto p-0 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/agent/trips/${task.trip_id}`);
                      }}
                    >
                      View Trip →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const TaskSection = ({ title, tasks, icon: Icon, variant = 'default' }: { 
    title: string; 
    tasks: AgencyTask[]; 
    icon: React.ComponentType<{ className?: string }>;
    variant?: 'default' | 'danger' | 'warning';
  }) => {
    if (tasks.length === 0) return null;
    
    const variantStyles = {
      default: '',
      danger: 'border-red-200 bg-red-50/30',
      warning: 'border-amber-200 bg-amber-50/30',
    };
    
    return (
      <div className="mb-8">
        <div className={`flex items-center gap-2 mb-4 pb-2 border-b ${variant !== 'default' ? variantStyles[variant] : ''}`}>
          <Icon className={`h-5 w-5 ${variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-amber-600' : 'text-muted-foreground'}`} />
          <h3 className="font-semibold text-foreground">{title}</h3>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <AgentLayout>
      <Head
        title="Tasks & Deadlines | Travel Agent CRM"
        description="Manage your tasks and deadlines"
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Tasks & Deadlines
            </h1>
            <p className="text-muted-foreground mt-1">
              {overdueeTasks.length > 0 && (
                <span className="text-red-600 font-medium">{overdueeTasks.length} overdue • </span>
              )}
              {todayTasks.length} due today • {upcomingTasks.length} this week
            </p>
          </div>
          <Button onClick={() => navigate('/agent/tasks/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="flex-1">
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Task Sections */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {filter === 'pending' ? 'All caught up!' : 'No tasks found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'pending' 
                  ? 'You have no pending tasks' 
                  : 'Create a task to get started'}
              </p>
              <Button onClick={() => navigate('/agent/tasks/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <TaskSection 
              title="Overdue" 
              tasks={overdueeTasks} 
              icon={AlertTriangle} 
              variant="danger" 
            />
            <TaskSection 
              title="Today" 
              tasks={todayTasks} 
              icon={Clock} 
              variant="warning" 
            />
            <TaskSection 
              title="Tomorrow" 
              tasks={tomorrowTasks} 
              icon={Calendar} 
            />
            <TaskSection 
              title="This Week" 
              tasks={upcomingTasks} 
              icon={Calendar} 
            />
            <TaskSection 
              title="Later" 
              tasks={laterTasks} 
              icon={Calendar} 
            />
          </>
        )}
      </div>
    </AgentLayout>
  );
}
