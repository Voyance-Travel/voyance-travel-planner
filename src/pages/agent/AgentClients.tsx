import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Users, 
  Building2, 
  Mail, 
  Phone,
  MoreHorizontal,
  Plane,
  DollarSign
} from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { getAccounts, deleteAccount, type AgencyAccount } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';

export default function AgentClients() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<AgencyAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [viewType, setViewType] = useState<'all' | 'individual' | 'household' | 'company'>('all');

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    loadAccounts();
  }, [isAuthenticated, authLoading, navigate]);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({ title: 'Failed to load clients', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this client? This will also delete all their travelers and trips.')) return;
    try {
      await deleteAccount(id);
      toast({ title: 'Client deleted' });
      loadAccounts();
    } catch (error) {
      toast({ title: 'Failed to delete client', variant: 'destructive' });
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = 
      account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.billing_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = viewType === 'all' || account.account_type === viewType;
    return matchesSearch && matchesType;
  });

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'company': return Building2;
      case 'household': return Users;
      default: return Users;
    }
  };

  return (
    <AgentLayout>
      <Head title="Clients | Travel Agent CRM" description="Manage your travel clients" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">
              {accounts.length} client{accounts.length !== 1 ? 's' : ''} in your book
            </p>
          </div>
          <Button onClick={() => navigate('/agent/clients/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={viewType} onValueChange={(v) => setViewType(v as typeof viewType)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="individual">Individual</TabsTrigger>
              <TabsTrigger value="household">Household</TabsTrigger>
              <TabsTrigger value="company">Company</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Client List */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5">
                  <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAccounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? 'No clients found' : 'No clients yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? 'Try adjusting your search or filters'
                  : 'Add your first client to get started'
                }
              </p>
              {!searchQuery && (
                <Button onClick={() => navigate('/agent/clients/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((account) => {
              const Icon = getAccountIcon(account.account_type);
              return (
                <Card 
                  key={account.id}
                  className="hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/agent/clients/${account.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{account.name}</h3>
                          {account.company_name && (
                            <p className="text-sm text-muted-foreground">{account.company_name}</p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" aria-label="Client options">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/agent/clients/${account.id}/edit`);
                          }}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(account.id);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      {account.billing_email && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {account.billing_email}
                        </p>
                      )}
                      {account.billing_phone && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {account.billing_phone}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Plane className="h-3.5 w-3.5" />
                        <span>{account.total_trips || 0} trips</span>
                      </div>
                      {(account.total_revenue_cents || 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>{formatCurrency(account.total_revenue_cents || 0)}</span>
                        </div>
                      )}
                    </div>

                    {account.tags && account.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {account.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {account.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{account.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AgentLayout>
  );
}
