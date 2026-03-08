import { useEffect } from 'react';
import { History, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatVersionLabel, type ItineraryVersion } from '@/hooks/useVersionHistory';

interface VersionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: ItineraryVersion[];
  isLoading: boolean;
  isRestoring: boolean;
  onLoadVersions: () => Promise<void>;
  onRestore: (versionNumber: number) => Promise<void>;
  dayNumber: number;
}

export function VersionHistoryDrawer({
  open,
  onOpenChange,
  versions,
  isLoading,
  isRestoring,
  onLoadVersions,
  onRestore,
  dayNumber,
}: VersionHistoryDrawerProps) {
  // Load versions when drawer opens
  useEffect(() => {
    if (open) {
      onLoadVersions();
    }
  }, [open, onLoadVersions]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Day {dayNumber} — Version History
          </DrawerTitle>
          <DrawerDescription>
            Browse and restore previous versions of this day's itinerary.
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="px-4 pb-2 max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading versions…</span>
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No version history available for this day yet.
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((version, idx) => {
                const label = formatVersionLabel(version);
                const isCurrent = version.is_current;
                const activityCount = version.activities?.length ?? 0;

                return (
                  <div
                    key={version.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-3 transition-colors',
                      isCurrent
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{label}</span>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        v{version.version_number} · {activityCount} activit{activityCount === 1 ? 'y' : 'ies'}
                      </p>
                    </div>

                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isRestoring}
                        onClick={() => onRestore(version.version_number)}
                        className="shrink-0 gap-1.5 text-xs"
                      >
                        {isRestoring ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Restore
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default VersionHistoryDrawer;
