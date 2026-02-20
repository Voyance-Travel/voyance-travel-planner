import { zodResolver } from '@hookform/resolvers/zod';
import { User, Mail, MapPin, Save, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Invalid email address'),
  handle: z.string()
    .min(3, 'Handle must be at least 3 characters')
    .max(30, 'Handle is too long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Handle can only contain letters, numbers, and underscores')
    .optional()
    .or(z.literal('')),
  homeAirport: z.string()
    .regex(/^[A-Z]{3}$/, 'Must be a 3-letter airport code (e.g., LAX)')
    .optional()
    .or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileEditFormProps {
  defaultValues?: Partial<ProfileFormData>;
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
    formState: { errors, isDirty }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      email: defaultValues?.email || '',
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

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <div className="relative">
          <Input
            {...register('email')}
            id="email"
            type="email"
            className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
            placeholder="john@example.com"
          />
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Changing your email will require verification
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
        <Label htmlFor="homeAirport">Home Airport</Label>
        <div className="relative">
          <Input
            {...register('homeAirport')}
            id="homeAirport"
            type="text"
            className={`pl-10 uppercase ${errors.homeAirport ? 'border-destructive' : ''}`}
            placeholder="LAX"
            maxLength={3}
          />
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        {errors.homeAirport && (
          <p className="text-sm text-destructive">{errors.homeAirport.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          3-letter airport code (e.g., JFK, LAX, ORD)
        </p>
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
