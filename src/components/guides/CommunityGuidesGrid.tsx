/**
 * Community Guides Grid
 * Displays published community_guides with creator info, city filter, and sort.
 */
import { useState, useMemo } from 'react';
import { Globe, Search, Plus, ArrowUpDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommunityGuidesList } from '@/hooks/useCommunityGuidesList';
import CommunityGuideCard from './CommunityGuideCard';

export function CommunityGuidesGrid() {
  const { data: guides = [], isLoading } = useCommunityGuidesList();
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');

  // Extract unique cities for quick filter suggestions
  const cities = useMemo(() => {
    const set = new Set<string>();
    guides.forEach(g => {
      if (g.destination) set.add(g.destination);
    });
    return Array.from(set).sort();
  }, [guides]);

  const filtered = useMemo(() => {
    let result = guides;

    // City filter
    if (cityFilter) {
      const cf = cityFilter.toLowerCase();
      result = result.filter(g =>
        g.destination?.toLowerCase().includes(cf) ||
        g.destination_country?.toLowerCase().includes(cf)
      );
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.destination?.toLowerCase().includes(q) ||
        g.title.toLowerCase().includes(q) ||
        g.creator_name?.toLowerCase().includes(q) ||
        (g.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === 'popular') {
      result = [...result].sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
    }
    // 'newest' is the default from the query

    return result;
  }, [guides, search, cityFilter, sortBy]);

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
      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by city, title, or creator..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* City Filter */}
        {cities.length > 1 && (
          <Select value={cityFilter || '_all'} onValueChange={v => setCityFilter(v === '_all' ? '' : v)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All cities</SelectItem>
              {cities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Sort */}
        <Select value={sortBy} onValueChange={v => setSortBy(v as 'newest' | 'popular')}>
          <SelectTrigger className="w-[140px] h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No guides match your filters
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
