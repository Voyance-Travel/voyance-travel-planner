import { useState, useEffect } from 'react';
import { 
  Library, 
  Search, 
  Plus, 
  Trash2, 
  Calendar, 
  MapPin, 
  Clock,
  Tag,
  Sparkles,
  CheckCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  getLibraryItems, 
  deleteLibraryItem,
  incrementUsageCount,
  type LibraryItem,
  type LibraryItemType
} from '@/services/agencyCRM/library';
import type { EditorialActivity, EditorialDay } from '@/components/itinerary/EditorialItinerary';
import { toast } from '@/hooks/use-toast';

interface LibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'browse' | 'select';
  selectType?: LibraryItemType;
  onSelect?: (item: LibraryItem) => void;
}

export default function LibraryModal({ 
  open, 
  onOpenChange, 
  mode,
  selectType,
  onSelect 
}: LibraryModalProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LibraryItemType>(selectType || 'activity');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open, activeTab]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await getLibraryItems({ 
        itemType: activeTab,
        search: searchQuery || undefined 
      });
      setItems(data);
    } catch (error) {
      console.error('Failed to load library items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    loadItems();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLibraryItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      toast({ title: 'Item deleted from library' });
    } catch (error) {
      toast({ title: 'Failed to delete item', variant: 'destructive' });
    }
  };

  const handleSelect = async (item: LibraryItem) => {
    if (mode === 'select' && onSelect) {
      await incrementUsageCount(item.id);
      onSelect(item);
      onOpenChange(false);
    }
  };

  const renderActivityItem = (item: LibraryItem) => {
    const activity = item.content as EditorialActivity;
    return (
      <div 
        key={item.id}
        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
          selectedId === item.id 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
        onClick={() => {
          setSelectedId(item.id);
          if (mode === 'select') handleSelect(item);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{item.name}</h4>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {activity.type && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {activity.type}
                </span>
              )}
              {activity.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {activity.duration}
                </span>
              )}
              {item.destination_hint && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.destination_hint}
                </span>
              )}
            </div>
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {mode === 'browse' && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          {mode === 'select' && selectedId === item.id && (
            <CheckCircle className="h-5 w-5 text-primary" />
          )}
        </div>
      </div>
    );
  };

  const renderDayItem = (item: LibraryItem) => {
    const day = item.content as EditorialDay;
    return (
      <div 
        key={item.id}
        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
          selectedId === item.id 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
        onClick={() => {
          setSelectedId(item.id);
          if (mode === 'select') handleSelect(item);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{item.name}</h4>
            {day.theme && (
              <p className="text-sm text-primary mt-1">{day.theme}</p>
            )}
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {day.activities?.length || 0} activities
              </span>
              {item.destination_hint && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.destination_hint}
                </span>
              )}
            </div>
          </div>
          {mode === 'browse' && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          {mode === 'select' && selectedId === item.id && (
            <CheckCircle className="h-5 w-5 text-primary" />
          )}
        </div>
      </div>
    );
  };

  const renderTripTemplateItem = (item: LibraryItem) => {
    const template = item.content as { duration_days?: number; destination?: string };
    return (
      <div 
        key={item.id}
        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
          selectedId === item.id 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
        onClick={() => {
          setSelectedId(item.id);
          if (mode === 'select') handleSelect(item);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{item.name}</h4>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {template.duration_days && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {template.duration_days} days
                </span>
              )}
              {template.destination && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {template.destination}
                </span>
              )}
              <span className="text-muted-foreground">
                Used {item.usage_count}×
              </span>
            </div>
          </div>
          {mode === 'browse' && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          {mode === 'select' && selectedId === item.id && (
            <CheckCircle className="h-5 w-5 text-primary" />
          )}
        </div>
      </div>
    );
  };

  const renderItems = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No items in library</h3>
          <p className="text-sm text-muted-foreground">
            Save activities, days, or trip templates to reuse them later.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map(item => {
          switch (item.item_type) {
            case 'activity':
              return renderActivityItem(item);
            case 'day':
              return renderDayItem(item);
            case 'trip_template':
              return renderTripTemplateItem(item);
            default:
              return null;
          }
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            {mode === 'select' ? 'Insert from Library' : 'My Library'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'select' 
              ? 'Select an item to insert into your itinerary'
              : 'Manage your saved activities, days, and trip templates'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>
            Search
          </Button>
        </div>

        {!selectType && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LibraryItemType)} className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="activity">Activities</TabsTrigger>
              <TabsTrigger value="day">Days</TabsTrigger>
              <TabsTrigger value="trip_template">Templates</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <ScrollArea className="h-[400px] mt-4 pr-4">
          {renderItems()}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
