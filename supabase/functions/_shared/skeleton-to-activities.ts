// Skeleton → legacy DayActivity[] adapter — Phase 4.
//
// Pure mapper. Walks a (fully or partially filled) SkeletonDay and emits the
// activity shape the existing enrich/repair/persist tail accepts. No LLM, no
// network, no side effects.
//
// Each slot becomes exactly one activity. Pre-pinned slots (arrival/departure
// /hotel/must-do with fixedTimeWindow) carry their filledData verbatim. Filler-
// named slots compose { title=name, description, startTime/endTime, category }.
// Every emitted row is stamped with metadata.skeletonSlotId so downstream
// auditors can verify lock + must-do coverage without re-deriving.

import type {
  SkeletonDay,
  SkeletonSlot,
  SkeletonFilledData,
} from './schema-generation.ts';

export interface AdapterActivity {
  id: string;
  title: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  category: string;
  location?: string;
  source: string;
  isLocked?: boolean;
  lockSource?: string;
  metadata: {
    skeletonSlotId: string;
    skeletonSlotType: string;
    mustDoRef?: string;
    mealType?: string;
    filledSource?: string;
    [k: string]: unknown;
  };
}

export interface SkeletonAdapterResult {
  activities: AdapterActivity[];
  /** Slots that had no filledData (filler skipped them) — caller decides what to do. */
  unfilledSlots: SkeletonSlot[];
}

function slotTypeToCategory(slotType: string, mealType?: string): string {
  if (slotType === 'meal' && mealType) return mealType;
  switch (slotType) {
    case 'evening':
      return 'evening';
    case 'must_do':
      return 'activity';
    case 'transport':
      return 'transit';
    case 'arrival':
    case 'departure':
      return 'transport';
    case 'hotel_checkin':
    case 'hotel_checkout':
      return 'accommodation';
    case 'unscheduled':
      return 'free_time';
    default:
      return slotType;
  }
}

function isPinnedLogistics(slotType: string): boolean {
  return (
    slotType === 'arrival' ||
    slotType === 'departure' ||
    slotType === 'hotel_checkin' ||
    slotType === 'hotel_checkout'
  );
}

export function skeletonToActivities(skeleton: SkeletonDay): SkeletonAdapterResult {
  const activities: AdapterActivity[] = [];
  const unfilledSlots: SkeletonSlot[] = [];

  for (const slot of skeleton.slots) {
    if (slot.status === 'empty' || !slot.filledData) {
      unfilledSlots.push(slot);
      continue;
    }
    const filled: SkeletonFilledData = slot.filledData;
    const locked = isPinnedLogistics(slot.slotType);
    const category =
      filled.category && filled.category.trim().length > 0
        ? filled.category
        : slotTypeToCategory(slot.slotType, slot.mealType);

    activities.push({
      id: `${skeleton.dayNumber}-${slot.slotId}`,
      title: filled.title,
      name: filled.title,
      description: filled.notes ?? '',
      startTime: filled.startTime,
      endTime: filled.endTime,
      category,
      location: filled.location,
      source: 'skeleton_filler',
      isLocked: locked || undefined,
      lockSource: locked ? `skeleton_${slot.slotType}` : undefined,
      metadata: {
        skeletonSlotId: slot.slotId,
        skeletonSlotType: slot.slotType,
        mustDoRef: slot.mustDoRef,
        mealType: slot.mealType,
        filledSource: filled.source,
      },
    });
  }

  // Sort by startTime, stable on slot position for ties.
  const slotPositions = new Map(skeleton.slots.map((s) => [s.slotId, s.position]));
  activities.sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    return (slotPositions.get(a.metadata.skeletonSlotId) ?? 0) -
           (slotPositions.get(b.metadata.skeletonSlotId) ?? 0);
  });

  return { activities, unfilledSlots };
}
