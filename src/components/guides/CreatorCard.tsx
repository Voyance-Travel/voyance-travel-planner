import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Youtube, Instagram, Facebook, Linkedin, Globe, UserPlus, UserCheck, Users } from 'lucide-react';
import { useGuideFollow } from '@/hooks/useGuideFollow';
import type { SocialLink, SocialPlatform } from '@/services/socialLinksAPI';

interface CreatorCardProps {
  userId: string;
}

const PLATFORM_ICONS: Record<SocialPlatform, React.ReactNode> = {
  youtube: <Youtube className="w-4 h-4" />,
  instagram: <Instagram className="w-4 h-4" />,
  tiktok: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.78a8.18 8.18 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.21z" />
    </svg>
  ),
  facebook: <Facebook className="w-4 h-4" />,
  twitter: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  linkedin: <Linkedin className="w-4 h-4" />,
  blog: <Globe className="w-4 h-4" />,
};

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  twitter: 'X',
  linkedin: 'LinkedIn',
  blog: 'Website',
};

function useCreatorProfile(userId: string) {
  return useQuery({
    queryKey: ['creator-profile', userId],
    queryFn: async () => {
      const [profileRes, dnaRes, linksRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, avatar_url, handle')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('travel_dna_profiles')
          .select('primary_archetype_name')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_social_links')
          .select('platform, url')
          .eq('user_id', userId),
      ]);

      return {
        profile: profileRes.data,
        archetype: dnaRes.data?.primary_archetype_name,
        socialLinks: (linksRes.data || []) as SocialLink[],
      };
    },
  });
}

export default function CreatorCard({ userId }: CreatorCardProps) {
  const { data } = useCreatorProfile(userId);
  const { isFollowing: following, followerCount, toggleFollow, canFollow } = useGuideFollow(userId);

  if (!data?.profile) return null;

  const { profile, archetype, socialLinks } = data;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-12 h-12 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-lg">
            {(profile.display_name || '?')[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">
            {profile.display_name || profile.handle || 'Traveler'}
          </p>
          {archetype && (
            <Badge variant="secondary" className="text-[10px] mt-0.5">
              {archetype}
            </Badge>
          )}
        </div>
      </div>

      {/* Follower count + Follow button */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" />
          {followerCount} follower{followerCount !== 1 ? 's' : ''}
        </span>
        {canFollow && (
          <Button
            variant={following ? 'secondary' : 'outline'}
            size="sm"
            className="text-xs h-8"
            onClick={toggleFollow}
          >
            {following ? (
              <>
                <UserCheck className="h-3.5 w-3.5 mr-1" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Follow
              </>
            )}
          </Button>
        )}
      </div>

      {socialLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {socialLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted transition-colors"
            >
              {PLATFORM_ICONS[link.platform] || <Globe className="w-4 h-4" />}
              {PLATFORM_LABELS[link.platform] || link.platform}
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
