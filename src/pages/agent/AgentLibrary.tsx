import { useState, useEffect } from 'react';
import { Library, Plus, Search, Calendar, MapPin, Sparkles, Trash2 } from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  getLibraryItems, 
  deleteLibraryItem,
  type LibraryItem,
  type LibraryItemType
} from '@/services/agencyCRM/library';
import type { EditorialActivity, EditorialDay } from '@/components/itinerary/EditorialItinerary';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AgentLibrary() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LibraryItemType>('activity');

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    loadItems();
  }, [isAuthenticated, authLoading, activeTab]);

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
      toast({ title: 'Failed to load library', variant: 'destructive' });
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

  const renderActivityItem = (item: LibraryItem) => {
    const activity = item.content as EditorialActivity;
    return (
      <Card key={item.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
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
                  <Badge variant="secondary">{activity.type}</Badge>
                )}
                {item.destination_hint && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {item.destination_hint}
                  </span>
                )}
                <span>Used {item.usage_count}×</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDayItem = (item: LibraryItem) => {
    const day = item.content as EditorialDay;
    return (
      <Card key={item.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{item.name}</h4>
              {day.theme && (
                <p className="text-sm text-primary mt-1">{day.theme}</p>
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
                <span>Used {item.usage_count}×</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTripTemplateItem = (item: LibraryItem) => {
    const template = item.content as { duration_days?: number; destination?: string };
    return (
      <Card key={item.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
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
                <span>Used {item.usage_count}×</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderItems = () => {
    if (isLoading) {
      return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="text-center py-16">
          <Library className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No items in library</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Save activities, days, or trip templates from your trips to reuse them later.
            Build your library as you work!
          </p>
        </div>
      );
    }

    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    <AgentLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/agent' },
        { label: 'Library' }
      ]}
    >
      <Head
        title="My Library | AgentOS"
        description="Reusable activities, days, and trip templates"
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold">My Library</h1>
            <p className="text-muted-foreground">
              Reusable activities, days, and trip templates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="relative flex-1 max-w-md">
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

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LibraryItemType)} className="mb-6">
          <TabsList>
            <TabsTrigger value="activity">Activities</TabsTrigger>
            <TabsTrigger value="day">Days</TabsTrigger>
            <TabsTrigger value="trip_template">Templates</TabsTrigger>
          </TabsList>
        </Tabs>

        {renderItems()}
      </div>
    </AgentLayout>
  );
}
