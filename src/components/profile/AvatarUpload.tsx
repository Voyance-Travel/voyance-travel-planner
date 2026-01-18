import { useState, useRef } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AvatarUploadProps {
  currentAvatar?: string | null;
  userName?: string;
  userId: string;
  onAvatarChange?: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32 md:w-40 md:h-40',
};

const iconSizes = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16 md:h-20 md:w-20',
};

const textSizes = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-4xl md:text-5xl',
};

export default function AvatarUpload({ 
  currentAvatar, 
  userName, 
  userId,
  onAvatarChange,
  size = 'lg' 
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPEG, PNG, WebP, or GIF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      onAvatarChange?.(publicUrl);
      toast.success('Profile photo updated!');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const initial = userName?.charAt(0) || 'V';

  return (
    <div className="relative">
      <div 
        className={`${sizeClasses[size]} rounded-full border-4 border-background bg-muted flex items-center justify-center overflow-hidden cursor-pointer group`}
        onClick={handleClick}
      >
        {isUploading ? (
          <Loader2 className={`${iconSizes[size]} text-muted-foreground animate-spin`} />
        ) : avatarUrl ? (
          <>
            <img 
              src={avatarUrl} 
              alt={userName || 'Profile'} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </>
        ) : (
          <>
            <span className={`${textSizes[size]} font-display font-medium text-muted-foreground group-hover:opacity-50 transition-opacity`}>
              {initial}
            </span>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </>
        )}
      </div>
      
      <button 
        onClick={handleClick}
        disabled={isUploading}
        className="absolute bottom-2 right-2 p-2 bg-background border border-border rounded-full shadow-sm hover:bg-muted transition-colors disabled:opacity-50"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : (
          <Camera className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}