import { useState, useEffect } from 'react';
import { 
  User, 
  Plane, 
  Utensils, 
  Heart, 
  Save,
  Calendar,
  Phone,
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TravelerProfile {
  legalFirstName: string;
  legalMiddleName: string;
  legalLastName: string;
  preferredName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  passportCountry: string;
  passportExpiry: string;
  knownTravelerNumber: string;
  globalEntryNumber: string;
  redressNumber: string;
  seatPreference: string;
  mealPreference: string;
  dietaryRestrictions: string[];
  allergies: string[];
  mobilityNeeds: string;
  medicalNotes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

const SEAT_PREFERENCES = ['Window', 'Aisle', 'Middle', 'No Preference'];
const MEAL_PREFERENCES = ['Regular', 'Vegetarian', 'Vegan', 'Kosher', 'Halal', 'Gluten-Free', 'Diabetic', 'Low Sodium'];
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Kosher', 'Halal', 'Pescatarian'];
const ALLERGY_OPTIONS = ['Peanuts', 'Tree Nuts', 'Shellfish', 'Fish', 'Eggs', 'Dairy', 'Wheat', 'Soy', 'Sesame'];

export default function ClientIntakeSection() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [traveler, setTraveler] = useState<TravelerProfile>({
    legalFirstName: '',
    legalMiddleName: '',
    legalLastName: '',
    preferredName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    passportCountry: '',
    passportExpiry: '',
    knownTravelerNumber: '',
    globalEntryNumber: '',
    redressNumber: '',
    seatPreference: '',
    mealPreference: '',
    dietaryRestrictions: [],
    allergies: [],
    mobilityNeeds: '',
    medicalNotes: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });

  useEffect(() => {
    loadTravelerData();
  }, [user?.email]);

  const loadTravelerData = async () => {
    if (!user?.email) return;
    setLoading(true);

    try {
      // Find traveler record linked to this email
      const { data, error } = await supabase
        .from('agency_travelers')
        .select('*')
        .eq('email', user.email)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const emergencyContact = (data.emergency_contact as any) || {};
        setTraveler({
          legalFirstName: data.legal_first_name || '',
          legalMiddleName: data.legal_middle_name || '',
          legalLastName: data.legal_last_name || '',
          preferredName: data.preferred_name || '',
          dateOfBirth: data.date_of_birth || '',
          gender: data.gender || '',
          phone: data.phone || '',
          passportCountry: data.passport_country || '',
          passportExpiry: data.passport_expiry || '',
          knownTravelerNumber: data.known_traveler_number || '',
          globalEntryNumber: data.global_entry_number || '',
          redressNumber: data.redress_number || '',
          seatPreference: data.seat_preference || '',
          mealPreference: data.meal_preference || '',
          dietaryRestrictions: data.dietary_restrictions || [],
          allergies: data.allergies || [],
          mobilityNeeds: data.mobility_needs || '',
          medicalNotes: data.medical_notes || '',
          emergencyContactName: emergencyContact.name || '',
          emergencyContactPhone: emergencyContact.phone || '',
          emergencyContactRelation: emergencyContact.relationship || '',
        });
      } else {
        // No existing record
      }
    } catch (error) {
      console.error('Failed to load traveler data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.email) return;
    setSaving(true);
    setSaved(false);

    try {
      const updateData = {
        legal_first_name: traveler.legalFirstName,
        legal_middle_name: traveler.legalMiddleName || null,
        legal_last_name: traveler.legalLastName,
        preferred_name: traveler.preferredName || null,
        date_of_birth: traveler.dateOfBirth || null,
        gender: traveler.gender || null,
        phone: traveler.phone || null,
        passport_country: traveler.passportCountry || null,
        passport_expiry: traveler.passportExpiry || null,
        known_traveler_number: traveler.knownTravelerNumber || null,
        global_entry_number: traveler.globalEntryNumber || null,
        redress_number: traveler.redressNumber || null,
        seat_preference: traveler.seatPreference || null,
        meal_preference: traveler.mealPreference || null,
        dietary_restrictions: traveler.dietaryRestrictions.length > 0 ? traveler.dietaryRestrictions : null,
        allergies: traveler.allergies.length > 0 ? traveler.allergies : null,
        mobility_needs: traveler.mobilityNeeds || null,
        medical_notes: traveler.medicalNotes || null,
        emergency_contact: (traveler.emergencyContactName || traveler.emergencyContactPhone) ? {
          name: traveler.emergencyContactName,
          phone: traveler.emergencyContactPhone,
          relationship: traveler.emergencyContactRelation,
        } : null,
        updated_at: new Date().toISOString(),
      };

      // Try to update existing record first
      const { data: existing } = await supabase
        .from('agency_travelers')
        .select('id')
        .eq('email', user.email)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('agency_travelers')
          .update(updateData)
          .eq('id', existing.id);

        if (error) throw error;
      }

      toast.success('Profile saved successfully');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayItem = (array: string[], item: string, setter: (items: string[]) => void) => {
    if (array.includes(item)) {
      setter(array.filter(i => i !== item));
    } else {
      setter([...array, item]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Your legal name must match your passport or government ID
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="firstName">Legal First Name *</Label>
              <Input
                id="firstName"
                value={traveler.legalFirstName}
                onChange={(e) => setTraveler(prev => ({ ...prev, legalFirstName: e.target.value }))}
                placeholder="As shown on passport"
              />
            </div>
            <div>
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={traveler.legalMiddleName}
                onChange={(e) => setTraveler(prev => ({ ...prev, legalMiddleName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Legal Last Name *</Label>
              <Input
                id="lastName"
                value={traveler.legalLastName}
                onChange={(e) => setTraveler(prev => ({ ...prev, legalLastName: e.target.value }))}
                placeholder="As shown on passport"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="preferredName">Preferred Name</Label>
              <Input
                id="preferredName"
                value={traveler.preferredName}
                onChange={(e) => setTraveler(prev => ({ ...prev, preferredName: e.target.value }))}
                placeholder="What you'd like to be called"
              />
            </div>
            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={traveler.dateOfBirth}
                onChange={(e) => setTraveler(prev => ({ ...prev, dateOfBirth: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={traveler.gender}
                onValueChange={(value) => setTraveler(prev => ({ ...prev, gender: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={traveler.phone}
              onChange={(e) => setTraveler(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </CardContent>
      </Card>

      {/* Travel Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Travel Documents
          </CardTitle>
          <CardDescription>
            Optional but recommended for faster booking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="passportCountry">Passport Country</Label>
              <Input
                id="passportCountry"
                value={traveler.passportCountry}
                onChange={(e) => setTraveler(prev => ({ ...prev, passportCountry: e.target.value }))}
                placeholder="e.g., United States"
              />
            </div>
            <div>
              <Label htmlFor="passportExpiry">Passport Expiry Date</Label>
              <Input
                id="passportExpiry"
                type="date"
                value={traveler.passportExpiry}
                onChange={(e) => setTraveler(prev => ({ ...prev, passportExpiry: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ktn">Known Traveler Number</Label>
              <Input
                id="ktn"
                value={traveler.knownTravelerNumber}
                onChange={(e) => setTraveler(prev => ({ ...prev, knownTravelerNumber: e.target.value }))}
                placeholder="TSA PreCheck"
              />
            </div>
            <div>
              <Label htmlFor="globalEntry">Global Entry Number</Label>
              <Input
                id="globalEntry"
                value={traveler.globalEntryNumber}
                onChange={(e) => setTraveler(prev => ({ ...prev, globalEntryNumber: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="redress">Redress Number</Label>
              <Input
                id="redress"
                value={traveler.redressNumber}
                onChange={(e) => setTraveler(prev => ({ ...prev, redressNumber: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Travel Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Travel Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Seat Preference</Label>
              <Select
                value={traveler.seatPreference}
                onValueChange={(value) => setTraveler(prev => ({ ...prev, seatPreference: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select preference" />
                </SelectTrigger>
                <SelectContent>
                  {SEAT_PREFERENCES.map(pref => (
                    <SelectItem key={pref} value={pref.toLowerCase().replace(' ', '_')}>
                      {pref}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meal Preference</Label>
              <Select
                value={traveler.mealPreference}
                onValueChange={(value) => setTraveler(prev => ({ ...prev, mealPreference: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select preference" />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_PREFERENCES.map(pref => (
                    <SelectItem key={pref} value={pref.toLowerCase().replace(' ', '_')}>
                      {pref}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Dietary Restrictions</Label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map(option => (
                <Badge
                  key={option}
                  variant={traveler.dietaryRestrictions.includes(option) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayItem(
                    traveler.dietaryRestrictions, 
                    option, 
                    (items) => setTraveler(prev => ({ ...prev, dietaryRestrictions: items }))
                  )}
                >
                  {option}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Allergies</Label>
            <div className="flex flex-wrap gap-2">
              {ALLERGY_OPTIONS.map(option => (
                <Badge
                  key={option}
                  variant={traveler.allergies.includes(option) ? 'destructive' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayItem(
                    traveler.allergies, 
                    option, 
                    (items) => setTraveler(prev => ({ ...prev, allergies: items }))
                  )}
                >
                  {option}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="mobility">Mobility Needs / Accessibility</Label>
            <Textarea
              id="mobility"
              value={traveler.mobilityNeeds}
              onChange={(e) => setTraveler(prev => ({ ...prev, mobilityNeeds: e.target.value }))}
              placeholder="Wheelchair assistance, service animal, etc."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="medical">Medical Notes (Optional)</Label>
            <Textarea
              id="medical"
              value={traveler.medicalNotes}
              onChange={(e) => setTraveler(prev => ({ ...prev, medicalNotes: e.target.value }))}
              placeholder="Any medical conditions your travel agent should be aware of"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Emergency Contact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="emergencyName">Contact Name</Label>
              <Input
                id="emergencyName"
                value={traveler.emergencyContactName}
                onChange={(e) => setTraveler(prev => ({ ...prev, emergencyContactName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="emergencyPhone">Contact Phone</Label>
              <Input
                id="emergencyPhone"
                type="tel"
                value={traveler.emergencyContactPhone}
                onChange={(e) => setTraveler(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="emergencyRelation">Relationship</Label>
              <Input
                id="emergencyRelation"
                value={traveler.emergencyContactRelation}
                onChange={(e) => setTraveler(prev => ({ ...prev, emergencyContactRelation: e.target.value }))}
                placeholder="e.g., Spouse, Parent"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          size="lg" 
          onClick={handleSave} 
          disabled={saving || !traveler.legalFirstName || !traveler.legalLastName}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Profile
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
