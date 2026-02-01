/**
 * Go-Back List Component
 * Things the user wants to do on their next visit
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Check, RotateCcw, Bell, 
  Utensils, MapPin, Camera, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GoBackItem {
  id: string;
  trip_id: string;
  item: string;
  category: 'restaurant' | 'activity' | 'place' | 'event' | 'other';
  notes?: string;
  is_completed: boolean;
  reminder_enabled: boolean;
  created_at: string;
}

interface GoBackListProps {
  tripId: string;
  destination: string;
}

const CATEGORIES = {
  restaurant: { label: 'Restaurant', icon: Utensils, color: 'text-orange-500' },
  activity: { label: 'Activity', icon: Sparkles, color: 'text-purple-500' },
  place: { label: 'Place', icon: MapPin, color: 'text-blue-500' },
  event: { label: 'Event', icon: Camera, color: 'text-green-500' },
  other: { label: 'Other', icon: Plus, color: 'text-muted-foreground' },
} as const;

export function GoBackList({ tripId, destination }: GoBackListProps) {
  const [items, setItems] = useState<GoBackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState<GoBackItem['category']>('activity');

  useEffect(() => {
    fetchItems();
  }, [tripId]);

  async function fetchItems() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('trip_go_back_list')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setItems(data as GoBackItem[]);
    }
    setIsLoading(false);
  }

  async function addItem() {
    if (!newItem.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('trip_go_back_list')
      .insert({
        trip_id: tripId,
        user_id: user.id,
        item: newItem,
        category: newCategory,
        is_completed: false,
        reminder_enabled: false,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add item');
      return;
    }

    setItems([...items, data as GoBackItem]);
    setNewItem('');
    toast.success('Added to your list!');
  }

  async function toggleComplete(itemId: string, completed: boolean) {
    const { error } = await supabase
      .from('trip_go_back_list')
      .update({ is_completed: completed })
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to update');
      return;
    }

    setItems(items.map(i => i.id === itemId ? { ...i, is_completed: completed } : i));
  }

  async function toggleReminder(itemId: string, enabled: boolean) {
    const { error } = await supabase
      .from('trip_go_back_list')
      .update({ reminder_enabled: enabled })
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to update');
      return;
    }

    setItems(items.map(i => i.id === itemId ? { ...i, reminder_enabled: enabled } : i));
    
    if (enabled) {
      toast.success("We'll remind you when relevant!");
    }
  }

  async function deleteItem(itemId: string) {
    const { error } = await supabase
      .from('trip_go_back_list')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to delete');
      return;
    }

    setItems(items.filter(i => i.id !== itemId));
  }

  const pendingItems = items.filter(i => !i.is_completed);
  const completedItems = items.filter(i => i.is_completed);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border p-8 text-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{destination} · Next Time</h2>
        <p className="text-sm text-muted-foreground">
          Things you want to do when you go back
        </p>
      </div>

      {/* Add Item */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex gap-2">
          <Select
            value={newCategory}
            onValueChange={(v) => setNewCategory(v as GoBackItem['category'])}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORIES).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <config.icon className={cn('w-4 h-4', config.color)} />
                    {config.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="What do you want to do next time?"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            className="flex-1"
          />
          <Button onClick={addItem} disabled={!newItem.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <div className="bg-card rounded-2xl border p-8 text-center">
          <RotateCcw className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">Nothing on your list yet</h3>
          <p className="text-muted-foreground text-sm">
            What would you do differently or add next time?
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending Items */}
          {pendingItems.length > 0 && (
            <div className="space-y-2">
              <AnimatePresence>
                {pendingItems.map((item) => {
                  const catConfig = CATEGORIES[item.category] || CATEGORIES.other;
                  const Icon = catConfig.icon;
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-card rounded-xl border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleComplete(item.id, true)}
                          className="w-5 h-5 rounded border-2 border-muted-foreground/30 hover:border-primary transition-colors flex-shrink-0"
                        />
                        <Icon className={cn('w-4 h-4 flex-shrink-0', catConfig.color)} />
                        <span className="flex-1">{item.item}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'text-muted-foreground',
                            item.reminder_enabled && 'text-primary'
                          )}
                          onClick={() => toggleReminder(item.id, !item.reminder_enabled)}
                          title={item.reminder_enabled ? 'Reminder on' : 'Set reminder'}
                        >
                          <Bell className={cn('w-4 h-4', item.reminder_enabled && 'fill-current')} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => deleteItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Completed Items */}
          {completedItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Done on return visits</h4>
              {completedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-muted/50 rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleComplete(item.id, false)}
                      className="w-5 h-5 rounded bg-primary text-white flex items-center justify-center flex-shrink-0"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <span className="flex-1 line-through text-muted-foreground">{item.item}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reminder Info */}
      {items.some(i => i.reminder_enabled) && (
        <div className="bg-primary/5 rounded-lg p-4 text-sm text-muted-foreground">
          <Bell className="w-4 h-4 inline-block mr-2 text-primary" />
          We'll let you know when something on your list becomes available or relevant.
        </div>
      )}
    </div>
  );
}
