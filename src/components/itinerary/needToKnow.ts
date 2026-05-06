/**
 * Need to Know merge contract
 *
 * Partial AI responses from `lookup-destination-insights` must fall back
 * per-field to country-specific static info — never substitute generic
 * "Local language" / "Local time" placeholders that look like UI bugs.
 */

export interface AiPhrase {
  phrase?: string;
  translation?: string;
  pronunciation?: string;
}

export interface AiInsights {
  language?: {
    primary?: string;
    phrases?: AiPhrase[] | null;
    englishFriendly?: string;
  };
  timezone?: { zone?: string; tips?: string[] };
  water?: { safe?: boolean; description?: string; tips?: string[] };
  voltage?: { voltage?: string; plugType?: string; tips?: string[] };
  emergency?: { number?: string; tips?: string[] };
}

export interface StaticInfo {
  language: string;
  languageTips: string[];
  languageEnglishFriendly?: string;
  timezone: string;
  timezoneTips: string[];
  water: string;
  waterTips: string[];
  voltage: string;
  voltageTips: string[];
  emergency: string;
  emergencyTips: string[];
}

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

const cleanTips = (tips: unknown): string[] => {
  if (!Array.isArray(tips)) return [];
  return tips.filter(isNonEmptyString).map((t) => t.trim());
};

export function formatPhrases(phrases: AiPhrase[] | null | undefined): string[] {
  if (!Array.isArray(phrases)) return [];
  const out: string[] = [];
  for (const p of phrases) {
    if (!p || !isNonEmptyString(p.phrase) || !isNonEmptyString(p.translation)) continue;
    const pron = isNonEmptyString(p.pronunciation) ? ` (${p.pronunciation.trim()})` : '';
    out.push(`"${p.phrase.trim()}" = "${p.translation.trim()}"${pron}`);
  }
  return out;
}

function formatVoltage(v?: { voltage?: string; plugType?: string }): string | null {
  if (!v) return null;
  const volt = isNonEmptyString(v.voltage) ? v.voltage.trim() : '';
  const plug = isNonEmptyString(v.plugType) ? v.plugType.trim() : '';
  if (volt && plug) return `${volt}, ${plug}`;
  if (volt) return volt;
  if (plug) return plug;
  return null;
}

function formatWater(w?: { safe?: boolean; description?: string }): string | null {
  if (!w) return null;
  if (isNonEmptyString(w.description)) return w.description.trim();
  if (typeof w.safe === 'boolean') return w.safe ? 'Tap water is safe' : 'Tap water not recommended';
  return null;
}

/**
 * Merge AI insights with country-specific static fallback. For each field,
 * the AI value wins ONLY if both the headline string and at least one tip
 * are populated. Otherwise the static fallback wins. Never returns generic
 * placeholders like "Local language" or "Local time".
 */
export function mergeNeedToKnowInfo(
  aiInsights: AiInsights | null | undefined,
  fallback: StaticInfo,
): StaticInfo {
  if (!aiInsights) return { ...fallback };

  const out: StaticInfo = { ...fallback };

  // Language
  const langTips = cleanTips(aiInsights.language?.tips as unknown);
  const phraseTips = formatPhrases(aiInsights.language?.phrases);
  const langCombinedTips = [...phraseTips, ...langTips];
  if (isNonEmptyString(aiInsights.language?.primary) && langCombinedTips.length > 0) {
    out.language = aiInsights.language!.primary!.trim();
    out.languageTips = langCombinedTips;
    if (isNonEmptyString(aiInsights.language?.englishFriendly)) {
      out.languageEnglishFriendly = aiInsights.language!.englishFriendly!.trim();
    }
  }

  // Timezone
  const tzTips = cleanTips(aiInsights.timezone?.tips);
  if (isNonEmptyString(aiInsights.timezone?.zone) && tzTips.length > 0) {
    out.timezone = aiInsights.timezone!.zone!.trim();
    out.timezoneTips = tzTips;
  }

  // Water
  const waterTips = cleanTips(aiInsights.water?.tips);
  const waterDesc = formatWater(aiInsights.water);
  if (waterDesc && waterTips.length > 0) {
    out.water = waterDesc;
    out.waterTips = waterTips;
  }

  // Voltage
  const voltTips = cleanTips(aiInsights.voltage?.tips);
  const voltDesc = formatVoltage(aiInsights.voltage);
  if (voltDesc && voltTips.length > 0) {
    out.voltage = voltDesc;
    out.voltageTips = voltTips;
  }

  // Emergency
  const emTips = cleanTips(aiInsights.emergency?.tips);
  if (isNonEmptyString(aiInsights.emergency?.number) && emTips.length > 0) {
    out.emergency = aiInsights.emergency!.number!.trim();
    out.emergencyTips = emTips;
  }

  return out;
}
