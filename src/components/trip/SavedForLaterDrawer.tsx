import { useState } from 'react';
import { Bookmark, ChevronLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

/**
 * "Saved for later" — the holding-bay surface (spec: holding-bay-spec.md).
 * Reads trip.metadata.holding_bay. Placing an item runs the server-authoritative
 * `place-held-item` edge action with the explicit trade-off: preview the card it
 * would displace, then Swap (displaced card returns to the bay) / Add both / Cancel.
 * Mobile-first bottom drawer; desktop drag rail is Phase 2.
 */
interface HeldItem {
  id: string;
  label: string;
  resolved?: { title?: string; venueName?: string; category?: string } | null;
  originalMustDo?: string;
}

type Step = 'list' | 'pickDay' | 'confirm';
type Preview = { candidate: { title: string; startTime: string | null; category: string } | null; allPinned: boolean };

export function SavedForLaterDrawer({ trip, onPlaced }: { trip: any; onPlaced?: () => void }) {
  const bay: HeldItem[] = Array.isArray(trip?.metadata?.holding_bay) ? trip.metadata.holding_bay : [];
  const days: any[] = Array.isArray(trip?.itinerary_data?.days) ? trip.itinerary_data.days : [];

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('list');
  const [item, setItem] = useState<HeldItem | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  if (bay.length === 0) return null;

  const titleOf = (h: HeldItem) => h.resolved?.title || h.label || 'Saved item';
  const reset = () => { setStep('list'); setItem(null); setDay(null); setPreview(null); };

  const call = async (mode: 'preview' | 'swap' | 'add', dayNumber: number) => {
    const { data, error } = await supabase.functions.invoke('generate-itinerary', {
      body: { action: 'place-held-item', tripId: trip.id, heldItemId: item?.id, dayNumber, mode },
    });
    if (error || (data && (data as any).error)) {
      toast.error('Couldn’t update the trip. Try again.');
      return null;
    }
    return data as any;
  };

  const chooseDay = async (dayNumber: number) => {
    setDay(dayNumber);
    setBusy(true);
    const res = await call('preview', dayNumber);
    setBusy(false);
    if (!res) return;
    setPreview({ candidate: res.candidate ?? null, allPinned: !!res.allPinned });
    setStep('confirm');
  };

  const commit = async (mode: 'swap' | 'add') => {
    if (day == null) return;
    setBusy(true);
    const res = await call(mode, day);
    setBusy(false);
    if (!res) return;
    toast.success(mode === 'swap' ? `Swapped into Day ${day}.` : `Added to Day ${day}.`);
    reset();
    setOpen(false);
    onPlaced?.();
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-sky-500/20 transition-colors"
        >
          <Bookmark className="h-4 w-4 text-sky-600" />
          Saved for later · {bay.length}
        </button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <div className="flex items-center gap-2">
              {step !== 'list' && (
                <button type="button" onClick={() => (step === 'confirm' ? setStep('pickDay') : reset())} className="text-muted-foreground hover:text-foreground" aria-label="Back">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <DrawerTitle>Saved for later</DrawerTitle>
            </div>
            <DrawerDescription>
              {step === 'list' && 'Priorities we couldn’t fit. Place one and we’ll show you the trade-off.'}
              {step === 'pickDay' && item && `Add "${titleOf(item)}" to which day?`}
              {step === 'confirm' && item && day != null && `Add "${titleOf(item)}" to Day ${day}`}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-3">
            {/* STEP: list of held items */}
            {step === 'list' && bay.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => { setItem(h); setStep('pickDay'); }}
                className="w-full text-left rounded-lg border bg-card p-3 hover:bg-accent transition-colors"
              >
                <p className="text-sm font-medium text-foreground">{titleOf(h)}</p>
                {h.resolved?.venueName && h.resolved.venueName !== titleOf(h) && (
                  <p className="text-xs text-muted-foreground mt-0.5">{h.resolved.venueName}</p>
                )}
                {!h.resolved && <p className="text-xs text-muted-foreground mt-0.5">Tap to place — pick a day</p>}
              </button>
            ))}

            {/* STEP: pick a day */}
            {step === 'pickDay' && (
              <div className="grid grid-cols-3 gap-2">
                {days.map((d: any) => (
                  <Button key={d.dayNumber} variant="outline" disabled={busy} onClick={() => chooseDay(Number(d.dayNumber))} className="h-auto py-3 flex-col gap-0.5">
                    <span className="text-sm font-semibold">Day {d.dayNumber}</span>
                    {d.date && <span className="text-[10px] text-muted-foreground">{d.date}</span>}
                  </Button>
                ))}
                {busy && <div className="col-span-3 flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
              </div>
            )}

            {/* STEP: confirm with the displacement trade-off */}
            {step === 'confirm' && preview && day != null && (
              <div className="space-y-3">
                {preview.candidate ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-sm text-foreground">
                      Day {day} is full. This would replace{' '}
                      <span className="font-medium">{preview.candidate.title}</span>
                      {preview.candidate.startTime ? ` (${preview.candidate.startTime})` : ''}.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-sm text-foreground">There’s room on Day {day} — we’ll just add it.</p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {preview.candidate && (
                    <Button disabled={busy} onClick={() => commit('swap')}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Swap — replace ${preview.candidate.title}`}
                    </Button>
                  )}
                  <Button variant={preview.candidate ? 'outline' : 'default'} disabled={busy} onClick={() => commit('add')}>
                    {preview.candidate ? `Add both — Day ${day} gets busy` : `Add to Day ${day}`}
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setStep('pickDay')}>Pick another day</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
