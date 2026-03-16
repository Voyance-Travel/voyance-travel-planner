/**
 * Image Curation Admin Page
 * 
 * Two tabs:
 * - Review: Tinder-style swipe interface for rating images
 * - Gallery: Browsable grid with filters, search, replace & blacklist actions
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ThumbsUp, ThumbsDown, SkipForward, RefreshCw, ChevronLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { AddCuratedImage } from '@/components/admin/AddCuratedImage';
import ImageGallery from '@/components/admin/ImageGallery';

interface ImageForReview {
  id: string;
  image_url: string;
  entity_key: string;
  entity_type: string;
  destination: string | null;
  source: string;
  quality_score: number | null;
  vote_score: number;
  vote_count: number;
}

export default function ImageCuration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [images, setImages] = useState<ImageForReview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ reviewed: 0, good: 0, bad: 0 });
  const [filter, setFilter] = useState<'all' | 'unreviewed' | 'low_score'>('unreviewed');
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [activeTab, setActiveTab] = useState('gallery');

  const currentImage = images[currentIndex];

  const fetchImages = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('curated_images')
        .select('id, image_url, entity_key, entity_type, destination, source, quality_score, vote_score, vote_count')
        .eq('is_blacklisted', false)
        .order('vote_count', { ascending: true })
        .limit(50);

      if (filter === 'low_score') {
        query = query.lt('vote_score', 0);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (user && filter === 'unreviewed') {
        const { data: votes } = await supabase
          .from('image_votes')
          .select('image_url')
          .eq('user_id', user.id);
        const votedUrls = new Set(votes?.map(v => v.image_url) || []);
        setImages((data || []).filter(img => !votedUrls.has(img.image_url)));
      } else {
        setImages(data || []);
      }
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to fetch images:', error);
      toast({ title: 'Error loading images', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [filter, user, toast]);

  useEffect(() => {
    if (activeTab === 'review') fetchImages();
  }, [fetchImages, activeTab]);

  const handleVote = async (vote: 'good' | 'bad') => {
    if (!currentImage || !user) return;
    setDirection(vote === 'good' ? 'right' : 'left');
    try {
      await supabase.from('image_votes').upsert({
        user_id: user.id,
        image_url: currentImage.image_url,
        entity_type: currentImage.entity_type,
        entity_key: currentImage.entity_key,
        vote,
      });

      const scoreChange = vote === 'good' ? 1 : -1;
      const newScore = (currentImage.vote_score || 0) + scoreChange;
      const newCount = (currentImage.vote_count || 0) + 1;

      await supabase
        .from('curated_images')
        .update({
          vote_score: newScore,
          vote_count: newCount,
          is_blacklisted: newScore <= -3,
        })
        .eq('id', currentImage.id);

      setStats(prev => ({
        reviewed: prev.reviewed + 1,
        good: vote === 'good' ? prev.good + 1 : prev.good,
        bad: vote === 'bad' ? prev.bad + 1 : prev.bad,
      }));

      if (newScore <= -3) {
        toast({ title: 'Image blacklisted', description: `${currentImage.entity_key} image removed from rotation` });
      }

      setTimeout(() => {
        setDirection(null);
        setCurrentIndex(prev => prev + 1);
      }, 300);
    } catch (error) {
      console.error('Vote failed:', error);
      toast({ title: 'Vote failed', variant: 'destructive' });
    }
  };

  const handleSkip = () => setCurrentIndex(prev => prev + 1);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) handleVote('good');
    else if (info.offset.x < -threshold) handleVote('bad');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Please sign in to curate images</p>
            <Link to="/auth"><Button className="mt-4">Sign In</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isComplete = currentIndex >= images.length && images.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/profile">
              <Button variant="ghost" size="icon" aria-label="Go back to profile">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Image Curation</h1>
              <p className="text-sm text-muted-foreground">Manage and curate destination images</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AddCuratedImage onImageAdded={fetchImages} />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="container mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          {/* Gallery Tab */}
          <TabsContent value="gallery">
            <ImageGallery />
          </TabsContent>

          {/* Review Tab (existing swipe UI) */}
          <TabsContent value="review">
            {/* Review filters */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <Select value={filter} onValueChange={(v: typeof filter) => setFilter(v)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unreviewed">Unreviewed</SelectItem>
                  <SelectItem value="low_score">Low Score</SelectItem>
                  <SelectItem value="all">All Images</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchImages} aria-label="Refresh images">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center justify-center gap-6 text-sm mb-8">
              <Badge variant="secondary">{stats.reviewed} reviewed</Badge>
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" /><span>{stats.good} good</span>
              </div>
              <div className="flex items-center gap-1 text-red-500">
                <XCircle className="h-4 w-4" /><span>{stats.bad} bad</span>
              </div>
              <div className="text-muted-foreground">{images.length - currentIndex} remaining</div>
            </div>

            {/* Swipe UI */}
            {isLoading ? (
              <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              </div>
            ) : isComplete ? (
              <Card className="max-w-md mx-auto">
                <CardHeader><CardTitle className="text-center">🎉 All caught up!</CardTitle></CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-muted-foreground">You've reviewed all available images.</p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={fetchImages}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
                    <Button variant="outline" onClick={() => setFilter('all')}>View All</Button>
                  </div>
                </CardContent>
              </Card>
            ) : images.length === 0 ? (
              <Card className="max-w-md mx-auto">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No images to review</p>
                  <Button className="mt-4" onClick={() => setFilter('all')}>Show All Images</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center gap-8">
                <div className="relative w-full max-w-lg aspect-[4/3]">
                  <AnimatePresence mode="wait">
                    {currentImage && (
                      <motion.div
                        key={currentImage.id}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{
                          scale: 1, opacity: 1,
                          x: direction === 'left' ? -300 : direction === 'right' ? 300 : 0,
                          rotate: direction === 'left' ? -15 : direction === 'right' ? 15 : 0,
                        }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', damping: 20 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        onDragEnd={handleDragEnd}
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                      >
                        <Card className="h-full overflow-hidden">
                          <div className="relative h-full">
                            <img
                              src={currentImage.image_url}
                              alt={currentImage.entity_key}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23666" width="100%" height="100%"/><text x="50%" y="50%" fill="white" text-anchor="middle">Failed to load</text></svg>';
                              }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                              <h3 className="text-white font-medium text-lg capitalize">{currentImage.entity_key.replace(/_/g, ' ')}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">{currentImage.source}</Badge>
                                {currentImage.destination && <span className="text-white/70 text-sm">{currentImage.destination}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs text-white/60">
                                <span>Score: {currentImage.vote_score || 0}</span>
                                <span>Votes: {currentImage.vote_count || 0}</span>
                              </div>
                            </div>
                            <motion.div className="absolute top-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg font-bold" initial={{ opacity: 0, rotate: -15 }} animate={{ opacity: direction === 'left' ? 1 : 0 }}>NOPE</motion.div>
                            <motion.div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg font-bold" initial={{ opacity: 0, rotate: 15 }} animate={{ opacity: direction === 'right' ? 1 : 0 }}>LIKE</motion.div>
                          </div>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-4">
                  <Button size="lg" variant="outline" className="h-16 w-16 rounded-full border-red-300 hover:bg-red-50 hover:border-red-500" onClick={() => handleVote('bad')}>
                    <ThumbsDown className="h-6 w-6 text-red-500" />
                  </Button>
                  <Button size="lg" variant="ghost" className="h-12 w-12 rounded-full" onClick={handleSkip}>
                    <SkipForward className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <Button size="lg" variant="outline" className="h-16 w-16 rounded-full border-green-300 hover:bg-green-50 hover:border-green-500" onClick={() => handleVote('good')}>
                    <ThumbsUp className="h-6 w-6 text-green-500" />
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Swipe right or click 👍 for good images. Swipe left or click 👎 for bad ones.
                  Images with -3 or lower score are automatically blacklisted.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
