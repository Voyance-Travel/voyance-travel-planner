import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';

import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { getAccount, createAccount, updateAccount, type AgencyAccount, type AgencyAccountType } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';

type FormData = Partial<AgencyAccount> & {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export default function AccountForm() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!clientId);
  
  const isEdit = !!clientId && clientId !== 'new';
  
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormData>({
    defaultValues: {
      account_type: 'individual',
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    if (isEdit) {
      loadAccount();
    }
  }, [isAuthenticated, clientId, navigate]);

  const loadAccount = async () => {
    if (!clientId) return;
    try {
      const account = await getAccount(clientId);
      if (account) {
        reset({
          ...account,
          street: account.billing_address?.street,
          city: account.billing_address?.city,
          state: account.billing_address?.state,
          postal_code: account.billing_address?.postal_code,
          country: account.billing_address?.country,
        });
      }
    } catch (error) {
      toast({ title: 'Failed to load client', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name!,
        account_type: data.account_type as AgencyAccountType,
        company_name: data.company_name,
        billing_email: data.billing_email,
        billing_phone: data.billing_phone,
        billing_address: {
          street: data.street,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          country: data.country,
        },
        notes: data.notes,
        tags: data.tags,
        referral_source: data.referral_source,
      };

      if (isEdit) {
        await updateAccount(clientId!, payload);
        toast({ title: 'Client updated' });
        navigate(`/agent/clients/${clientId}`);
      } else {
        const newAccount = await createAccount(payload);
        toast({ title: 'Client created' });
        navigate(`/agent/clients/${newAccount.id}`);
      }
    } catch (error) {
      toast({ title: 'Failed to save client', variant: 'destructive' });
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
            <div className="h-40 bg-muted rounded" />
          </div>
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/agent' },
        { label: 'Clients', href: '/agent/clients' },
        { label: isEdit ? 'Edit' : 'New' }
      ]}
    >
      <Head title={isEdit ? 'Edit Client' : 'New Client'} />

      <div className="max-w-2xl mx-auto px-4 py-2 lg:px-6">
        {/* Header */}
        <h1 className="text-2xl font-display font-bold mb-6">
          {isEdit ? 'Edit Client' : 'New Client'}
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Client Name *</Label>
                  <Input 
                    id="name" 
                    {...register('name')} 
                    required 
                    placeholder="e.g., John & Jane Smith"
                  />
                </div>
                <div>
                  <Label>Account Type</Label>
                  <Select 
                    value={watch('account_type') || 'individual'} 
                    onValueChange={(v) => setValue('account_type', v as AgencyAccountType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="household">Household</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {watch('account_type') === 'company' && (
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input id="company_name" {...register('company_name')} />
                </div>
              )}

              <div>
                <Label htmlFor="referral_source">How did they find you?</Label>
                <Input 
                  id="referral_source" 
                  {...register('referral_source')} 
                  placeholder="Referral, Google, Instagram, etc."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact & Billing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="billing_email">Email</Label>
                  <Input id="billing_email" type="email" {...register('billing_email')} />
                </div>
                <div>
                  <Label htmlFor="billing_phone">Phone</Label>
                  <Input id="billing_phone" type="tel" {...register('billing_phone')} />
                </div>
              </div>

              <Separator />

              <p className="text-sm font-medium text-muted-foreground">Billing Address</p>
              <div>
                <Label htmlFor="street">Street Address</Label>
                <Input id="street" {...register('street')} />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...register('city')} />
                </div>
                <div>
                  <Label htmlFor="state">State / Province</Label>
                  <Input id="state" {...register('state')} />
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input id="postal_code" {...register('postal_code')} />
                </div>
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register('country')} placeholder="United States" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                {...register('notes')} 
                placeholder="Any notes about this client, their preferences, important dates, etc."
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/agent/clients')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Client'}
            </Button>
          </div>
        </form>
      </div>
    </AgentLayout>
  );
}
