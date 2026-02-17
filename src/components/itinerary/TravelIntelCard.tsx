/**
 * TravelIntelCard — Per-country "Need to Know" collapsible card
 * Shows currency, tipping, power adapters, visa, emergency numbers, language basics
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Globe, Banknote, Plug, Shield, Phone, Languages, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TravelIntelData {
  country: string;
  currency: {
    code: string;
    symbol: string;
    name: string;
    exchangeRate: string; // e.g. "¥150 = $1 USD"
  };
  tipping: string;
  powerAdapter: string;
  visa: string;
  emergencyNumbers: {
    police: string;
    ambulance: string;
    fire?: string;
  };
  languageBasics: Array<{ phrase: string; translation: string; pronunciation?: string }>;
}

// Static database of travel intel per country
const TRAVEL_INTEL_DB: Record<string, TravelIntelData> = {
  'Japan': {
    country: 'Japan',
    currency: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', exchangeRate: '¥150 ≈ $1 USD' },
    tipping: 'No tipping expected — can be considered rude. Exceptional service is the norm.',
    powerAdapter: 'Type A/B (same as US/Canada). 100V — most devices work fine.',
    visa: 'US/EU citizens: 90-day visa-free entry. Passport must be valid for duration of stay.',
    emergencyNumbers: { police: '110', ambulance: '119', fire: '119' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Konnichiwa', pronunciation: 'kohn-nee-chee-wah' },
      { phrase: 'Thank you', translation: 'Arigatou gozaimasu', pronunciation: 'ah-ree-gah-toh go-zah-ee-mahs' },
      { phrase: 'Excuse me', translation: 'Sumimasen', pronunciation: 'soo-mee-mah-sen' },
      { phrase: 'How much?', translation: 'Ikura desu ka?', pronunciation: 'ee-koo-rah des-kah' },
      { phrase: 'Help!', translation: 'Tasukete!', pronunciation: 'tah-soo-keh-teh' },
    ],
  },
  'France': {
    country: 'France',
    currency: { code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: '€1 ≈ $1.08 USD' },
    tipping: 'Service included (service compris). Round up or leave 5-10% for excellent service.',
    powerAdapter: 'Type C/E — European two-pin. Bring a US-to-EU adapter.',
    visa: 'US citizens: 90-day visa-free (Schengen area). UK citizens: 90 days visa-free.',
    emergencyNumbers: { police: '17', ambulance: '15', fire: '18' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Bonjour', pronunciation: 'bohn-zhoor' },
      { phrase: 'Thank you', translation: 'Merci', pronunciation: 'mair-see' },
      { phrase: 'Excuse me', translation: 'Excusez-moi', pronunciation: 'ex-koo-zay mwah' },
      { phrase: 'How much?', translation: 'Combien?', pronunciation: 'kohm-bee-ehn' },
      { phrase: 'Help!', translation: 'Au secours!', pronunciation: 'oh suh-koor' },
    ],
  },
  'Italy': {
    country: 'Italy',
    currency: { code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: '€1 ≈ $1.08 USD' },
    tipping: 'Coperto (cover charge) is common. Tipping 5-10% appreciated but not expected.',
    powerAdapter: 'Type C/L — European two/three-pin. Bring a US-to-EU adapter.',
    visa: 'US citizens: 90-day visa-free (Schengen area).',
    emergencyNumbers: { police: '112', ambulance: '118', fire: '115' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Ciao / Buongiorno', pronunciation: 'chow / bwon-jor-no' },
      { phrase: 'Thank you', translation: 'Grazie', pronunciation: 'grah-tsee-eh' },
      { phrase: 'Excuse me', translation: 'Scusi', pronunciation: 'skoo-zee' },
      { phrase: 'How much?', translation: 'Quanto costa?', pronunciation: 'kwahn-toh kos-tah' },
      { phrase: 'Help!', translation: 'Aiuto!', pronunciation: 'ah-yoo-toh' },
    ],
  },
  'United Kingdom': {
    country: 'United Kingdom',
    currency: { code: 'GBP', symbol: '£', name: 'British Pound', exchangeRate: '£1 ≈ $1.27 USD' },
    tipping: '10-15% at restaurants. Pubs: not expected. Taxis: round up.',
    powerAdapter: 'Type G — British three-pin. Bring a specific UK adapter.',
    visa: 'US citizens: 6-month visa-free entry. EU citizens: 6 months visa-free.',
    emergencyNumbers: { police: '999', ambulance: '999', fire: '999' },
    languageBasics: [
      { phrase: 'Cheers', translation: 'Thanks / goodbye', pronunciation: 'cheerz' },
      { phrase: 'Brilliant', translation: 'Great / awesome', pronunciation: 'bril-yuhnt' },
      { phrase: 'Queue', translation: 'Line (always queue!)', pronunciation: 'kyoo' },
      { phrase: 'Tube', translation: 'Underground metro', pronunciation: 'toob' },
      { phrase: 'Loo', translation: 'Bathroom/toilet', pronunciation: 'loo' },
    ],
  },
  'Spain': {
    country: 'Spain',
    currency: { code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: '€1 ≈ $1.08 USD' },
    tipping: 'Not expected but appreciated. Round up or leave 5-10% for sit-down meals.',
    powerAdapter: 'Type C/F — European two-pin. Bring a US-to-EU adapter.',
    visa: 'US citizens: 90-day visa-free (Schengen area).',
    emergencyNumbers: { police: '091', ambulance: '061', fire: '080' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Hola', pronunciation: 'oh-lah' },
      { phrase: 'Thank you', translation: 'Gracias', pronunciation: 'grah-thee-ahs' },
      { phrase: 'Excuse me', translation: 'Perdón', pronunciation: 'pair-dohn' },
      { phrase: 'How much?', translation: '¿Cuánto cuesta?', pronunciation: 'kwahn-toh kwes-tah' },
      { phrase: 'Help!', translation: '¡Ayuda!', pronunciation: 'ah-yoo-dah' },
    ],
  },
  'Portugal': {
    country: 'Portugal',
    currency: { code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: '€1 ≈ $1.08 USD' },
    tipping: '5-10% at restaurants if satisfied. Not obligatory.',
    powerAdapter: 'Type C/F — European two-pin. Bring a US-to-EU adapter.',
    visa: 'US citizens: 90-day visa-free (Schengen area).',
    emergencyNumbers: { police: '112', ambulance: '112', fire: '112' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Olá', pronunciation: 'oh-lah' },
      { phrase: 'Thank you', translation: 'Obrigado/a', pronunciation: 'oh-bree-gah-doo' },
      { phrase: 'Excuse me', translation: 'Com licença', pronunciation: 'kohm lee-sehn-sah' },
      { phrase: 'How much?', translation: 'Quanto custa?', pronunciation: 'kwahn-too koosh-tah' },
      { phrase: 'Help!', translation: 'Socorro!', pronunciation: 'soh-koh-hoo' },
    ],
  },
  'Thailand': {
    country: 'Thailand',
    currency: { code: 'THB', symbol: '฿', name: 'Thai Baht', exchangeRate: '฿35 ≈ $1 USD' },
    tipping: 'Not traditional but appreciated in tourist areas. 20-50 baht for good service.',
    powerAdapter: 'Type A/B/C — US plugs work in many outlets. Voltage is 220V, check devices.',
    visa: 'US/EU citizens: 30-60 day visa-free (varies by nationality).',
    emergencyNumbers: { police: '191', ambulance: '1669', fire: '199' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Sawasdee', pronunciation: 'sah-wah-dee' },
      { phrase: 'Thank you', translation: 'Khop khun', pronunciation: 'kohp-koon' },
      { phrase: 'Excuse me', translation: 'Khor thot', pronunciation: 'kor-toht' },
      { phrase: 'How much?', translation: 'Tao rai?', pronunciation: 'tow-rai' },
      { phrase: 'Help!', translation: 'Chuay duay!', pronunciation: 'choo-ay doo-ay' },
    ],
  },
  'Vietnam': {
    country: 'Vietnam',
    currency: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', exchangeRate: '₫25,000 ≈ $1 USD' },
    tipping: 'Not expected but 5-10% appreciated at upscale restaurants.',
    powerAdapter: 'Type A/C — US plugs usually work. 220V — check devices.',
    visa: 'US citizens: e-Visa required (90 days). UK/EU: 45-day visa-free.',
    emergencyNumbers: { police: '113', ambulance: '115', fire: '114' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Xin chào', pronunciation: 'sin chow' },
      { phrase: 'Thank you', translation: 'Cảm ơn', pronunciation: 'gahm uhn' },
      { phrase: 'Excuse me', translation: 'Xin lỗi', pronunciation: 'sin loy' },
      { phrase: 'How much?', translation: 'Bao nhiêu?', pronunciation: 'bow nyew' },
      { phrase: 'Help!', translation: 'Cứu tôi!', pronunciation: 'koo-oo toy' },
    ],
  },
  'Cambodia': {
    country: 'Cambodia',
    currency: { code: 'KHR', symbol: '៛', name: 'Cambodian Riel (USD widely accepted)', exchangeRate: '4,000៛ ≈ $1 USD' },
    tipping: 'Not expected but $1-2 USD appreciated for guides and drivers.',
    powerAdapter: 'Type A/C/G — mixed. Bring a universal adapter. 230V.',
    visa: 'Visa on arrival for most nationalities ($30 USD, bring passport photo).',
    emergencyNumbers: { police: '117', ambulance: '119', fire: '118' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Sua s\'dei', pronunciation: 'soo-ah s-day' },
      { phrase: 'Thank you', translation: 'Aw kohn', pronunciation: 'aw-koon' },
      { phrase: 'Excuse me', translation: 'Som toh', pronunciation: 'som-toh' },
      { phrase: 'How much?', translation: 'Thlai ponman?', pronunciation: 'tlay pon-mahn' },
      { phrase: 'Help!', translation: 'Chuoy!', pronunciation: 'choo-oy' },
    ],
  },
  'Czech Republic': {
    country: 'Czech Republic',
    currency: { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', exchangeRate: '23 Kč ≈ $1 USD' },
    tipping: '10% at restaurants. Round up for taxis and bars.',
    powerAdapter: 'Type C/E — European two-pin. Bring a US-to-EU adapter.',
    visa: 'US citizens: 90-day visa-free (Schengen area).',
    emergencyNumbers: { police: '158', ambulance: '155', fire: '150' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Dobrý den', pronunciation: 'doh-bree den' },
      { phrase: 'Thank you', translation: 'Děkuji', pronunciation: 'dyeh-koo-yee' },
      { phrase: 'Excuse me', translation: 'Promiňte', pronunciation: 'pro-min-teh' },
      { phrase: 'How much?', translation: 'Kolik to stojí?', pronunciation: 'koh-lik toh stoy-ee' },
      { phrase: 'Cheers!', translation: 'Na zdraví!', pronunciation: 'nah zdrah-vee' },
    ],
  },
  'Austria': {
    country: 'Austria',
    currency: { code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: '€1 ≈ $1.08 USD' },
    tipping: '5-10% at restaurants. Round up for taxis.',
    powerAdapter: 'Type C/F — European two-pin. Bring a US-to-EU adapter.',
    visa: 'US citizens: 90-day visa-free (Schengen area).',
    emergencyNumbers: { police: '133', ambulance: '144', fire: '122' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Grüß Gott', pronunciation: 'groos got' },
      { phrase: 'Thank you', translation: 'Danke', pronunciation: 'dahn-keh' },
      { phrase: 'Excuse me', translation: 'Entschuldigung', pronunciation: 'ent-shool-dee-goong' },
      { phrase: 'How much?', translation: 'Wie viel kostet das?', pronunciation: 'vee feel kos-tet dahs' },
      { phrase: 'Cheers!', translation: 'Prost!', pronunciation: 'prohst' },
    ],
  },
  'Hungary': {
    country: 'Hungary',
    currency: { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', exchangeRate: '360 Ft ≈ $1 USD' },
    tipping: '10-15% at restaurants. Check if service is included.',
    powerAdapter: 'Type C/F — European two-pin. Bring a US-to-EU adapter.',
    visa: 'US citizens: 90-day visa-free (Schengen area).',
    emergencyNumbers: { police: '107', ambulance: '104', fire: '105' },
    languageBasics: [
      { phrase: 'Hello', translation: 'Szia / Jó napot', pronunciation: 'see-ah / yo nah-pot' },
      { phrase: 'Thank you', translation: 'Köszönöm', pronunciation: 'kuh-suh-nuhm' },
      { phrase: 'Excuse me', translation: 'Elnézést', pronunciation: 'el-nay-zaysht' },
      { phrase: 'How much?', translation: 'Mennyibe kerül?', pronunciation: 'men-yee-beh keh-rool' },
      { phrase: 'Cheers!', translation: 'Egészségedre!', pronunciation: 'eh-gays-shay-ged-reh' },
    ],
  },
};

// Country name aliases for fuzzy matching
const COUNTRY_ALIASES: Record<string, string> = {
  'UK': 'United Kingdom',
  'England': 'United Kingdom',
  'Scotland': 'United Kingdom',
  'Wales': 'United Kingdom',
  'Great Britain': 'United Kingdom',
  'USA': 'United States',
  'US': 'United States',
  'Czechia': 'Czech Republic',
};

export function getTravelIntel(country: string): TravelIntelData | null {
  const normalized = COUNTRY_ALIASES[country] || country;
  return TRAVEL_INTEL_DB[normalized] || null;
}

// Guess country from city name
const CITY_TO_COUNTRY: Record<string, string> = {
  'Tokyo': 'Japan', 'Kyoto': 'Japan', 'Osaka': 'Japan',
  'Paris': 'France', 'Lyon': 'France', 'Nice': 'France', 'Marseille': 'France',
  'Rome': 'Italy', 'Florence': 'Italy', 'Venice': 'Italy', 'Milan': 'Italy', 'Naples': 'Italy',
  'London': 'United Kingdom', 'Edinburgh': 'United Kingdom', 'Manchester': 'United Kingdom',
  'Barcelona': 'Spain', 'Madrid': 'Spain', 'Seville': 'Spain', 'Valencia': 'Spain',
  'Lisbon': 'Portugal', 'Porto': 'Portugal',
  'Bangkok': 'Thailand', 'Chiang Mai': 'Thailand', 'Phuket': 'Thailand',
  'Ho Chi Minh City': 'Vietnam', 'Hanoi': 'Vietnam', 'Da Nang': 'Vietnam',
  'Siem Reap': 'Cambodia', 'Phnom Penh': 'Cambodia',
  'Prague': 'Czech Republic',
  'Vienna': 'Austria', 'Salzburg': 'Austria',
  'Budapest': 'Hungary',
};

export function getTravelIntelForCity(city: string): TravelIntelData | null {
  const country = CITY_TO_COUNTRY[city];
  if (country) return getTravelIntel(country);
  return null;
}

interface TravelIntelCardProps {
  city: string;
  country?: string;
  className?: string;
  defaultExpanded?: boolean;
}

export default function TravelIntelCard({ city, country, className, defaultExpanded = false }: TravelIntelCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const intel = country ? getTravelIntel(country) : getTravelIntelForCity(city);
  if (!intel) return null;

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-foreground">Travel Intel</span>
            <span className="text-xs text-muted-foreground ml-2">{intel.country}</span>
          </div>
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 text-muted-foreground transition-transform duration-200',
          isExpanded && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              {/* Currency */}
              <div className="flex items-start gap-3">
                <Banknote className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">{intel.currency.name} ({intel.currency.code})</p>
                  <p className="text-xs text-muted-foreground">{intel.currency.exchangeRate}</p>
                </div>
              </div>

              {/* Tipping */}
              <div className="flex items-start gap-3">
                <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Tipping</p>
                  <p className="text-xs text-muted-foreground">{intel.tipping}</p>
                </div>
              </div>

              {/* Power */}
              <div className="flex items-start gap-3">
                <Plug className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Power Adapter</p>
                  <p className="text-xs text-muted-foreground">{intel.powerAdapter}</p>
                </div>
              </div>

              {/* Visa */}
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Visa</p>
                  <p className="text-xs text-muted-foreground">{intel.visa}</p>
                </div>
              </div>

              {/* Emergency */}
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Emergency Numbers</p>
                  <p className="text-xs text-muted-foreground">
                    Police: {intel.emergencyNumbers.police} · Ambulance: {intel.emergencyNumbers.ambulance}
                    {intel.emergencyNumbers.fire && ` · Fire: ${intel.emergencyNumbers.fire}`}
                  </p>
                </div>
              </div>

              {/* Language Basics */}
              <div className="flex items-start gap-3">
                <Languages className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground mb-1.5">Essential Phrases</p>
                  <div className="grid grid-cols-1 gap-1">
                    {intel.languageBasics.map((phrase) => (
                      <div key={phrase.phrase} className="flex items-baseline gap-2 text-xs">
                        <span className="text-muted-foreground w-16 shrink-0">{phrase.phrase}</span>
                        <span className="font-medium text-foreground">{phrase.translation}</span>
                        {phrase.pronunciation && (
                          <span className="text-muted-foreground/60 italic text-[10px]">({phrase.pronunciation})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
