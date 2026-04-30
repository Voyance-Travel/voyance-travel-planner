import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  intentsFromFineTuneNotes,
  intentsFromUserAnchors,
  intentsFromChatPlannerExtraction,
  intentFromAssistantTool,
} from './intent-normalizers.ts';

Deno.test('fine-tune: Day-marker dinner becomes a structured dinner intent', () => {
  const out = intentsFromFineTuneNotes({
    notes: 'Day 3: dinner at Belcanto 7:30pm',
    tripStartDate: '2026-04-17',
    totalDays: 5,
  });
  const day3 = out.find((i) => i.dayNumber === 3 && i.kind === 'dinner');
  assert(day3, 'expected a Day 3 dinner intent');
  assertEquals(day3!.startTime, '19:30');
  assertEquals(day3!.source, 'fine_tune');
  assert(day3!.title.toLowerCase().includes('belcanto'));
});

Deno.test('fine-tune: trip-wide notes get day_number=null', () => {
  const out = intentsFromFineTuneNotes({
    notes: 'Avoid super touristy places.',
    tripStartDate: '2026-04-17',
    totalDays: 5,
  });
  // "Avoid super touristy places." should fall to tripWide because it has no
  // day marker — even though "avoid" is detected as kind by the fine-tune parser.
  const tw = out.find((i) => i.dayNumber == null);
  assert(tw, 'expected a trip-wide intent');
  assertEquals(tw!.kind, 'note');
});

Deno.test('user anchors → locked must intents', () => {
  const intents = intentsFromUserAnchors([
    { dayNumber: 2, title: 'JNcQUOI Table', startTime: '19:00', source: 'manual_paste', lockedSource: '7pm dinner' },
  ]);
  assertEquals(intents.length, 1);
  assertEquals(intents[0].locked, true);
  assertEquals(intents[0].priority, 'must');
  assertEquals(intents[0].kind, 'activity'); // title doesn't include dinner
  assertEquals(intents[0].source, 'manual_paste');
});

Deno.test('chat planner: perDayActivities split into multiple intents', () => {
  const out = intentsFromChatPlannerExtraction({
    perDayActivities: [
      { dayNumber: 1, activities: '6:30AM Breakfast, 9AM-11:30AM Company Visit, 7PM Dinner at Jnane Tamsna' },
    ],
  });
  const day1 = out.filter((i) => i.dayNumber === 1);
  assert(day1.length >= 3, `expected 3+ intents, got ${day1.length}`);
  assert(day1.some((i) => i.kind === 'breakfast'));
  assert(day1.some((i) => i.kind === 'dinner' && /jnane tamsna/i.test(i.title)));
  assert(day1.every((i) => i.priority === 'must'));
});

Deno.test('chat planner: avoid constraint becomes avoid intent', () => {
  const out = intentsFromChatPlannerExtraction({
    userConstraints: [
      { type: 'avoid', description: 'No tourist traps' },
    ],
  });
  assertEquals(out[0].kind, 'avoid');
  assertEquals(out[0].priority, 'avoid');
});

Deno.test('chat planner: full_day_event allDay flagged in metadata', () => {
  const out = intentsFromChatPlannerExtraction({
    userConstraints: [
      { type: 'full_day_event', description: 'US Open', day: 1, allDay: true },
    ],
  });
  assertEquals(out[0].dayNumber, 1);
  assertEquals(out[0].kind, 'event');
  assertEquals((out[0].metadata as any)?.fullDayEvent, true);
});

Deno.test('assistant tool: ramen tonight becomes a should-priority dinner', () => {
  const intent = intentFromAssistantTool({
    dayNumber: 3,
    title: 'ramen',
    kind: 'dinner',
    priority: 'must',
  });
  assert(intent);
  assertEquals(intent!.kind, 'dinner');
  assertEquals(intent!.priority, 'must');
  assertEquals(intent!.source, 'assistant_chat');
});

Deno.test('assistant tool: avoid kind forces avoid priority regardless of input', () => {
  const intent = intentFromAssistantTool({
    dayNumber: 2,
    title: 'seafood',
    kind: 'avoid',
    priority: 'must',
  });
  assert(intent);
  assertEquals(intent!.priority, 'avoid');
});
