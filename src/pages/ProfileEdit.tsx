import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, ArrowLeft, Camera } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import ProfileEditForm from '@/components/profile/ProfileEditForm';
import { updateProfile } from '@/services/supabase/profiles';

export default function ProfileEdit() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (data: { name: string; handle?: string; homeAirport?: string }) => {
    // Build display name and split into first/last for the profiles table
    const nameParts = data.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    await updateProfile({
      first_name: firstName,
      last_name: lastName,
      display_name: data.name.trim(),
      handle: data.handle || undefined,
      home_airport: data.homeAirport || undefined,
    });

    // Sync local auth context
    updateUser({ name: data.name.trim() });
    navigate(ROUTES.PROFILE.VIEW);
  };

  return (
    <MainLayout>
      <Head
        title="Edit Profile | Voyance"
        description="Update your Voyance profile information."
      />
      
      <section className="pt-24 pb-16">
        <div className="max-w-xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(ROUTES.PROFILE.VIEW)}
                aria-label="Go back to profile"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-display font-bold text-foreground">
                Edit Profile
              </h1>
            </div>
            
            {/* Avatar */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-12 w-12 text-primary" />
                </div>
                <button 
                  className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
                  aria-label="Change profile photo"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* Form with validation */}
            <ProfileEditForm
              defaultValues={{
                name: user?.name || '',
                email: user?.email || '',
                homeAirport: user?.homeAirport || '',
              }}
              onSubmit={handleSubmit}
              onCancel={() => navigate(ROUTES.PROFILE.VIEW)}
            />
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
