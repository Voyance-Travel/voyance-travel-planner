import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Filter,
  Plus,
  Plane,
  CreditCard,
  FileText,
  Bell,
} from 'lucide-react';

import AgentLayout from '@/components/agent/AgentLayout';
import TaskModal from '@/components/agent/TaskModal';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

import { getTasks, completeTask, type AgencyTask } from '@/services/agencyCRM';

import { differenceInDays, format, isPast, isToday, isTomorrow } from 'date-fns';

type FilterValue = 'all' | 'pending' | 'completed';

const PRIORITY_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  urgent: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
};

const TASK_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  payment: CreditCard,
  ticketing: Plane,
  document: FileText,
  reminder: Bell,
  default: Clock,
};

export default function AgentTasks() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filter, setFilter] = useState<FilterValue>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AgencyTask | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTasks({
        status: filter === 'completed' ? 'completed' : undefined,
      });
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks', error);
      toast({ title: 'Failed to load tasks', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // Auth protection is handled centrally by <AgentLayout />
    loadTasks();
  }, [loadTasks]);

  const openCreate = () => {
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setTaskModalOpen(open);
    if (!open) setEditingTask(null);
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTask(taskId);
      await loadTasks();
      toast({ title: 'Task completed' });
    } catch (error) {
      console.error('Failed to complete task', error);
      toast({ title: 'Failed to complete task', variant: 'destructive' });
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === 'pending' && task.status === 'completed') return false;
      if (filter === 'completed' && task.status !== 'completed') return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      return true;
    });
  }, [filter, priorityFilter, tasks]);

  const grouped = useMemo(() => {
    const overdue = filteredTasks.filter(
      (t) => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'completed'
    );

    const today = filteredTasks.filter((t) => t.due_date && isToday(new Date(t.due_date)));
    const tomorrow = filteredTasks.filter((t) => t.due_date && isTomorrow(new Date(t.due_date)));

    const upcoming = filteredTasks.filter((t) => {
      if (!t.due_date) return false;
      const days = differenceInDays(new Date(t.due_date), new Date());
      return days > 1 && days <= 7;
    });

    const later = filteredTasks.filter((t) => {
      if (!t.due_date) return true;
      const days = differenceInDays(new Date(t.due_date), new Date());
      return days > 7;
    });

    return { overdue, today, tomorrow, upcoming, later };
  }, [filteredTasks]);

  const TaskCard = ({ task }: { task: AgencyTask }) => {
    const Icon = TASK_ICONS[task.task_type || 'default'] || TASK_ICONS.default;
    const isOverdue = !!task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';

    const priority = task.priority || 'medium';
    const priorityBadgeVariant = PRIORITY_BADGE_VARIANT[priority] || 'secondary';

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="group">
        <Card
          className={
            `transition-all cursor-pointer ` +
            (task.status === 'completed' ? 'opacity-60 ' : '') +
            (isOverdue ? 'border-destructive/30 bg-destructive/5' : '')
          }
          onClick={() => {
            setEditingTask(task);
            setTaskModalOpen(true);
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={task.status === 'completed'}
                onCheckedChange={(checked) => {
                  // Prevent opening the edit modal when clicking checkbox
                  if (checked) handleCompleteTask(task.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h4
                    className={
                      `font-medium truncate ` +
                      (task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground')
                    }
                    title={task.title}
                  >
                    {task.title}
                  </h4>

                  <Badge variant={priorityBadgeVariant} className="capitalize">
                    {priority}
                  </Badge>
                </div>

                {task.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {task.due_date && (
                    <span
                      className={
                        `flex items-center gap-1 ` + (isOverdue ? 'text-destructive font-medium' : '')
                      }
                    >
                      <Calendar className="h-3 w-3" />
                      {isOverdue ? 'Overdue: ' : ''}
                      {format(new Date(task.due_date), 'MMM d, yyyy')}
                      {task.due_time ? ` at ${task.due_time}` : ''}
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

  const TaskSection = ({
    title,
    tasks,
    icon: Icon,
    variant = 'default',
  }: {
    title: string;
    tasks: AgencyTask[];
    icon: ComponentType<{ className?: string }>;
    variant?: 'default' | 'danger' | 'warning';
  }) => {
    if (tasks.length === 0) return null;

    const variantStyles: Record<typeof variant, string> = {
      default: '',
      danger: 'border-destructive/20 bg-destructive/5',
      warning: 'border-primary/15 bg-primary/5',
    };

    const iconClass =
      variant === 'danger'
        ? 'text-destructive'
        : variant === 'warning'
          ? 'text-primary'
          : 'text-muted-foreground';

    return (
      <div className="mb-8">
        <div
          className={
            `flex items-center gap-2 mb-4 pb-2 border-b rounded-sm ` +
            (variant !== 'default' ? variantStyles[variant] : '')
          }
        >
          <Icon className={`h-5 w-5 ${iconClass}`} />
          <h3 className="font-semibold text-foreground">{title}</h3>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <AgentLayout>
      <Head title="Tasks & Deadlines | Travel Agent CRM" description="Manage your tasks and deadlines" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Tasks & Deadlines</h1>
            <p className="text-muted-foreground mt-1">
              {grouped.overdue.length > 0 && (
                <span className="text-destructive font-medium">{grouped.overdue.length} overdue • </span>
              )}
              {grouped.today.length} due today • {grouped.upcoming.length} this week
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterValue)} className="flex-1">
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[170px]">
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
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {filter === 'pending' ? 'All caught up!' : 'No tasks found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'pending' ? 'You have no pending tasks' : 'Create a task to get started'}
              </p>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <TaskSection title="Overdue" tasks={grouped.overdue} icon={AlertTriangle} variant="danger" />
            <TaskSection title="Today" tasks={grouped.today} icon={Clock} variant="warning" />
            <TaskSection title="Tomorrow" tasks={grouped.tomorrow} icon={Calendar} />
            <TaskSection title="This Week" tasks={grouped.upcoming} icon={Calendar} />
            <TaskSection title="Later" tasks={grouped.later} icon={Calendar} />
          </>
        )}
      </div>

      <TaskModal
        open={taskModalOpen}
        onOpenChange={handleModalOpenChange}
        task={editingTask}
        onSuccess={loadTasks}
      />
    </AgentLayout>
  );
}
