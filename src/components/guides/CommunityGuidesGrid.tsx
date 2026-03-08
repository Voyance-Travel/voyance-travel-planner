/**
 * Community Guides Grid
 * Displays published community_guides with creator info and search.
 */
import { useState, useMemo } from 'react';
import { Globe, Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCommunityGuidesList } from '@/hooks/useCommunityGuidesList';
import CommunityGuideCard from './CommunityGuideCard';

export function CommunityGuidesGrid() {
  const { data: guides = [], isLoading } = useCommunityGuidesList();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return guides;
    const q = search.toLowerCase();
    return guides.filter(g =>
      g.destination?.toLowerCase().includes(q) ||
      g.title.toLowerCase().includes(q) ||
      g.creator_name?.toLowerCase().includes(q)
    );
  }, [guides, search]);

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
            <div className="aspect-[16/10] bg-muted" />
            <div className="p-5 space-y-3">
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (guides.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <Globe className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No community guides yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Complete a trip and share your favorites to create the first community guide!
        </p>
        <Button variant="outline" asChild>
          <Link to="/start">
            <Plus className="h-4 w-4 mr-2" />
            Plan a Trip
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by city, title, or creator..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No guides match "{search}"
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((guide, index) => (
            <CommunityGuideCard key={guide.id} guide={guide} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
