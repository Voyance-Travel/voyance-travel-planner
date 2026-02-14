/**
 * Edge Function Constant Sync Verification
 * Checks that duplicated constants in Deno edge functions match the
 * source of truth in src/config/pricing.ts and src/lib/tripCostCalculator.ts.
 *
 * Usage: npx ts-node scripts/check-edge-constants.ts
 * Exit code 1 on mismatch (CI-friendly).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

// Source of truth files
const PRICING_FILE = path.join(ROOT, 'src/config/pricing.ts');
const TRIP_CALC_FILE = path.join(ROOT, 'src/lib/tripCostCalculator.ts');

// Edge function files to check
const EDGE_FILES = [
  path.join(ROOT, 'supabase/functions/get-entitlements/index.ts'),
  path.join(ROOT, 'supabase/functions/spend-credits/index.ts'),
];

interface ConstantDef {
  name: string;
  value: number;
  source: string;
}

function extractNumber(content: string, pattern: RegExp): number | null {
  const match = content.match(pattern);
  return match ? Number(match[1]) : null;
}

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// Extract source-of-truth constants
function getSourceConstants(): ConstantDef[] {
  const pricing = readFile(PRICING_FILE);
  const tripCalc = readFile(TRIP_CALC_FILE);

  const constants: ConstantDef[] = [];

  // From pricing.ts
  const costMap: Record<string, RegExp> = {
    UNLOCK_DAY: /UNLOCK_DAY:\s*(\d+)/,
    SMART_FINISH: /SMART_FINISH:\s*(\d+)/,
    REGENERATE_DAY: /REGENERATE_DAY:\s*(\d+)/,
    SWAP_ACTIVITY: /SWAP_ACTIVITY:\s*(\d+)/,
    RESTAURANT_REC: /RESTAURANT_REC:\s*(\d+)/,
    AI_MESSAGE: /AI_MESSAGE:\s*(\d+)/,
    HOTEL_SEARCH: /HOTEL_SEARCH:\s*(\d+)/,
    HOTEL_OPTIMIZATION: /HOTEL_OPTIMIZATION:\s*(\d+)/,
    TRANSPORT_MODE_CHANGE: /TRANSPORT_MODE_CHANGE:\s*(\d+)/,
    MYSTERY_GETAWAY: /MYSTERY_GETAWAY:\s*(\d+)/,
    MYSTERY_LOGISTICS: /MYSTERY_LOGISTICS:\s*(\d+)/,
  };

  for (const [name, regex] of Object.entries(costMap)) {
    const val = extractNumber(pricing, regex);
    if (val !== null) {
      constants.push({ name, value: val, source: 'pricing.ts' });
    }
  }

  // From tripCostCalculator.ts
  const baseRate = extractNumber(tripCalc, /BASE_RATE_PER_DAY\s*=\s*(\d+)/);
  if (baseRate !== null) {
    constants.push({ name: 'BASE_RATE_PER_DAY', value: baseRate, source: 'tripCostCalculator.ts' });
  }

  return constants;
}

// Check edge function for matching values
function checkEdgeFile(filePath: string, sourceConstants: ConstantDef[]): string[] {
  const content = readFile(filePath);
  const fileName = path.relative(ROOT, filePath);
  const mismatches: string[] = [];

  const edgePatterns: Record<string, RegExp[]> = {
    UNLOCK_DAY: [/unlock_day:\s*(\d+)/i],
    SMART_FINISH: [/smart_finish:\s*(\d+)/i],
    REGENERATE_DAY: [/regenerate_day:\s*(\d+)/i],
    SWAP_ACTIVITY: [/swap_activity:\s*(\d+)/i],
    RESTAURANT_REC: [/restaurant_rec:\s*(\d+)/i],
    AI_MESSAGE: [/ai_message:\s*(\d+)/i],
    HOTEL_SEARCH: [/hotel_search:\s*(\d+)/i, /HOTEL_SEARCH_PER_CITY\s*=\s*(\d+)/],
    HOTEL_OPTIMIZATION: [/hotel_optimization:\s*(\d+)/i],
    TRANSPORT_MODE_CHANGE: [/transport_mode_change:\s*(\d+)/i],
    MYSTERY_GETAWAY: [/mystery_getaway:\s*(\d+)/i],
    MYSTERY_LOGISTICS: [/mystery_logistics:\s*(\d+)/i],
    BASE_RATE_PER_DAY: [/base_rate_per_day:\s*(\d+)/i, /BASE_RATE_PER_DAY\s*=\s*(\d+)/],
  };

  for (const src of sourceConstants) {
    const patterns = edgePatterns[src.name];
    if (!patterns) continue;

    for (const pattern of patterns) {
      const edgeVal = extractNumber(content, pattern);
      if (edgeVal !== null && edgeVal !== src.value) {
        mismatches.push(
          `MISMATCH in ${fileName}: ${src.name} = ${edgeVal} (expected ${src.value} from ${src.source})`
        );
      }
    }
  }

  return mismatches;
}

// Main
const sourceConstants = getSourceConstants();
console.log(`Found ${sourceConstants.length} source constants to verify.\n`);

let allMismatches: string[] = [];

for (const edgeFile of EDGE_FILES) {
  const mismatches = checkEdgeFile(edgeFile, sourceConstants);
  allMismatches = allMismatches.concat(mismatches);
}

if (allMismatches.length > 0) {
  console.error('❌ Constant mismatches found:\n');
  for (const m of allMismatches) {
    console.error(`  • ${m}`);
  }
  console.error('\nUpdate the edge functions to match src/config/pricing.ts.');
  process.exit(1);
} else {
  console.log('✅ All edge function constants match source of truth.');
  process.exit(0);
}
