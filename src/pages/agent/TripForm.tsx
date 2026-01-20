import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Calendar } from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { getAccounts, getTrip, createTrip, updateTrip, type AgencyTrip, type AgencyAccount } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';

type FormData = Partial<AgencyTrip>;

export default function TripForm() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<AgencyAccount[]>([]);
  
  const isEdit = !!tripId && tripId !== 'new';
  
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormData>({
    defaultValues: {
      status: 'inquiry',
      pipeline_stage: 1,
      traveler_count: 2,
      currency: 'USD',
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    loadData();
  }, [isAuthenticated, tripId, navigate]);

  const loadData = async () => {
    try {
      const accountsData = await getAccounts();
      setAccounts(accountsData);
      
      if (isEdit && tripId) {
        const trip = await getTrip(tripId);
        if (trip) {
          reset(trip);
        }
      }
    } catch (error) {
      toast({ title: 'Failed to load data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!data.account_id) {
      toast({ title: 'Please select a client', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (isEdit && tripId) {
        await updateTrip(tripId, data);
        toast({ title: 'Trip updated' });
        navigate(`/agent/trips/${tripId}`);
      } else {
        const newTrip = await createTrip(data as Parameters<typeof createTrip>[0]);
        toast({ title: 'Trip created' });
        navigate(`/agent/trips/${newTrip.id}`);
      }
    } catch (error) {
      toast({ title: 'Failed to save trip', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AgentLayout>
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-60 bg-muted rounded" />
          </div>
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/agent' },
        { label: 'Trips', href: '/agent/trips' },
        { label: isEdit ? 'Edit' : 'New' }
      ]}
    >
      <Head title={isEdit ? 'Edit Trip' : 'New Trip'} />

      <div className="max-w-2xl mx-auto px-4 py-2 lg:px-6">
        {/* Header */}
        <h1 className="text-2xl font-display font-bold mb-6">
          {isEdit ? 'Edit Trip' : 'New Trip'}
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trip Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Client *</Label>
                <Select 
                  value={watch('account_id') || ''} 
                  onValueChange={(v) => setValue('account_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                        {account.company_name && ` (${account.company_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accounts.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    No clients yet.{' '}
                    <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/agent/clients/new')}>
                      Add a client first
                    </Button>
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="name">Trip Name *</Label>
                <Input 
                  id="name" 
                  {...register('name')} 
                  required 
                  placeholder="e.g., Smith Family Italy 2026"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="destination">Destination</Label>
                  <Input 
                    id="destination" 
                    {...register('destination')} 
                    placeholder="e.g., Italy, France, Spain"
                  />
                </div>
                <div>
                  <Label htmlFor="trip_type">Trip Type</Label>
                  <Select 
                    value={watch('trip_type') || ''} 
                    onValueChange={(v) => setValue('trip_type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leisure">Leisure</SelectItem>
                      <SelectItem value="honeymoon">Honeymoon</SelectItem>
                      <SelectItem value="anniversary">Anniversary</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="adventure">Adventure</SelectItem>
                      <SelectItem value="cruise">Cruise</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="group">Group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" type="date" {...register('start_date')} />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" type="date" {...register('end_date')} />
                </div>
                <div>
                  <Label htmlFor="traveler_count">Travelers</Label>
                  <Input 
                    id="traveler_count" 
                    type="number" 
                    min="1"
                    {...register('traveler_count', { valueAsNumber: true })} 
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description"
                  {...register('description')} 
                  placeholder="Brief overview of what the client is looking for..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                {...register('internal_notes')} 
                placeholder="Private notes (not shared with client)..."
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/agent/trips')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Trip'}
            </Button>
          </div>
        </form>
      </div>
    </AgentLayout>
  );
}
