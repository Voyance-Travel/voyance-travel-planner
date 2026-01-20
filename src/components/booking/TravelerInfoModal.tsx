/**
 * Traveler Info Modal
 * 
 * Collects traveler information for a booking before proceeding to payment.
 */

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, User, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { BookableActivity, TravelerInfo, useUpdateTravelerInfo } from '@/services/bookingStateMachine';
import { supabase } from '@/integrations/supabase/client';

// Validation schema
const travelerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
  specialRequests: z.string().optional(),
});

const formSchema = z.object({
  travelers: z.array(travelerSchema).min(1, 'At least one traveler is required'),
  useSelfInfo: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TravelerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: BookableActivity;
  onSave: (travelers: TravelerInfo[]) => void;
}

export function TravelerInfoModal({
  isOpen,
  onClose,
  activity,
  onSave,
}: TravelerInfoModalProps) {
  const [userProfile, setUserProfile] = useState<{ first_name?: string; last_name?: string; email?: string } | null>(null);
  const updateTravelerInfo = useUpdateTravelerInfo();

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      travelers: activity.travelerData?.length 
        ? activity.travelerData 
        : [{ firstName: '', lastName: '', email: '', phone: '' }],
      useSelfInfo: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'travelers',
  });

  const useSelfInfo = watch('useSelfInfo');

  // Fetch current user profile
  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        
        setUserProfile({
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          email: user.email || '',
        });
      }
    }
    
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  // Auto-fill with user info when toggle is checked
  useEffect(() => {
    if (useSelfInfo && userProfile && fields.length > 0) {
      setValue('travelers.0.firstName', userProfile.first_name || '');
      setValue('travelers.0.lastName', userProfile.last_name || '');
      setValue('travelers.0.email', userProfile.email || '');
    }
  }, [useSelfInfo, userProfile, setValue, fields.length]);

  const onSubmit = async (data: FormData) => {
    try {
      // Map form data to TravelerInfo type
      const travelers: TravelerInfo[] = data.travelers.map(t => ({
        firstName: t.firstName || '',
        lastName: t.lastName || '',
        email: t.email,
        phone: t.phone,
        dateOfBirth: t.dateOfBirth,
        passportNumber: t.passportNumber,
        passportExpiry: t.passportExpiry,
        specialRequests: t.specialRequests,
      }));

      const result = await updateTravelerInfo.mutateAsync({
        activityId: activity.id,
        travelers,
      });

      if (result.success) {
        toast.success('Traveler information saved');
        onSave(travelers);
      } else {
        toast.error(result.error || 'Failed to save traveler info');
      }
    } catch (err) {
      console.error('Error saving travelers:', err);
      toast.error('Failed to save traveler information');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Traveler Information</DialogTitle>
          <DialogDescription>
            Enter details for all travelers booking "{activity.title}".
            Names must match travel documents.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Use self info toggle */}
          {userProfile && fields.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useSelfInfo"
                {...register('useSelfInfo')}
                className="rounded border-input"
              />
              <Label htmlFor="useSelfInfo" className="text-sm font-normal cursor-pointer">
                I am traveling (use my account info)
              </Label>
            </div>
          )}

          <Separator />

          {/* Traveler entries */}
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <User className="h-4 w-4" />
                    Traveler {index + 1}
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`travelers.${index}.firstName`}>First Name *</Label>
                    <Input
                      id={`travelers.${index}.firstName`}
                      {...register(`travelers.${index}.firstName`)}
                      placeholder="As on ID"
                    />
                    {errors.travelers?.[index]?.firstName && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.travelers[index]?.firstName?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`travelers.${index}.lastName`}>Last Name *</Label>
                    <Input
                      id={`travelers.${index}.lastName`}
                      {...register(`travelers.${index}.lastName`)}
                      placeholder="As on ID"
                    />
                    {errors.travelers?.[index]?.lastName && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.travelers[index]?.lastName?.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`travelers.${index}.email`}>Email</Label>
                    <Input
                      id={`travelers.${index}.email`}
                      type="email"
                      {...register(`travelers.${index}.email`)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`travelers.${index}.phone`}>Phone</Label>
                    <Input
                      id={`travelers.${index}.phone`}
                      {...register(`travelers.${index}.phone`)}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                {/* Optional fields - can be expanded */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`travelers.${index}.dateOfBirth`}>Date of Birth</Label>
                    <Input
                      id={`travelers.${index}.dateOfBirth`}
                      type="date"
                      {...register(`travelers.${index}.dateOfBirth`)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`travelers.${index}.passportNumber`}>Passport #</Label>
                    <Input
                      id={`travelers.${index}.passportNumber`}
                      {...register(`travelers.${index}.passportNumber`)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`travelers.${index}.specialRequests`}>Special Requests</Label>
                  <Textarea
                    id={`travelers.${index}.specialRequests`}
                    {...register(`travelers.${index}.specialRequests`)}
                    placeholder="Dietary needs, accessibility, etc."
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add traveler button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ firstName: '', lastName: '', email: '', phone: '' })}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Another Traveler
          </Button>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateTravelerInfo.isPending}>
              {updateTravelerInfo.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Continue'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TravelerInfoModal;
