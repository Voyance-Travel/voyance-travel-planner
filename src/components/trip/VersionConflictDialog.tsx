/**
 * VersionConflictDialog — shown when optimistic locking detects a version conflict
 * during collaborative itinerary editing. Gives the user three clear options:
 * reload the server version, force-save their local changes, or cancel.
 */

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, Upload, X } from 'lucide-react';

export interface VersionConflictInfo {
  /** The local itinerary data the user tried to save */
  localData: Record<string, unknown>;
}

interface VersionConflictDialogProps {
  open: boolean;
  onReloadLatest: () => void;
  onForceKeepMine: () => void;
  onCancel: () => void;
}

export function VersionConflictDialog({
  open,
  onReloadLatest,
  onForceKeepMine,
  onCancel,
}: VersionConflictDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            Itinerary Edit Conflict
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            Another collaborator has edited this itinerary since you last loaded it.
            Your changes couldn't be saved automatically. How would you like to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onReloadLatest} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Reload Latest
          </Button>
          <Button variant="outline" onClick={onForceKeepMine} className="w-full gap-2">
            <Upload className="h-4 w-4" />
            Keep My Changes
          </Button>
          <Button variant="ghost" onClick={onCancel} className="w-full gap-2">
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
