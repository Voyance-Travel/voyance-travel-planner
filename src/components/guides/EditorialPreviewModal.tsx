/**
 * EditorialPreviewModal — full-screen editorial preview with publish/regenerate actions.
 */
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, ArrowRight, Loader2, BookOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import EditorialRenderer from '@/components/guides/EditorialRenderer';
import type { EditorialContent } from '@/types/editorial';

interface EditorialPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorial: EditorialContent | null;
  authorName: string;
  dnaType?: string | null;
  authorAvatarUrl?: string | null;
  authorUserId: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  durationDays?: number | null;
  coverImageUrl?: string | null;
  guidePhotos?: Map<string, string[]>;
  onPublish: () => void;
  onRegenerate: () => void;
  isPublishing?: boolean;
  isRegenerating?: boolean;
}

export default function EditorialPreviewModal({
  open,
  onOpenChange,
  editorial,
  authorName,
  dnaType,
  authorAvatarUrl,
  authorUserId,
  tripStartDate,
  tripEndDate,
  durationDays,
  coverImageUrl,
  guidePhotos,
  onPublish,
  onRegenerate,
  isPublishing = false,
  isRegenerating = false,
}: EditorialPreviewModalProps) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[95vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5 text-sm" onClick={close}>
            <ArrowLeft className="h-4 w-4" />
            Back to Editor
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Preview</span>
          <Button size="sm" className="gap-1.5" onClick={onPublish} disabled={isPublishing || !editorial}>
            {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Publish
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          {editorial ? (
            <EditorialRenderer
              editorial={editorial}
              authorName={authorName}
              dnaType={dnaType}
              authorAvatarUrl={authorAvatarUrl}
              authorUserId={authorUserId}
              tripStartDate={tripStartDate}
              tripEndDate={tripEndDate}
              durationDays={durationDays}
              coverImageUrl={coverImageUrl}
              guidePhotos={guidePhotos}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center space-y-4 px-6">
              <BookOpen className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                No editorial generated yet. Go back to the editor and click "Generate Editorial."
              </p>
              <Button variant="outline" onClick={close}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Editor
              </Button>
            </div>
          )}
        </ScrollArea>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5 text-sm" onClick={close}>
            <ArrowLeft className="h-4 w-4" />
            Back to Editor
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onPublish} disabled={isPublishing || !editorial}>
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Publish
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
