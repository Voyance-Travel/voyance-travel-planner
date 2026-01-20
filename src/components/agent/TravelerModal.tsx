import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTraveler, updateTraveler, deleteTraveler, type AgencyTraveler } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';

interface TravelerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  traveler?: AgencyTraveler | null;
  onSuccess: () => void;
}

type FormData = Partial<AgencyTraveler> & {
  airline_loyalty_input?: string;
  hotel_loyalty_input?: string;
};

export default function TravelerModal({ open, onOpenChange, accountId, traveler, onSuccess }: TravelerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormData>();
  const isEdit = !!traveler;

  useEffect(() => {
    if (traveler) {
      reset({
        ...traveler,
      });
    } else {
      reset({
        legal_first_name: '',
        legal_last_name: '',
        is_primary_contact: false,
      });
    }
  }, [traveler, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        account_id: accountId,
      };

      if (isEdit && traveler) {
        await updateTraveler(traveler.id, payload);
        toast({ title: 'Traveler updated' });
      } else {
        await createTraveler(payload as Parameters<typeof createTraveler>[0]);
        toast({ title: 'Traveler added' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to save traveler', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!traveler || !confirm('Delete this traveler?')) return;
    try {
      await deleteTraveler(traveler.id);
      toast({ title: 'Traveler deleted' });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to delete traveler', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Traveler' : 'Add Traveler'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="identity" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="identity">Identity</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
              <TabsTrigger value="medical">Medical</TabsTrigger>
            </TabsList>

            {/* Identity Tab */}
            <TabsContent value="identity" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="legal_first_name">First Name (as on passport) *</Label>
                  <Input id="legal_first_name" {...register('legal_first_name')} required />
                </div>
                <div>
                  <Label htmlFor="legal_middle_name">Middle Name</Label>
                  <Input id="legal_middle_name" {...register('legal_middle_name')} />
                </div>
                <div>
                  <Label htmlFor="legal_last_name">Last Name *</Label>
                  <Input id="legal_last_name" {...register('legal_last_name')} required />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preferred_name">Preferred Name / Nickname</Label>
                  <Input id="preferred_name" {...register('preferred_name')} placeholder="What they go by" />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select 
                    value={watch('gender') || ''} 
                    onValueChange={(v) => setValue('gender', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input id="date_of_birth" type="date" {...register('date_of_birth')} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch 
                    id="is_primary_contact"
                    checked={watch('is_primary_contact') || false}
                    onCheckedChange={(v) => setValue('is_primary_contact', v)}
                  />
                  <Label htmlFor="is_primary_contact">Primary contact for this account</Label>
                </div>
              </div>

              <Separator />

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register('email')} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" {...register('phone')} />
                </div>
              </div>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="passport_number">Passport Number</Label>
                  <Input id="passport_number" {...register('passport_number')} />
                </div>
                <div>
                  <Label htmlFor="passport_country">Passport Country</Label>
                  <Input id="passport_country" {...register('passport_country')} placeholder="e.g., US, GB, CA" />
                </div>
              </div>
              <div>
                <Label htmlFor="passport_expiry">Passport Expiry</Label>
                <Input id="passport_expiry" type="date" {...register('passport_expiry')} />
              </div>

              <Separator />

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="known_traveler_number">Known Traveler # (TSA PreCheck)</Label>
                  <Input id="known_traveler_number" {...register('known_traveler_number')} />
                </div>
                <div>
                  <Label htmlFor="global_entry_number">Global Entry #</Label>
                  <Input id="global_entry_number" {...register('global_entry_number')} />
                </div>
                <div>
                  <Label htmlFor="redress_number">Redress #</Label>
                  <Input id="redress_number" {...register('redress_number')} />
                </div>
              </div>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="seat_preference">Seat Preference</Label>
                  <Select 
                    value={watch('seat_preference') || ''} 
                    onValueChange={(v) => setValue('seat_preference', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="window">Window</SelectItem>
                      <SelectItem value="aisle">Aisle</SelectItem>
                      <SelectItem value="middle">Middle</SelectItem>
                      <SelectItem value="front">Front of cabin</SelectItem>
                      <SelectItem value="exit">Exit row</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="meal_preference">Meal Preference</Label>
                  <Select 
                    value={watch('meal_preference') || ''} 
                    onValueChange={(v) => setValue('meal_preference', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="vegetarian">Vegetarian</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="kosher">Kosher</SelectItem>
                      <SelectItem value="halal">Halal</SelectItem>
                      <SelectItem value="gluten_free">Gluten Free</SelectItem>
                      <SelectItem value="diabetic">Diabetic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea 
                  id="notes" 
                  {...register('notes')} 
                  placeholder="Room preferences, special requests, travel style notes..."
                  rows={4}
                />
              </div>
            </TabsContent>

            {/* Loyalty Tab */}
            <TabsContent value="loyalty" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Add frequent flyer and hotel loyalty program details
              </p>
              <div>
                <Label>Airline Loyalty Programs</Label>
                <Textarea 
                  {...register('airline_loyalty_input')}
                  placeholder="e.g., United MileagePlus: ABC123456 (Gold)&#10;Delta SkyMiles: XYZ789012"
                  rows={3}
                />
              </div>
              <div>
                <Label>Hotel Loyalty Programs</Label>
                <Textarea 
                  {...register('hotel_loyalty_input')}
                  placeholder="e.g., Marriott Bonvoy: 123456789 (Platinum)&#10;Hilton Honors: 987654321"
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Medical Tab */}
            <TabsContent value="medical" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="dietary_restrictions">Dietary Restrictions</Label>
                <Input 
                  id="dietary_restrictions" 
                  placeholder="Comma-separated: gluten-free, nut allergy, vegetarian"
                />
              </div>
              <div>
                <Label htmlFor="allergies">Allergies</Label>
                <Input 
                  id="allergies" 
                  placeholder="Comma-separated: peanuts, shellfish, penicillin"
                />
              </div>
              <div>
                <Label htmlFor="mobility_needs">Mobility / Accessibility Needs</Label>
                <Input id="mobility_needs" {...register('mobility_needs')} placeholder="Wheelchair, walking assistance, etc." />
              </div>
              <div>
                <Label htmlFor="medical_notes">Medical Notes (private)</Label>
                <Textarea 
                  id="medical_notes" 
                  {...register('medical_notes')} 
                  placeholder="Any other medical information relevant for travel planning..."
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t">
            {isEdit ? (
              <Button type="button" variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Traveler
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Traveler'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
