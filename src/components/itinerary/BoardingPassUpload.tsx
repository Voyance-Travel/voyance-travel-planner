import { useState, useRef } from 'react';
import { Upload, FileText, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BoardingPassUploadProps {
  tripId: string;
  legIndex: number;
  currentUrl?: string;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}

export function BoardingPassUpload({ tripId, legIndex, currentUrl, onUploaded, onRemoved }: BoardingPassUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF or image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${tripId}/leg-${legIndex}-${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('boarding-passes')
        .upload(path, file, { upsert: true });

      if (error) throw error;

      // Store the path (not public URL since bucket is private)
      onUploaded(path);
      toast.success('Boarding pass uploaded');
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Failed to upload boarding pass');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleView = async () => {
    if (!currentUrl) return;
    try {
      const { data } = await supabase.storage
        .from('boarding-passes')
        .createSignedUrl(currentUrl, 3600); // 1 hour
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      toast.error('Failed to open boarding pass');
    }
  };

  if (currentUrl) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-10 gap-1.5"
          onClick={handleView}
        >
          <FileText className="h-3.5 w-3.5 text-primary" />
          View Pass
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemoved}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleUpload}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs h-10 gap-1.5"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="h-3.5 w-3.5" />
        {uploading ? 'Uploading...' : 'Upload PDF/Image'}
      </Button>
    </>
  );
}
