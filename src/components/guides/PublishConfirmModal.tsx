import { useState } from 'react';
import { Check, X, Globe, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface PublishConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  title: string;
  itemCount: number;
}

const MIN_ITEMS = 3;

export default function PublishConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  title,
  itemCount,
}: PublishConfirmModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const hasTitle = title.trim().length > 0;
  const hasMinItems = itemCount >= MIN_ITEMS;
  const canPublish = hasTitle && hasMinItems && acknowledged;

  // Reset checkbox when modal opens
  const handleOpenChange = (v: boolean) => {
    if (v) setAcknowledged(false);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Publish Your Guide
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Checklist */}
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-foreground">Publishing checklist</p>
            <div className="space-y-2">
              <ChecklistItem passed={hasTitle} label="Title is set" />
              <ChecklistItem
                passed={hasMinItems}
                label={`At least ${MIN_ITEMS} items (you have ${itemCount})`}
              />
            </div>
          </div>

          {/* Warning */}
          <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              This guide will be publicly visible. Your display name will be shown as the creator.
            </p>
          </div>

          {/* Acknowledgement checkbox */}
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="publish-ack"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
            />
            <Label
              htmlFor="publish-ack"
              className="text-sm leading-snug cursor-pointer text-muted-foreground"
            >
              I understand this guide will be public
            </Label>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={!canPublish || isPending} className="gap-2">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistItem({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-destructive" />
      )}
      <span className={passed ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}
