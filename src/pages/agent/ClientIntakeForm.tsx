import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Loader2, User, Plane, Utensils, AlertCircle } from 'lucide-react';
import Head from '@/components/common/Head';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

const intakeFormSchema = z.object({
  legal_first_name: z.string().min(2, 'First name must be at least 2 characters'),
  legal_last_name: z.string().min(2, 'Last name must be at least 2 characters'),
  preferred_name: z.string().optional(),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  passport_country: z.string().optional(),
  passport_expiry: z.string().optional(),
  seat_preference: z.string().optional(),
  meal_preference: z.string().optional(),
  dietary_restrictions: z.string().optional(),
  allergies: z.string().optional(),
  mobility_needs: z.string().optional(),
  medical_notes: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  notes: z.string().optional(),
});

type IntakeFormData = z.infer<typeof intakeFormSchema>;

interface AccountInfo {
  id: string;
  name: string;
}

export default function ClientIntakeForm() {
  const { intakeToken } = useParams<{ intakeToken: string }>();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<IntakeFormData>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      legal_first_name: '',
      legal_last_name: '',
      preferred_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: '',
      passport_country: '',
      passport_expiry: '',
      seat_preference: '',
      meal_preference: '',
      dietary_restrictions: '',
      allergies: '',
      mobility_needs: '',
      medical_notes: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relationship: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (intakeToken) {
      loadAccountInfo();
    }
  }, [intakeToken]);

  const loadAccountInfo = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('agency_accounts')
        .select('id, name')
        .eq('intake_token', intakeToken)
        .eq('intake_enabled', true)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) {
        setError('This intake form link is invalid or has expired.');
        setLoading(false);
        return;
      }

      setAccount(data);
    } catch (err) {
      console.error('Error loading account:', err);
      setError('Failed to load intake form');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: IntakeFormData) => {
    if (!intakeToken) return;
    
    setSubmitting(true);
    try {
      // Build emergency contact JSON if any field is filled
      let emergencyContact = null;
      if (data.emergency_contact_name || data.emergency_contact_phone) {
        emergencyContact = {
          name: data.emergency_contact_name || '',
          phone: data.emergency_contact_phone || '',
          relationship: data.emergency_contact_relationship || '',
        };
      }

      // Parse comma-separated values into arrays
      const dietaryRestrictions = data.dietary_restrictions
        ? data.dietary_restrictions.split(',').map(s => s.trim()).filter(Boolean)
        : null;
      const allergies = data.allergies
        ? data.allergies.split(',').map(s => s.trim()).filter(Boolean)
        : null;

      const { data: result, error: submitError } = await supabase.rpc('submit_client_intake', {
        p_intake_token: intakeToken,
        p_legal_first_name: data.legal_first_name,
        p_legal_last_name: data.legal_last_name,
        p_preferred_name: data.preferred_name || null,
        p_email: data.email,
        p_phone: data.phone || null,
        p_date_of_birth: data.date_of_birth || null,
        p_gender: data.gender || null,
        p_passport_country: data.passport_country || null,
        p_passport_expiry: data.passport_expiry || null,
        p_seat_preference: data.seat_preference || null,
        p_meal_preference: data.meal_preference || null,
        p_dietary_restrictions: dietaryRestrictions,
        p_allergies: allergies,
        p_mobility_needs: data.mobility_needs || null,
        p_medical_notes: data.medical_notes || null,
        p_emergency_contact: emergencyContact,
        p_notes: data.notes || null,
      });

      if (submitError) throw submitError;
      
      const resultObj = result as { success: boolean; error?: string };
      if (!resultObj.success) {
        throw new Error(resultObj.error || 'Failed to submit');
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting intake:', err);
      setError('Failed to submit your information. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !account) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Form Not Available</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link to="/" className="text-primary hover:underline">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
          <p className="text-muted-foreground">
            Your travel profile has been submitted successfully. Your travel advisor will be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Head 
        title="Travel Profile | Client Intake Form"
        description="Complete your travel profile to help us plan your perfect trip"
      />

      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-display font-bold">Travel Profile</h1>
          <p className="text-muted-foreground mt-1">
            {account?.name ? `For ${account.name}'s account` : 'Complete your traveler information'}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Personal</span>
                </TabsTrigger>
                <TabsTrigger value="travel" className="flex items-center gap-2">
                  <Plane className="h-4 w-4" />
                  <span className="hidden sm:inline">Travel</span>
                </TabsTrigger>
                <TabsTrigger value="health" className="flex items-center gap-2">
                  <Utensils className="h-4 w-4" />
                  <span className="hidden sm:inline">Health</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      Please enter your name exactly as it appears on your passport
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="legal_first_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Legal First Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="legal_last_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Legal Last Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="preferred_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Name</FormLabel>
                          <FormControl>
                            <Input placeholder="What should we call you?" {...field} />
                          </FormControl>
                          <FormDescription>Optional nickname or preferred name</FormDescription>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="+1 555 123 4567" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="date_of_birth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Emergency Contact</CardTitle>
                    <CardDescription>
                      Someone we can reach in case of emergency during your travels
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="emergency_contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergency_contact_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Phone</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="+1 555 123 4567" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergency_contact_relationship"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relationship</FormLabel>
                            <FormControl>
                              <Input placeholder="Spouse, Parent, etc." {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="travel" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Passport Information</CardTitle>
                    <CardDescription>
                      Required for international travel bookings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="passport_country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport Country</FormLabel>
                            <FormControl>
                              <Input placeholder="United States" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="passport_expiry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport Expiry</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormDescription>Must be valid 6+ months after travel</FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Travel Preferences</CardTitle>
                    <CardDescription>
                      Help us book flights tailored to your preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="seat_preference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seat Preference</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select preference" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="window">Window</SelectItem>
                                <SelectItem value="aisle">Aisle</SelectItem>
                                <SelectItem value="middle">Middle</SelectItem>
                                <SelectItem value="no_preference">No Preference</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="meal_preference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Meal Preference</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select meal type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="regular">Regular</SelectItem>
                                <SelectItem value="vegetarian">Vegetarian</SelectItem>
                                <SelectItem value="vegan">Vegan</SelectItem>
                                <SelectItem value="halal">Halal</SelectItem>
                                <SelectItem value="kosher">Kosher</SelectItem>
                                <SelectItem value="gluten_free">Gluten Free</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="health" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Dietary Requirements</CardTitle>
                    <CardDescription>
                      Let us know about any food restrictions or allergies
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="dietary_restrictions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dietary Restrictions</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Vegetarian, No pork, Low sodium" {...field} />
                          </FormControl>
                          <FormDescription>Separate multiple items with commas</FormDescription>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="allergies"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Food Allergies</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Peanuts, Shellfish, Dairy" {...field} />
                          </FormControl>
                          <FormDescription>Separate multiple items with commas</FormDescription>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Accessibility & Medical</CardTitle>
                    <CardDescription>
                      Information to help us accommodate your needs
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="mobility_needs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobility Needs</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Wheelchair assistance, Limited walking" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="medical_notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medical Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Any medical conditions or special requirements we should know about"
                              className="min-h-[80px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>This information is kept confidential</FormDescription>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Additional Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea 
                              placeholder="Anything else you'd like us to know?"
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Profile'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </main>

      <footer className="border-t bg-muted/30 mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Your information is secure and will only be used for trip planning purposes.
          </p>
        </div>
      </footer>
    </div>
  );
}