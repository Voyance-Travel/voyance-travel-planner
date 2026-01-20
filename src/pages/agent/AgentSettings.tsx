import { useState, useEffect } from 'react';
import { Building2, Loader2, Save, CreditCard } from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAgentAuth } from '@/hooks/useAgentAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AgentSettingsData {
  travel_agent_mode: boolean;
  agent_business_name: string | null;
  agent_business_email: string | null;
  agent_business_phone: string | null;
  agent_business_address: string | null;
  agent_default_currency: string | null;
  agent_tagline: string | null;
}

export default function AgentSettings() {
  const { isReady, isLoading: authLoading, user } = useAgentAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [settings, setSettings] = useState<AgentSettingsData>({
    travel_agent_mode: true,
    agent_business_name: '',
    agent_business_email: '',
    agent_business_phone: '',
    agent_business_address: '',
    agent_default_currency: 'USD',
    agent_tagline: '',
  });

  useEffect(() => {
    if (!isReady) return;
    loadSettings();
  }, [isReady]);

  const loadSettings = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('travel_agent_mode, agent_business_name, agent_business_email')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setSettings(prev => ({
          ...prev,
          travel_agent_mode: data.travel_agent_mode ?? true,
          agent_business_name: data.agent_business_name ?? '',
          agent_business_email: data.agent_business_email ?? '',
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          travel_agent_mode: settings.travel_agent_mode,
          agent_business_name: settings.agent_business_name || null,
          agent_business_email: settings.agent_business_email || null,
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      
      toast({ title: 'Settings saved successfully' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || (isReady && isLoading)) {
    return (
      <AgentLayout breadcrumbs={[{ label: 'Dashboard', href: '/agent' }, { label: 'Settings' }]}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/agent' },
        { label: 'Settings' }
      ]}
    >
      <Head
        title="Agency Settings | AgentOS"
        description="Configure your travel agency settings"
      />

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold">Agency Settings</h1>
            <p className="text-muted-foreground">
              Configure your business details and preferences
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>

        <div className="space-y-6">
          {/* Business Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Business Information</CardTitle>
                  <CardDescription>Your agency details for client-facing documents</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-name">Business Name</Label>
                <Input
                  id="business-name"
                  placeholder="Your Travel Agency"
                  value={settings.agent_business_name || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, agent_business_name: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Displayed on quotes, invoices, and client portals
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline (optional)</Label>
                <Input
                  id="tagline"
                  placeholder="Your journey, our expertise"
                  value={settings.agent_tagline || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, agent_tagline: e.target.value }))}
                />
              </div>
              
              <Separator />
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-email">Business Email</Label>
                  <Input
                    id="business-email"
                    type="email"
                    placeholder="hello@youragency.com"
                    value={settings.agent_business_email || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, agent_business_email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-phone">Business Phone</Label>
                  <Input
                    id="business-phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={settings.agent_business_phone || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, agent_business_phone: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="business-address">Business Address</Label>
                <Textarea
                  id="business-address"
                  placeholder="123 Main Street, Suite 100&#10;City, State 12345"
                  value={settings.agent_business_address || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, agent_business_address: e.target.value }))}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Default Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <CreditCard className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-lg">Default Settings</CardTitle>
                  <CardDescription>Configure defaults for new trips and invoices</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <select
                  id="currency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={settings.agent_default_currency || 'USD'}
                  onChange={(e) => setSettings(prev => ({ ...prev, agent_default_currency: e.target.value }))}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Agent Mode Toggle */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-lg">Agent Mode</CardTitle>
              <CardDescription>Manage your travel agent features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="agent-mode" className="text-sm font-medium">
                    Travel Agent Mode Enabled
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Disabling will hide the Agent sidebar and CRM features
                  </p>
                </div>
                <Switch
                  id="agent-mode"
                  checked={settings.travel_agent_mode}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, travel_agent_mode: checked }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AgentLayout>
  );
}
