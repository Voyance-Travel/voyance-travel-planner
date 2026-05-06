/**
 * Travel Intelligence sanitizer
 *
 * Defensive validation for the Perplexity payload returned by the
 * `generate-travel-intel` edge function. Goal: never let blank fields,
 * missing sub-objects, or malformed array entries leak into the UI.
 *
 * Returns null when the payload is too incomplete to render meaningfully.
 */

import type { TravelIntelData } from './TravelIntelCard';

const isStr = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

const cleanArr = <T>(arr: unknown, keep: (x: any) => T | null): T[] => {
  if (!Array.isArray(arr)) return [];
  const out: T[] = [];
  for (const item of arr) {
    const k = keep(item);
    if (k !== null) out.push(k);
  }
  return out;
};

export function sanitizeTravelIntel(raw: unknown): TravelIntelData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;

  // ── gettingAround: require at least one populated string ──
  let gettingAround: TravelIntelData['gettingAround'] | undefined;
  if (r.gettingAround && typeof r.gettingAround === 'object') {
    const g = r.gettingAround;
    const fields = {
      doNotDo: isStr(g.doNotDo) ? g.doNotDo.trim() : '',
      bestOption: isStr(g.bestOption) ? g.bestOption.trim() : '',
      moneyTip: isStr(g.moneyTip) ? g.moneyTip.trim() : '',
      localSecret: isStr(g.localSecret) ? g.localSecret.trim() : '',
      etiquetteTip: isStr(g.etiquetteTip) ? g.etiquetteTip.trim() : '',
    };
    if (Object.values(fields).some((v) => v.length > 0)) {
      gettingAround = fields;
    }
  }

  // ── moneyAndSpending ──
  let moneyAndSpending: TravelIntelData['moneyAndSpending'] | undefined;
  if (r.moneyAndSpending && typeof r.moneyAndSpending === 'object') {
    const m = r.moneyAndSpending;
    const mc = m.mealCosts && typeof m.mealCosts === 'object' ? m.mealCosts : {};
    const mealCosts = {
      budget: isStr(mc.budget) ? mc.budget.trim() : '',
      midRange: isStr(mc.midRange) ? mc.midRange.trim() : '',
      fineDining: isStr(mc.fineDining) ? mc.fineDining.trim() : '',
    };
    const hasMeals =
      mealCosts.budget || mealCosts.midRange || mealCosts.fineDining;
    const fields: any = {
      paymentTip: isStr(m.paymentTip) ? m.paymentTip.trim() : '',
      moneyTrap: isStr(m.moneyTrap) ? m.moneyTrap.trim() : '',
      savingHack: isStr(m.savingHack) ? m.savingHack.trim() : '',
      mealCosts: hasMeals
        ? mealCosts
        : { budget: '', midRange: '', fineDining: '' },
    };
    if (isStr(m.currencyInfo)) fields.currencyInfo = m.currencyInfo.trim();
    if (isStr(m.tippingCustom)) fields.tippingCustom = m.tippingCustom.trim();
    const anyContent =
      fields.paymentTip ||
      fields.moneyTrap ||
      fields.savingHack ||
      fields.currencyInfo ||
      fields.tippingCustom ||
      hasMeals;
    if (anyContent) moneyAndSpending = fields;
  }

  // ── bookNowVsWalkUp ──
  let bookNowVsWalkUp: TravelIntelData['bookNowVsWalkUp'] | undefined;
  if (r.bookNowVsWalkUp && typeof r.bookNowVsWalkUp === 'object') {
    const b = r.bookNowVsWalkUp;
    const bookNow = cleanArr(b.bookNow, (x) =>
      x && isStr(x.name)
        ? { name: x.name.trim(), reason: isStr(x.reason) ? x.reason.trim() : undefined }
        : null,
    );
    const walkUpFine = cleanArr(b.walkUpFine, (x) =>
      x && isStr(x.name)
        ? { name: x.name.trim(), note: isStr(x.note) ? x.note.trim() : undefined }
        : null,
    );
    if (bookNow.length || walkUpFine.length) {
      bookNowVsWalkUp = { bookNow, walkUpFine };
    }
  }

  // ── weatherAndPacking ──
  let weatherAndPacking: TravelIntelData['weatherAndPacking'] | undefined;
  if (r.weatherAndPacking && typeof r.weatherAndPacking === 'object') {
    const w = r.weatherAndPacking;
    const fields = {
      summary: isStr(w.summary) ? w.summary.trim() : '',
      temperature: isStr(w.temperature) ? w.temperature.trim() : '',
      rainChance: isStr(w.rainChance) ? w.rainChance.trim() : '',
      packingList: cleanArr(w.packingList, (x) => (isStr(x) ? x.trim() : null)),
      dontPack: isStr(w.dontPack) ? w.dontPack.trim() : '',
    };
    if (
      fields.summary ||
      fields.temperature ||
      fields.rainChance ||
      fields.packingList.length ||
      fields.dontPack
    ) {
      weatherAndPacking = fields;
    }
  }

  // Require at least 2 of the 4 core sections to render
  const coreCount = [gettingAround, moneyAndSpending, bookNowVsWalkUp, weatherAndPacking]
    .filter(Boolean).length;
  if (coreCount < 2) return null;

  // ── Optional sections ──
  const eventsAndHappenings = cleanArr(r.eventsAndHappenings, (e) => {
    if (!e || !isStr(e.name) || !isStr(e.dates)) return null;
    return {
      name: e.name.trim(),
      dates: e.dates.trim(),
      type: isStr(e.type) ? e.type.trim() : 'other',
      description: isStr(e.description) ? e.description.trim() : '',
      bookingTip: isStr(e.bookingTip) ? e.bookingTip.trim() : null,
      isFree: e.isFree === true,
    };
  });

  const localCustomsAndEtiquette = cleanArr(r.localCustomsAndEtiquette, (c) =>
    c && (isStr(c.do) || isStr(c.dont))
      ? {
          do: isStr(c.do) ? c.do.trim() : '',
          dont: isStr(c.dont) ? c.dont.trim() : '',
          context: isStr(c.context) ? c.context.trim() : '',
        }
      : null,
  );

  let neighborhoodGuide: TravelIntelData['neighborhoodGuide'] | undefined;
  if (r.neighborhoodGuide && typeof r.neighborhoodGuide === 'object') {
    const n = r.neighborhoodGuide;
    const walkingDistance = cleanArr(n.walkingDistance, (x) =>
      isStr(x) ? x.trim() : null,
    );
    if (isStr(n.stayingNear) || isStr(n.vibe) || walkingDistance.length) {
      neighborhoodGuide = {
        stayingNear: isStr(n.stayingNear) ? n.stayingNear.trim() : 'Central area',
        vibe: isStr(n.vibe) ? n.vibe.trim() : '',
        walkingDistance,
        localGem: isStr(n.localGem) ? n.localGem.trim() : '',
        avoidNearby: isStr(n.avoidNearby) ? n.avoidNearby.trim() : null,
      };
    }
  }

  const insiderTips = cleanArr(r.insiderTips, (t) =>
    t && isStr(t.tip)
      ? { tip: t.tip.trim(), category: isStr(t.category) ? t.category.trim() : 'experience' }
      : null,
  );

  return {
    eventsAndHappenings,
    gettingAround: gettingAround ?? {
      doNotDo: '', bestOption: '', moneyTip: '', localSecret: '', etiquetteTip: '',
    },
    moneyAndSpending: moneyAndSpending ?? {
      paymentTip: '', moneyTrap: '', savingHack: '',
      mealCosts: { budget: '', midRange: '', fineDining: '' },
    },
    bookNowVsWalkUp: bookNowVsWalkUp ?? { bookNow: [], walkUpFine: [] },
    weatherAndPacking: weatherAndPacking ?? {
      summary: '', temperature: '', rainChance: '', packingList: [], dontPack: '',
    },
    localCustomsAndEtiquette,
    neighborhoodGuide,
    insiderTips,
    archetypeAdvice: isStr(r.archetypeAdvice) ? r.archetypeAdvice.trim() : undefined,
  };
}
