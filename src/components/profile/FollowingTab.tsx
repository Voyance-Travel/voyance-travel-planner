import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, BookOpen, UserMinus, Compass, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFollowing } from '@/hooks/useFollowing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function archetypeLabel(archetype: string | null): string | null {
  if (!archetype) return null;
  return archetype
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function FollowingTab() {
  const { following, isLoading, unfollow, isUnfollowing } = useFollowing();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (following.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 bg-muted/20 rounded-xl"
      >
        <Users className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No creators followed yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
          Follow travel creators to see their guides here. Browse community guides to find creators you love.
        </p>
        <Button asChild variant="outline">
          <Link to="/guides?tab=community">
            <Compass className="h-4 w-4 mr-2" />
            Browse Community Guides
          </Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-foreground">Following</h2>
        <span className="text-sm text-muted-foreground">{following.length} creator{following.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-3">
        {following.map((creator) => (
          <div
            key={creator.creator_id}
            className="p-4 rounded-xl border border-border bg-card"
          >
            {/* Creator header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={creator.avatar_url || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                    {(creator.display_name || '?')[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {creator.display_name || 'Unknown Creator'}
                    </span>
                    {creator.archetype && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                        {archetypeLabel(creator.archetype)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {creator.total_guides} published guide{creator.total_guides !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive flex-shrink-0"
                disabled={isUnfollowing}
                onClick={() => {
                  unfollow(creator.creator_id);
                  toast.success(`Unfollowed ${creator.display_name || 'creator'}`);
                }}
              >
                <UserMinus className="h-3.5 w-3.5 mr-1" />
                Unfollow
              </Button>
            </div>

            {/* Recent guides */}
            {creator.guides.length > 0 && (
              <div className="mt-3 pl-[52px] space-y-1.5">
                {creator.guides.map((guide) => (
                  <Link
                    key={guide.id}
                    to={`/community-guides/${guide.id}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <BookOpen className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60 group-hover:text-primary" />
                    <span className="truncate">{guide.title}</span>
                    {guide.destination && (
                      <span className="text-xs text-muted-foreground/50 flex-shrink-0">· {guide.destination}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
