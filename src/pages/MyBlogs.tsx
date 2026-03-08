import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Edit, Trash2, ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function MyBlogs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('trip_blogs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setBlogs(data);
        setLoading(false);
      });
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this blog post? This cannot be undone.')) return;
    const { error } = await supabase.from('trip_blogs').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete blog');
    } else {
      setBlogs(prev => prev.filter(b => b.id !== id));
      toast.success('Blog deleted');
    }
  };

  const handlePublishToggle = async (blog: any) => {
    const newStatus = blog.status === 'published' ? 'draft' : 'published';
    const updates: any = { status: newStatus };
    if (newStatus === 'published') updates.published_at = new Date().toISOString();

    const { error } = await supabase
      .from('trip_blogs')
      .update(updates)
      .eq('id', blog.id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      setBlogs(prev => prev.map(b => b.id === blog.id ? { ...b, ...updates } : b));
      toast.success(newStatus === 'published' ? 'Blog published!' : 'Blog unpublished');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground">My Travel Blogs</h1>
          <Button variant="outline" onClick={() => navigate('/trip/dashboard')}>
            <Plus className="h-4 w-4 mr-1" />
            Create from Trip
          </Button>
        </div>

        {blogs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">No blog posts yet</p>
            <p className="text-sm text-muted-foreground">Complete a trip, then create a travel blog from your TripRecap page.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {blogs.map(blog => (
              <div key={blog.id} className="border border-border rounded-xl p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{blog.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {blog.destination && <span>{blog.destination} · </span>}
                    {blog.trip_dates && <span>{blog.trip_dates} · </span>}
                    <span className={blog.status === 'published' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                      {blog.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {blog.view_count || 0} views</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handlePublishToggle(blog)}>
                    {blog.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  {blog.status === 'published' && blog.slug && (
                    <Link to={`/blog/${blog.slug}`}>
                      <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                    </Link>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/blog/edit/${blog.id}`)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(blog.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
