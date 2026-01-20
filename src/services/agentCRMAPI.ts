import { supabase } from '@/integrations/supabase/client';

// Types
export interface AgentClient {
  id: string;
  agent_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  travel_preferences: {
    budget_tier?: 'budget' | 'mid' | 'luxury';
    pace?: 'relaxed' | 'moderate' | 'active';
    interests?: string[];
    dietary?: string[];
    accessibility?: string[];
  };
  notes: string | null;
  tags: string[];
  total_trips: number;
  total_revenue_cents: number;
  last_trip_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentClientInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  travel_preferences?: AgentClient['travel_preferences'];
  notes?: string;
  tags?: string[];
}

export interface AgentSettings {
  travel_agent_mode: boolean;
  agent_business_name: string | null;
  agent_business_email: string | null;
}

// Get agent settings
export async function getAgentSettings(): Promise<AgentSettings | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_preferences')
    .select('travel_agent_mode, agent_business_name, agent_business_email')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching agent settings:', error);
    return null;
  }

  return data as AgentSettings;
}

// Update agent settings
export async function updateAgentSettings(settings: Partial<AgentSettings>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('user_preferences')
    .update(settings)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error updating agent settings:', error);
    return false;
  }

  return true;
}

// Get all clients for the current agent
export async function getAgentClients(): Promise<AgentClient[]> {
  const { data, error } = await supabase
    .from('agent_clients')
    .select('*')
    .order('last_name', { ascending: true });

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }

  return (data || []) as AgentClient[];
}

// Get a single client
export async function getAgentClient(clientId: string): Promise<AgentClient | null> {
  const { data, error } = await supabase
    .from('agent_clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error) {
    console.error('Error fetching client:', error);
    return null;
  }

  return data as AgentClient;
}

// Create a new client
export async function createAgentClient(input: AgentClientInput): Promise<AgentClient | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('agent_clients')
    .insert({
      agent_id: user.id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email || null,
      phone: input.phone || null,
      travel_preferences: input.travel_preferences || {},
      notes: input.notes || null,
      tags: input.tags || [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating client:', error);
    return null;
  }

  return data as AgentClient;
}

// Update a client
export async function updateAgentClient(
  clientId: string, 
  input: Partial<AgentClientInput>
): Promise<AgentClient | null> {
  const { data, error } = await supabase
    .from('agent_clients')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)
    .select()
    .single();

  if (error) {
    console.error('Error updating client:', error);
    return null;
  }

  return data as AgentClient;
}

// Delete a client
export async function deleteAgentClient(clientId: string): Promise<boolean> {
  const { error } = await supabase
    .from('agent_clients')
    .delete()
    .eq('id', clientId);

  if (error) {
    console.error('Error deleting client:', error);
    return false;
  }

  return true;
}

// Get trips for a specific client
export async function getClientTrips(clientId: string) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching client trips:', error);
    return [];
  }

  return data || [];
}

// Get agent dashboard stats
export async function getAgentDashboardStats() {
  const { data: clients, error: clientsError } = await supabase
    .from('agent_clients')
    .select('id, total_trips, total_revenue_cents, created_at');

  if (clientsError) {
    console.error('Error fetching dashboard stats:', clientsError);
    return null;
  }

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, status, client_id, created_at')
    .eq('is_agent_trip', true);

  if (tripsError) {
    console.error('Error fetching trip stats:', tripsError);
    return null;
  }

  const totalClients = clients?.length || 0;
  const totalTrips = trips?.length || 0;
  const activeTrips = trips?.filter(t => t.status === 'booked' || t.status === 'draft').length || 0;
  const totalRevenue = clients?.reduce((sum, c) => sum + (c.total_revenue_cents || 0), 0) || 0;

  return {
    totalClients,
    totalTrips,
    activeTrips,
    totalRevenue,
  };
}
