import { zodResolver } from '@hookform/resolvers/zod';
import { User, Mail, Save, X } from 'lucide-react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AirportAutocomplete } from '@/components/profile/AirportAutocomplete';

const profileSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name is too long')
    .refine((val) => val.trim().length > 0, 'Name cannot be only whitespace'),
  handle: z.string()
    .min(3, 'Handle must be at least 3 characters')
    .max(30, 'Handle is too long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Handle can only contain letters, numbers, and underscores')
    .optional()
    .or(z.literal('')),
  homeAirport: z.string()
    .optional()
    .or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileEditFormProps {
  defaultValues?: Partial<ProfileFormData> & { email?: string };
  onSubmit: (data: ProfileFormData) => Promise<void>;
  onCancel?: () => void;
}

export default function ProfileEditForm({ 
  defaultValues,
  onSubmit: onSubmitProp, 
  onCancel 
}: ProfileEditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      handle: defaultValues?.handle || '',
      homeAirport: defaultValues?.homeAirport || '',
    }
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmitProp(data);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <div className="relative">
          <Input
            {...register('name')}
            id="name"
            type="text"
            className={`pl-10 ${errors.name ? 'border-destructive' : ''}`}
            placeholder="John Doe"
          />
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Email (read-only — changes require re-verification) */}
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            value={defaultValues?.email || ''}
            readOnly
            disabled
            className="pl-10 bg-muted cursor-not-allowed"
          />
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          Email cannot be changed from this page for security reasons.
        </p>
      </div>

      {/* Handle */}
      <div className="space-y-2">
        <Label htmlFor="handle">Username (Handle)</Label>
        <div className="relative">
          <Input
            {...register('handle')}
            id="handle"
            type="text"
            className={`pl-10 ${errors.handle ? 'border-destructive' : ''}`}
            placeholder="johndoe123"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
        </div>
        {errors.handle && (
          <p className="text-sm text-destructive">{errors.handle.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Your unique username for sharing your profile
        </p>
      </div>

      {/* Home Airport */}
      <div className="space-y-2">
        <Label>Home Airport</Label>
        <Controller
          name="homeAirport"
          control={control}
          render={({ field }) => (
            <AirportAutocomplete
              value={field.value}
              onSelect={(code) => {
                field.onChange(code);
              }}
              placeholder="Search your home airport..."
            />
          )}
        />
        {errors.homeAirport && (
          <p className="text-sm text-destructive">{errors.homeAirport.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <Button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="flex-1"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
