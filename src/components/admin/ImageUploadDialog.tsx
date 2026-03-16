import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  prefill?: { entityKey?: string; entityType?: string; destination?: string; replaceId?: string };
}

export default function ImageUploadDialog({ open, onClose, onUploaded, prefill }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [entityKey, setEntityKey] = useState(prefill?.entityKey || '');
  const [entityType, setEntityType] = useState(prefill?.entityType || 'activity');
  const [destination, setDestination] = useState(prefill?.destination || '');
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setEntityKey(prefill?.entityKey || '');
    setEntityType(prefill?.entityType || 'activity');
    setDestination(prefill?.destination || '');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast({ title: 'Only image files allowed', variant: 'destructive' });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleUpload = async () => {
    if (!file || !entityKey.trim()) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const sanitizedKey = entityKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 60);
      const filePath = `curated/${sanitizedKey}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('destination-images')
        .upload(filePath, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('destination-images')
        .getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      if (prefill?.replaceId) {
        // Replace existing curated_images row
        const { error } = await supabase
          .from('curated_images')
          .update({
            image_url: publicUrl,
            source: 'admin_upload',
            updated_at: new Date().toISOString(),
          })
          .eq('id', prefill.replaceId);
        if (error) throw error;
      } else {
        // Insert new row
        const { error } = await supabase.from('curated_images').insert({
          image_url: publicUrl,
          entity_key: entityKey.trim().toLowerCase().replace(/\s+/g, '_'),
          entity_type: entityType,
          destination: destination.trim() || null,
          source: 'admin_upload',
          vote_score: 1,
          quality_score: 0.8,
        });
        if (error) throw error;
      }

      toast({ title: prefill?.replaceId ? 'Image replaced with upload' : 'Image uploaded & saved' });
      reset();
      onUploaded();
      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: err.message || 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{prefill?.replaceId ? 'Replace with Upload' : 'Upload New Image'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-40 object-cover rounded-md" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
                <p className="text-sm">Click or drag to upload (JPG, PNG, WebP — max 5MB)</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {!prefill?.replaceId && (
            <>
              <div className="space-y-1.5">
                <Label>Entity name</Label>
                <Input
                  placeholder="e.g. eiffel_tower, ritz_paris"
                  value={entityKey}
                  onChange={e => setEntityKey(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activity">Activity</SelectItem>
                    <SelectItem value="destination">Destination</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Destination (optional)</Label>
                <Input
                  placeholder="e.g. Paris, France"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || (!prefill?.replaceId && !entityKey.trim()) || uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {prefill?.replaceId ? 'Replace' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
