// Trip Generation Match Verdict Analyzer
// Scores final saved itinerary against user request + travel DNA.
// Output is persisted in trip_generation_traces.match_verdict and rendered
// in the admin trace viewer.

type AnyJson = Record<string, unknown>;

export type MismatchType =
  | "missing_anchor"
  | "missing_must_do"
  | "dietary_violation"
  | "budget_tier_off"
  | "pacing_off"
  | "interest_uncovered"
  | "archetype_drift";

export interface Mismatch {
  type: MismatchType;
  severity: "low" | "medium" | "high";
  expected: string;
  actual: string;
  day?: number;
  activityId?: string;
  rootCauseHint?: string;
}

export interface MatchVerdict {
  score: number;              // 0–100
  scoredAt: string;
  categories: {
    anchors: { score: number; passed: boolean; notes: string };
    mustDos: { score: number; passed: boolean; notes: string };
    dietary: { score: number; passed: boolean; notes: string };
    budget: { score: number; passed: boolean; notes: string };
    pacing: { score: number; passed: boolean; notes: string };
    interests: { score: number; passed: boolean; notes: string };
    archetype: { score: number; passed: boolean; notes: string };
  };
  mismatches: Mismatch[];
}

interface VerdictInput {
  userRequest: {
    destination?: string;
    budgetTier?: string;
    budgetTotalCents?: number;
    pacing?: string;
    interests?: string[];
    dietary?: string[];
    mustDos?: Array<{ name?: string; title?: string }>;
    anchors?: Array<{ name?: string; title?: string; required?: boolean; day?: number }>;
  };
  profile: {
    primaryArchetype?: string;
    secondaryArchetype?: string;
    traitScores?: Record<string, number>;
  };
  days: Array<{
    dayNumber: number;
    activities: Array<{
      id?: string;
      title?: string;
      name?: string;
      category?: string;
      description?: string;
      startTime?: string;
      cost?: { amount?: number };
      anchorSource?: string;
      isLocked?: boolean;
      tags?: string[];
    }>;
  }>;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleMatches(needle: string, hay: string): boolean {
  const n = normalize(needle);
  const h = normalize(hay);
  if (!n || !h) return false;
  if (h.includes(n) || n.includes(h)) return true;
  // word overlap
  const nWords = new Set(n.split(" ").filter((w) => w.length > 2));
  const hWords = new Set(h.split(" ").filter((w) => w.length > 2));
  let overlap = 0;
  for (const w of nWords) if (hWords.has(w)) overlap++;
  return overlap >= Math.max(1, Math.floor(nWords.size * 0.6));
}

export function computeMatchVerdict(input: VerdictInput): MatchVerdict {
  const mismatches: Mismatch[] = [];
  const allActs = input.days.flatMap((d) =>
    d.activities.map((a) => ({ ...a, _day: d.dayNumber })),
  );

  // 1. ANCHORS — every required anchor must appear with time + non-empty description
  const anchors = input.userRequest.anchors ?? [];
  const required = anchors.filter((a) => a.required !== false);
  let anchorPasses = 0;
  for (const a of required) {
    const needle = a.name ?? a.title ?? "";
    if (!needle) continue;
    const hit = allActs.find((x) => titleMatches(needle, x.title ?? x.name ?? ""));
    if (!hit) {
      mismatches.push({
        type: "missing_anchor",
        severity: "high",
        expected: needle,
        actual: "not found in any day",
        rootCauseHint: "Check anchor-guard logs + intent-normalizers",
      });
      continue;
    }
    if (!hit.startTime) {
      mismatches.push({
        type: "missing_anchor",
        severity: "medium",
        expected: `${needle} with startTime`,
        actual: `${hit.title ?? hit.name} has no startTime`,
        day: hit._day,
        activityId: hit.id,
        rootCauseHint: "anchor-guard untimed-locked drop",
      });
      continue;
    }
    anchorPasses++;
  }
  const anchorScore = required.length === 0 ? 100 : Math.round((anchorPasses / required.length) * 100);

  // 2. MUST-DOS — softer match
  const mustDos = input.userRequest.mustDos ?? [];
  let mdPasses = 0;
  for (const m of mustDos) {
    const needle = m.name ?? m.title ?? "";
    if (!needle) continue;
    const hit = allActs.find((x) => titleMatches(needle, x.title ?? x.name ?? ""));
    if (!hit) {
      mismatches.push({
        type: "missing_must_do",
        severity: "medium",
        expected: needle,
        actual: "not represented in final plan",
        rootCauseHint: "trip_day_intents seeding or LLM ignored USER WISHES",
      });
      continue;
    }
    mdPasses++;
  }
  const mdScore = mustDos.length === 0 ? 100 : Math.round((mdPasses / mustDos.length) * 100);

  // 3. DIETARY — scan titles + descriptions for hard violations
  const dietary = (input.userRequest.dietary ?? []).map((d) => d.toLowerCase());
  const violators: string[] = [];
  if (dietary.includes("vegetarian") || dietary.includes("vegan")) {
    const meatRe = /\b(steak|beef|pork|bacon|chicken|lamb|veal|duck|sausage|burger)\b/i;
    for (const a of allActs) {
      const blob = `${a.title ?? ""} ${a.description ?? ""}`;
      if (meatRe.test(blob)) {
        violators.push(`Day ${a._day}: ${a.title}`);
        mismatches.push({
          type: "dietary_violation",
          severity: "high",
          expected: dietary.join(" + "),
          actual: a.title ?? "",
          day: a._day,
          activityId: a.id,
        });
      }
    }
  }
  const dietaryScore = dietary.length === 0 ? 100 : violators.length === 0 ? 100 : Math.max(0, 100 - violators.length * 20);

  // 4. BUDGET — median activity cost vs tier band
  const tierBands: Record<string, [number, number]> = {
    value: [0, 40],
    balanced: [20, 100],
    splurge: [60, 250],
    luxury: [150, 600],
    luminary: [300, 2000],
  };
  const tier = (input.userRequest.budgetTier ?? "balanced").toLowerCase();
  const band = tierBands[tier] ?? tierBands.balanced;
  const paidCosts = allActs
    .map((a) => a.cost?.amount ?? 0)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  let median = 0;
  if (paidCosts.length) {
    const mid = Math.floor(paidCosts.length / 2);
    median = paidCosts.length % 2 ? paidCosts[mid] : (paidCosts[mid - 1] + paidCosts[mid]) / 2;
  }
  let budgetScore = 100;
  if (paidCosts.length && (median < band[0] * 0.5 || median > band[1] * 2)) {
    budgetScore = 50;
    mismatches.push({
      type: "budget_tier_off",
      severity: "medium",
      expected: `${tier} tier median in $${band[0]}–$${band[1]}`,
      actual: `median $${median.toFixed(0)} across ${paidCosts.length} paid activities`,
      rootCauseHint: "budget-constraints prompt or post-gen capping",
    });
  }

  // 5. PACING — activities/day vs requested
  const pacingTargets: Record<string, [number, number]> = {
    relaxed: [3, 5],
    balanced: [4, 7],
    packed: [6, 10],
  };
  const pacing = (input.userRequest.pacing ?? "balanced").toLowerCase();
  const pTarget = pacingTargets[pacing] ?? pacingTargets.balanced;
  const offDays = input.days.filter((d) => {
    const real = d.activities.filter((a) =>
      !["transit", "transfer", "logistics", "hotel-return", "checkin", "checkout"].includes((a.category ?? "").toLowerCase()),
    );
    return real.length < pTarget[0] - 1 || real.length > pTarget[1] + 2;
  });
  for (const d of offDays) {
    mismatches.push({
      type: "pacing_off",
      severity: "low",
      expected: `${pacing} pacing (${pTarget[0]}–${pTarget[1]} activities)`,
      actual: `Day ${d.dayNumber} has ${d.activities.length} activities`,
      day: d.dayNumber,
    });
  }
  const pacingScore = input.days.length === 0 ? 100 : Math.round(((input.days.length - offDays.length) / input.days.length) * 100);

  // 6. INTERESTS — each selected interest represented ≥1×
  const interests = (input.userRequest.interests ?? []).map((i) => i.toLowerCase());
  const interestHits: Record<string, number> = {};
  for (const i of interests) interestHits[i] = 0;
  for (const a of allActs) {
    const blob = `${a.title ?? ""} ${a.description ?? ""} ${(a.tags ?? []).join(" ")} ${a.category ?? ""}`.toLowerCase();
    for (const i of interests) {
      if (blob.includes(i)) interestHits[i]++;
    }
  }
  const uncovered = interests.filter((i) => interestHits[i] === 0);
  for (const i of uncovered) {
    mismatches.push({
      type: "interest_uncovered",
      severity: "low",
      expected: `at least one activity matching "${i}"`,
      actual: "0 matches across all days",
      rootCauseHint: "DNA/interest weighting in compile-prompt",
    });
  }
  const interestScore = interests.length === 0 ? 100 : Math.round(((interests.length - uncovered.length) / interests.length) * 100);

  // 7. ARCHETYPE — weak heuristic; just flag if 0 activities match the primary archetype keyword
  const arch = input.profile.primaryArchetype?.toLowerCase();
  let archScore = 100;
  if (arch) {
    const keywordMap: Record<string, RegExp> = {
      foodie: /\b(restaurant|tasting|food|cooking|market|wine|tapas|michelin)\b/i,
      explorer: /\b(hike|trail|tour|walk|discover|day trip|excursion)\b/i,
      culture: /\b(museum|gallery|temple|cathedral|opera|theater|theatre|heritage|history)\b/i,
      luxury: /\b(spa|suite|private|chauffeur|champagne|fine dining)\b/i,
      wellness: /\b(spa|yoga|meditation|onsen|hammam|massage|wellness)\b/i,
      nightlife: /\b(bar|cocktail|club|speakeasy|nightcap|rooftop)\b/i,
    };
    const matched = Object.entries(keywordMap).find(([k]) => arch.includes(k));
    if (matched) {
      const re = matched[1];
      const hits = allActs.filter((a) => re.test(`${a.title ?? ""} ${a.description ?? ""} ${a.category ?? ""}`)).length;
      if (hits === 0) {
        archScore = 40;
        mismatches.push({
          type: "archetype_drift",
          severity: "medium",
          expected: `primary archetype ${arch} represented`,
          actual: "0 activities match archetype keyword",
          rootCauseHint: "DNA injection in compile-prompt or archetype-constraints",
        });
      } else if (hits < input.days.length) {
        archScore = 75;
      }
    }
  }

  // Aggregate
  const weights = { anchors: 25, mustDos: 20, dietary: 15, budget: 10, pacing: 10, interests: 10, archetype: 10 };
  const score = Math.round(
    (anchorScore * weights.anchors +
      mdScore * weights.mustDos +
      dietaryScore * weights.dietary +
      budgetScore * weights.budget +
      pacingScore * weights.pacing +
      interestScore * weights.interests +
      archScore * weights.archetype) / 100,
  );

  return {
    score,
    scoredAt: new Date().toISOString(),
    categories: {
      anchors: { score: anchorScore, passed: anchorScore >= 80, notes: `${anchorPasses}/${required.length} required anchors satisfied` },
      mustDos: { score: mdScore, passed: mdScore >= 70, notes: `${mdPasses}/${mustDos.length} must-dos represented` },
      dietary: { score: dietaryScore, passed: dietaryScore === 100, notes: violators.length ? `${violators.length} potential violations` : "clean" },
      budget: { score: budgetScore, passed: budgetScore >= 80, notes: `tier=${tier} median=$${median.toFixed(0)} band=$${band[0]}-$${band[1]}` },
      pacing: { score: pacingScore, passed: pacingScore >= 80, notes: `pacing=${pacing} off=${offDays.length}/${input.days.length}` },
      interests: { score: interestScore, passed: interestScore >= 70, notes: `${interests.length - uncovered.length}/${interests.length} covered` },
      archetype: { score: archScore, passed: archScore >= 70, notes: arch ? `primary=${arch}` : "no archetype" },
    },
    mismatches,
  };
}
