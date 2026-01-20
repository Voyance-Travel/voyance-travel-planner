import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Trash2, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTask, updateTask, deleteTask, completeTask, type AgencyTask, type TaskPriority, type TaskStatus } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId?: string;
  task?: AgencyTask | null;
  onSuccess: () => void;
}

type FormData = Partial<AgencyTask>;

export default function TaskModal({ open, onOpenChange, tripId, task, onSuccess }: TaskModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormData>();
  const isEdit = !!task;

  useEffect(() => {
    if (task) {
      reset({
        ...task,
        due_date: task.due_date?.split('T')[0],
      });
    } else {
      reset({
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        due_date: '',
        trip_id: tripId,
      });
    }
  }, [task, tripId, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        trip_id: tripId || data.trip_id,
      };

      if (isEdit && task) {
        await updateTask(task.id, payload);
        toast({ title: 'Task updated' });
      } else {
        await createTask(payload as Parameters<typeof createTask>[0]);
        toast({ title: 'Task created' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to save task', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    try {
      await completeTask(task.id);
      toast({ title: 'Task completed!' });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to complete task', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!task || !confirm('Delete this task?')) return;
    try {
      await deleteTask(task.id);
      toast({ title: 'Task deleted' });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to delete task', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'Create Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Task Title *</Label>
            <Input id="title" {...register('title')} required placeholder="e.g., Collect final payment" />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              {...register('description')} 
              placeholder="Additional details..."
              rows={3}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Select 
                value={watch('priority') || 'medium'} 
                onValueChange={(v) => setValue('priority', v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select 
                value={watch('status') || 'pending'} 
                onValueChange={(v) => setValue('status', v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="date" {...register('due_date')} />
            </div>
            <div>
              <Label htmlFor="due_time">Due Time</Label>
              <Input id="due_time" type="time" {...register('due_time')} />
            </div>
          </div>

          <div>
            <Label htmlFor="task_type">Task Type</Label>
            <Select 
              value={watch('task_type') || ''} 
              onValueChange={(v) => setValue('task_type', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment">Payment Collection</SelectItem>
                <SelectItem value="booking">Make Booking</SelectItem>
                <SelectItem value="ticketing">Ticketing</SelectItem>
                <SelectItem value="document">Document Request</SelectItem>
                <SelectItem value="followup">Follow Up</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              {isEdit && task?.status !== 'completed' && (
                <Button type="button" variant="outline" onClick={handleComplete}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              )}
              {isEdit && (
                <Button type="button" variant="destructive" size="icon" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEdit ? 'Save' : 'Create Task'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
