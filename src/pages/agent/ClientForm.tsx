import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  createAgentClient, 
  updateAgentClient, 
  getAgentClient,
  type AgentClientInput,
  type AgentClient
} from '@/services/agentCRMAPI';
import { toast } from '@/hooks/use-toast';

const INTERESTS = [
  'Culture & History',
  'Food & Dining',
  'Adventure',
  'Beach & Relaxation',
  'Nature & Wildlife',
  'Art & Museums',
  'Nightlife',
  'Shopping',
  'Photography',
  'Architecture',
];

const DIETARY = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Kosher',
  'Halal',
  'Dairy-Free',
  'No Restrictions',
];

export default function ClientForm() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const { isAuthenticated } = useAuth();
  const isEditing = !!clientId;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [budgetTier, setBudgetTier] = useState<string>('');
  const [pace, setPace] = useState<string>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    
    if (isEditing && clientId) {
      loadClient(clientId);
    }
  }, [isAuthenticated, clientId, isEditing, navigate]);

  const loadClient = async (id: string) => {
    setIsLoading(true);
    const client = await getAgentClient(id);
    if (client) {
      setFirstName(client.first_name);
      setLastName(client.last_name);
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setBudgetTier(client.travel_preferences?.budget_tier || '');
      setPace(client.travel_preferences?.pace || '');
      setInterests(client.travel_preferences?.interests || []);
      setDietary(client.travel_preferences?.dietary || []);
      setNotes(client.notes || '');
      setTags(client.tags || []);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: 'First and last name are required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const input: AgentClientInput = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      travel_preferences: {
        budget_tier: budgetTier as 'budget' | 'mid' | 'luxury' | undefined,
        pace: pace as 'relaxed' | 'moderate' | 'active' | undefined,
        interests,
        dietary,
      },
      notes: notes.trim() || undefined,
      tags,
    };

    let result: AgentClient | null;
    
    if (isEditing && clientId) {
      result = await updateAgentClient(clientId, input);
    } else {
      result = await createAgentClient(input);
    }

    setIsSaving(false);

    if (result) {
      toast({ title: isEditing ? 'Client updated' : 'Client created' });
      navigate('/agent');
    } else {
      toast({ title: 'Failed to save client', variant: 'destructive' });
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleDietary = (item: string) => {
    setDietary(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head
        title={isEditing ? 'Edit Client | Voyance' : 'Add Client | Voyance'}
        description="Manage client profile and preferences"
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agent')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {isEditing ? 'Edit Client' : 'Add New Client'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update client information and preferences' : 'Enter client details to get started'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Basic details for your client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Travel Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Travel Preferences</CardTitle>
              <CardDescription>Help us personalize itineraries for this client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Budget Level</Label>
                  <Select value={budgetTier} onValueChange={setBudgetTier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select budget" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">Budget-Friendly</SelectItem>
                      <SelectItem value="mid">Mid-Range</SelectItem>
                      <SelectItem value="luxury">Luxury</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Travel Pace</Label>
                  <Select value={pace} onValueChange={setPace}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pace" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relaxed">Relaxed</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Interests</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {INTERESTS.map((interest) => (
                    <div key={interest} className="flex items-center space-x-2">
                      <Checkbox
                        id={interest}
                        checked={interests.includes(interest)}
                        onCheckedChange={() => toggleInterest(interest)}
                      />
                      <label
                        htmlFor={interest}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {interest}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Dietary Requirements</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {DIETARY.map((item) => (
                    <div key={item} className="flex items-center space-x-2">
                      <Checkbox
                        id={item}
                        checked={dietary.includes(item)}
                        onCheckedChange={() => toggleDietary(item)}
                      />
                      <label
                        htmlFor={item}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {item}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Notes & Organization</CardTitle>
              <CardDescription>Add notes and tags to help organize your clients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests, preferences, or notes about this client..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button 
                        type="button"
                        onClick={() => setTags(tags.filter(t => t !== tag))}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  placeholder="Type a tag and press Enter (e.g., VIP, Family, Honeymoon)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const value = (e.target as HTMLInputElement).value.trim();
                      if (value && !tags.includes(value)) {
                        setTags([...tags, value]);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/agent')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEditing ? 'Save Changes' : 'Create Client'}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
