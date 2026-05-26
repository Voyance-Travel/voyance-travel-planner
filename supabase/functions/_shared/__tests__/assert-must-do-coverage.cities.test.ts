/**
 * Regression tests for the recurring "2–3 of 4 selected attractions never
 * appear" pattern across Rome, Mexico City, and Istanbul. Buenos Aires has
 * its own dedicated file (assert-must-do-coverage.buenos-aires.test.ts).
 *
 * See mem://constraints/itinerary/must-do-coverage-injection +
 * .lovable/plan.md root cause notes.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertMustDoCoverage } from "../assert-must-do-coverage.ts";

const days = (acts: any[][]) =>
  acts.map((activities, i) => ({ dayNumber: i + 1, activities }));

// ── Rome ─────────────────────────────────────────────────────────────────
Deno.test("Rome: all 4 landmarks scheduled → no missing", () => {
  const r = assertMustDoCoverage(
    days([
      [
        { id: 'c', title: 'Colosseum Guided Tour', category: 'cultural', startTime: '09:00', endTime: '11:30' },
        { id: 'p', title: 'Pantheon', category: 'sightseeing', startTime: '14:00', endTime: '15:00' },
      ],
      [
        { id: 'v', title: 'Vatican Museums + Sistine Chapel', category: 'museum', startTime: '09:00', endTime: '12:30' },
        { id: 't', title: 'Trevi Fountain', category: 'landmark', startTime: '18:00', endTime: '18:45' },
      ],
    ]),
    ['Colosseum', 'Pantheon', 'Vatican Museums', 'Trevi Fountain']
  );
  assertEquals(r.missing, []);
  assertEquals(r.scheduled.length, 4);
});

Deno.test("Rome: transport prose 'Walk past Trevi on way to dinner' does NOT satisfy Trevi", () => {
  const r = assertMustDoCoverage(
    days([[
      { id: 'w', title: 'Walk past Trevi on way to dinner', category: 'transport', startTime: '19:00', endTime: '19:15' },
    ]]),
    ['Trevi Fountain']
  );
  assertEquals(r.scheduled, []);
  assertEquals(r.missing, ['Trevi Fountain']);
});

Deno.test("Rome: 3 of 4 scheduled, Vatican missing → honestly reported", () => {
  const r = assertMustDoCoverage(
    days([
      [
        { id: 'c', title: 'Colosseum Tour', category: 'cultural', startTime: '09:00', endTime: '11:30' },
        { id: 'p', title: 'Pantheon Visit', category: 'sightseeing', startTime: '14:00', endTime: '15:00' },
        { id: 't', title: 'Trevi Fountain', category: 'landmark', startTime: '17:00', endTime: '17:45' },
      ],
    ]),
    ['Colosseum', 'Pantheon', 'Vatican Museums', 'Trevi Fountain']
  );
  assertEquals(r.missing, ['Vatican Museums']);
});

// ── Mexico City ──────────────────────────────────────────────────────────
Deno.test("Mexico City: Teotihuacan, Zócalo, Bellas Artes, Casa Azul all scheduled", () => {
  const r = assertMustDoCoverage(
    days([
      [
        { id: 'a', title: 'Teotihuacán Pyramids Day Trip', category: 'cultural', startTime: '08:00', endTime: '16:00' },
      ],
      [
        { id: 'b', title: 'Zócalo + Cathedral Walk', category: 'sightseeing', startTime: '10:00', endTime: '11:30' },
        { id: 'c', title: 'Palacio de Bellas Artes', category: 'museum', startTime: '14:00', endTime: '15:30' },
      ],
      [
        { id: 'd', title: 'Museo Frida Kahlo (Casa Azul)', category: 'museum', startTime: '10:00', endTime: '12:00' },
      ],
    ]),
    ['Teotihuacan', 'Zócalo', 'Palacio de Bellas Artes', 'Casa Azul']
  );
  assertEquals(r.missing, []);
});

Deno.test("Mexico City: 'Travel to Teotihuacán' transport row does NOT satisfy", () => {
  const r = assertMustDoCoverage(
    days([[
      { id: 't', title: 'Travel to Teotihuacán', category: 'transport', startTime: '07:00', endTime: '08:30' },
    ]]),
    ['Teotihuacan']
  );
  assertEquals(r.missing, ['Teotihuacan']);
});

// ── Istanbul ─────────────────────────────────────────────────────────────
Deno.test("Istanbul: all 4 selections scheduled (Turkish aliases)", () => {
  const r = assertMustDoCoverage(
    days([
      [
        { id: 'h', title: 'Ayasofya Guided Tour', category: 'cultural', startTime: '09:00', endTime: '10:30' },
        { id: 'b', title: 'Sultan Ahmed Mosque', category: 'cultural', startTime: '11:00', endTime: '12:00' },
      ],
      [
        { id: 't', title: 'Topkapı Sarayı', category: 'museum', startTime: '09:00', endTime: '12:00' },
        { id: 'g', title: 'Kapalı Çarşı (Grand Bazaar)', category: 'shopping', startTime: '14:00', endTime: '16:00' },
      ],
    ]),
    ['Hagia Sophia', 'Blue Mosque', 'Topkapi Palace', 'Grand Bazaar']
  );
  assertEquals(r.missing, []);
});

Deno.test("Istanbul: 'Sultanahmet neighborhood walk' does NOT satisfy Blue Mosque", () => {
  const r = assertMustDoCoverage(
    days([[
      { id: 'w', title: 'Sultanahmet Neighborhood Walk', venue_name: 'Sultanahmet Walk', category: 'activity', startTime: '10:00', endTime: '11:30' },
    ]]),
    ['Blue Mosque']
  );
  assertEquals(r.missing, ['Blue Mosque']);
});

Deno.test("Istanbul: 2 of 4 missing (Topkapi + Basilica Cistern) → honestly reported", () => {
  const r = assertMustDoCoverage(
    days([
      [
        { id: 'h', title: 'Hagia Sophia', category: 'cultural', startTime: '09:00', endTime: '10:30' },
        { id: 'b', title: 'Blue Mosque', category: 'cultural', startTime: '11:00', endTime: '12:00' },
      ],
    ]),
    ['Hagia Sophia', 'Blue Mosque', 'Topkapi Palace', 'Basilica Cistern']
  );
  assertEquals(r.missing.sort(), ['Basilica Cistern', 'Topkapi Palace'].sort());
});
