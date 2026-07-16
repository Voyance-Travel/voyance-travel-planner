// Extracted from EditorialItinerary.tsx during the file-size decomposition.
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronUp, Clock, Droplets, FileText, Globe, HeartPulse, RefreshCw, Shield, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeDestination } from './format-utils';
import type { EditorialItineraryProps } from '../EditorialItinerary';

export interface NeedToKnowSectionProps {
  destination: string;
  destinationCountry?: string;
  destinationInfo?: EditorialItineraryProps['destinationInfo'];
}

export function NeedToKnowSection({ destination, destinationCountry, destinationInfo }: NeedToKnowSectionProps) {
  const [expandedCards, setExpandedCards] = useState<string[]>([]);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Fetch real destination insights from Perplexity
  useEffect(() => {
    if (fetchedRef.current || !destination) return;
    
    const fetchInsights = async () => {
      setIsLoadingInsights(true);
      setInsightsError(null);
      
      try {
        const { data, error } = await supabase.functions.invoke('lookup-destination-insights', {
          body: { destination, country: destinationCountry }
        });
        
        if (error) throw error;
        
        if (data?.success && data?.data) {
          setAiInsights(data.data);
          fetchedRef.current = true;
        }
      } catch (err) {
        console.error('Failed to fetch destination insights:', err);
        setInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
      } finally {
        setIsLoadingInsights(false);
      }
    };
    
    fetchInsights();
  }, [destination, destinationCountry]);

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  // Static essentials only — currency, tipping, transit live in Travel Intel
  // NOTE: AI/static merge is delegated to mergeNeedToKnowInfo so partial
  // Perplexity responses fall back per-field instead of leaking generic
  // placeholders like "Local language" / "Local time".
  const getDefaultInfo = () => {
    const country = destinationCountry?.toLowerCase() || '';
    const dest = (destination || '').toLowerCase();
    
    // UK / London
    if (country.includes('uk') || country.includes('united kingdom') || country.includes('england') || dest.includes('london')) {
      return {
        language: 'English',
        languageTips: [
          'British English differs from American English',
          '"Cheers" means thanks, goodbye, or a toast',
          '"Queue" means line - respect the queue!',
          'Politeness is highly valued'
        ],
        timezone: 'GMT (UTC+0) / BST (UTC+1 summer)',
        timezoneTips: [
          'Shops typically close 6-7 PM, later in central London',
          'Pubs traditionally close around 11 PM',
          'Sunday trading hours are limited'
        ],
        water: 'Tap water is safe and excellent quality',
        waterTips: [
          'Free tap water available at restaurants',
          'Refill stations at many tube stations',
          'No need to buy bottled water'
        ],
        voltage: '230V, Type G plugs (3-pin)',
        voltageTips: [
          'US/EU devices need UK adapters',
          'Hotels often have shaver sockets',
          'USB charging works without adapters'
        ],
        emergency: '999 (Emergency) / 111 (Non-urgent NHS)',
        emergencyTips: [
          '999 for police, fire, ambulance',
          '111 for non-emergency medical advice',
          'A&E (Emergency Room) at major hospitals',
          'Pharmacies can advise on minor issues'
        ],
      };
    }
    
    // France / Paris
    if (country.includes('france') || dest.includes('paris')) {
      return {
        language: 'French',
        languageTips: [
          '"Bonjour" (Hello) - always greet first',
          '"Merci" (Thank you) - essential',
          '"Pardon" (Excuse me) - polite interruption',
          'English widely spoken in tourist areas'
        ],
        timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
        timezoneTips: [
          'Many shops close Sundays',
          'Lunch is typically 12-2 PM',
          'Dinner starts around 8 PM'
        ],
        water: 'Tap water is safe to drink',
        waterTips: [
          '"Carafe d\'eau" for free tap water at restaurants',
          'Wallace fountains provide free drinking water',
          'Bottled water available everywhere'
        ],
        voltage: '230V, Type C/E plugs',
        voltageTips: [
          'US/UK devices need adapters',
          'Most hotels have adapters available',
          'USB charging works without adapters'
        ],
        emergency: '112 (EU Emergency) / 15 (Medical) / 17 (Police)',
        emergencyTips: [
          '112 works EU-wide from any phone',
          'Pharmacies (green cross) can advise on minor issues',
          'SOS Médecins for doctor house calls',
          'Keep embassy contact handy'
        ],
      };
    }
    
    // Spain / Barcelona / Madrid
    if (country.includes('spain') || dest.includes('barcelona') || dest.includes('madrid')) {
      return {
        language: 'Spanish (Catalan in Barcelona)',
        languageTips: [
          '"Hola" (Hello) - friendly greeting',
          '"Gracias" (Thank you)',
          '"Por favor" (Please)',
          'Catalan spoken in Barcelona alongside Spanish'
        ],
        timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
        timezoneTips: [
          'Siesta: many shops close 2-5 PM',
          'Dinner typically starts 9-10 PM',
          'Nightlife runs very late'
        ],
        water: 'Tap water is safe but tastes mineral',
        waterTips: [
          'Bottled water commonly preferred',
          'Restaurants may charge for water',
          '"Agua del grifo" for tap water'
        ],
        voltage: '230V, Type C/F plugs',
        voltageTips: [
          'Same as rest of Europe',
          'US/UK devices need adapters',
          'USB charging works without adapters'
        ],
        emergency: '112 (All emergencies)',
        emergencyTips: [
          '112 for police, fire, ambulance',
          'Tourist police in major cities',
          'Pharmacies have green cross',
          'Hospitals have 24h emergency'
        ],
      };
    }
    
    // Italy / Rome
    if (country.includes('italy') || dest.includes('rome') || dest.includes('milan') || dest.includes('florence') || dest.includes('venice')) {
      return {
        language: 'Italian',
        languageTips: [
          '"Buongiorno" (Good morning) - formal greeting',
          '"Grazie" (Thank you) - essential phrase',
          '"Scusi" (Excuse me) - polite way to get attention',
          'English spoken at tourist spots, less in small towns'
        ],
        timezone: 'CET (UTC+1)',
        timezoneTips: [
          'Shops often close 1-4 PM for "riposo"',
          'Dinner typically starts 8-9 PM',
          'Museums may close early on Mondays'
        ],
        water: 'Tap water is safe to drink',
        waterTips: [
          'Public drinking fountains ("nasoni") everywhere',
          'Free water at restaurants upon request',
          'Bottled water widely available'
        ],
        voltage: '230V, Type C/F plugs',
        voltageTips: [
          'US/UK devices need adapters',
          'Most hotels have adapters available',
          'USB charging works without adapters'
        ],
        emergency: '112 (EU Emergency), 118 (Ambulance)',
        emergencyTips: [
          '112 works from any phone, even without SIM',
          'Pharmacies display green cross, rotate night shifts',
          'Keep copies of passport separate from originals'
        ],
      };
    }
    
    // Germany / Berlin / Munich
    if (country.includes('germany') || dest.includes('berlin') || dest.includes('munich')) {
      return {
        language: 'German',
        languageTips: [
          '"Guten Tag" (Hello) - formal greeting',
          '"Danke" (Thank you)',
          '"Bitte" (Please/You\'re welcome)',
          'English widely spoken, especially by young people'
        ],
        timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
        timezoneTips: [
          'Shops closed on Sundays (except tourist areas)',
          'Punctuality is highly valued',
          'Dinner typically 6-8 PM'
        ],
        water: 'Tap water is excellent quality',
        waterTips: [
          'Restaurant water is usually bottled (paid)',
          'Ask for "Leitungswasser" for tap water',
          'Sparkling water (Sprudel) very popular'
        ],
        voltage: '230V, Type C/F plugs',
        voltageTips: [
          'Same as rest of Europe',
          'US/UK devices need adapters',
          'USB charging works without adapters'
        ],
        emergency: '112 (Emergency) / 110 (Police)',
        emergencyTips: [
          '112 for fire and ambulance',
          '110 for police',
          'Apotheke (pharmacy) for minor issues',
          'Most pharmacists speak English'
        ],
      };
    }

    // Default fallback
    return {
      language: destinationInfo?.language || 'Local language',
      languageTips: ['Learn basic greetings', 'Translation apps work offline', 'Locals appreciate any effort'],
      timezone: destinationInfo?.timezone || 'Local time',
      timezoneTips: ['Adjust sleep schedule a few days before', 'Stay hydrated during flights'],
      water: destinationInfo?.water || 'Check local advisories',
      waterTips: ['When in doubt, use bottled water', 'Ice in drinks may use tap water'],
      voltage: destinationInfo?.voltage || 'Check adapter requirements',
      voltageTips: ['Universal adapters are convenient', 'Check voltage compatibility for hair dryers'],
      emergency: destinationInfo?.emergency || 'Contact local authorities',
      emergencyTips: ['Save emergency numbers in your phone', 'Know your hotel address in local language'],
    };
  };

  // Get entry requirements based on destination
  const getEntryRequirements = () => {
    const country = destinationCountry?.toLowerCase() || '';
    const dest = (destination || '').toLowerCase();
    
    // UK
    if (country.includes('uk') || country.includes('united kingdom') || country.includes('england') || dest.includes('london')) {
      return {
        visa: 'US citizens: Visa-free for up to 6 months',
        visaTips: [
          'No visa required for tourism (US/EU citizens)',
          'Must show proof of return/onward travel',
          'May need to show proof of accommodation',
          'UK ETA is now required for most non-EU/non-Irish visitors - apply online before travel'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Passport must be valid for entire stay',
          'No minimum validity requirement beyond trip',
          'Blank pages not strictly required',
          'Keep a photo of passport on your phone'
        ],
        health: 'No required vaccinations',
        healthTips: [
          "Check current health advisories with your country's foreign-travel office",
          'NHS available for emergencies (may incur charges)',
          'European Health Insurance Card (EHIC) no longer valid for UK',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // France
    if (country.includes('france') || dest.includes('paris')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS pre-travel authorisation will be required once it launches - check the official EU travel site before booking',
          'No visa required for tourism (US/EU citizens)',
          'Count all Schengen countries toward 90-day limit'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'Keep color copies separate from original'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'Pharmacies can provide basic medical advice',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Italy / Rome
    if (country.includes('italy') || dest.includes('rome') || dest.includes('florence') || dest.includes('venice') || dest.includes('milan')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS pre-travel authorisation will be required once it launches - check the official EU travel site before booking',
          'No visa required for tourism (US/EU citizens)',
          'Register at local police station if staying 8+ days (handled by hotels)'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'Carry passport when visiting major sites (security checks)'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'Tap water is safe to drink',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Spain
    if (country.includes('spain') || dest.includes('barcelona') || dest.includes('madrid')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS pre-travel authorisation will be required once it launches - check the official EU travel site before booking',
          'No visa required for tourism (US/EU citizens)',
          'Count all Schengen countries toward 90-day limit'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'National ID card accepted for EU citizens'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'Pharmacies well-stocked and helpful',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Germany
    if (country.includes('germany') || dest.includes('berlin') || dest.includes('munich')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS pre-travel authorisation will be required once it launches - check the official EU travel site before booking',
          'No visa required for tourism (US/EU citizens)',
          'Count all Schengen countries toward 90-day limit'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'National ID card accepted for EU citizens'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'High-quality healthcare system',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Default fallback
    return {
      visa: 'Check visa requirements for your nationality',
      visaTips: [
        'Requirements vary by passport/nationality',
        'Apply for visa well in advance if required',
        'Some visas can take weeks to process',
        'Check embassy website for latest requirements'
      ],
      passport: 'Valid passport required',
      passportTips: [
        'Typically must be valid 6+ months beyond travel dates',
        'Check blank page requirements',
        'Keep digital and physical copies separate',
        'Note passport expiration date'
      ],
      health: 'Check health advisories',
      healthTips: [
        'Consult CDC travel health notices',
        'Some destinations require vaccinations',
        'Bring sufficient prescription medications',
        'Travel insurance strongly recommended'
      ],
    };
  };

  const entryInfo = getEntryRequirements();

  const info = mergeNeedToKnowInfo(aiInsights, getDefaultInfo() as any) as any;

  const infoCategories = [
    // Entry Requirements - Most important first
    {
      id: 'visa',
      icon: <Shield className="h-5 w-5" />,
      label: 'Visa Requirements',
      value: entryInfo.visa,
      tips: entryInfo.visaTips,
    },
    {
      id: 'passport',
      icon: <FileText className="h-5 w-5" />,
      label: 'Passport',
      value: entryInfo.passport,
      tips: entryInfo.passportTips,
    },
    {
      id: 'health',
      icon: <HeartPulse className="h-5 w-5" />,
      label: 'Health & Vaccinations',
      value: entryInfo.health,
      tips: entryInfo.healthTips,
    },
    // Static basics — currency, tipping, transit live in Travel Intel
    {
      id: 'language',
      icon: <Globe className="h-5 w-5" />,
      label: 'Language',
      value: info.language + (info.languageEnglishFriendly ? ` (${info.languageEnglishFriendly})` : ''),
      tips: info.languageTips,
    },
    {
      id: 'timezone',
      icon: <Clock className="h-5 w-5" />,
      label: 'Timezone',
      value: info.timezone,
      tips: info.timezoneTips,
    },
    {
      id: 'water',
      icon: <Droplets className="h-5 w-5" />,
      label: 'Water Safety',
      value: info.water,
      tips: info.waterTips,
    },
    {
      id: 'voltage',
      icon: <Sparkles className="h-5 w-5" />,
      label: 'Electricity',
      value: info.voltage,
      tips: info.voltageTips,
    },
    {
      id: 'emergency',
      icon: <AlertCircle className="h-5 w-5" />,
      label: 'Emergency',
      value: info.emergency,
      tips: info.emergencyTips,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-serif">Need to Know</h2>
            <p className="text-sm text-muted-foreground">Essential info for {destination}</p>
          </div>
        </div>
        {isLoadingInsights && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading local insights...</span>
          </div>
        )}
        {aiInsights && !isLoadingInsights && (
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-powered insights
          </Badge>
        )}
      </div>

      {/* Interactive Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {infoCategories.map((category) => {
          const isExpanded = expandedCards.includes(category.id);
          return (
            <motion.div key={category.id}>
              <Card
                className={cn(
                  "cursor-pointer transition-all duration-200 overflow-hidden",
                  isExpanded
                    ? "border-primary/30 shadow-md"
                    : "border-border hover:border-primary/15 hover:shadow-sm"
                )}
                onClick={() => toggleCard(category.id)}
              >
                <CardContent className="p-0">
                  {/* Header - Always visible */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {category.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wider font-semibold mb-1 text-muted-foreground">
                          {category.label}
                        </p>
                        <p className="text-sm text-foreground font-medium leading-relaxed">
                          {category.value}
                        </p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn("shrink-0 ml-2", isExpanded ? "text-primary" : "text-muted-foreground")}
                    >
                      <ChevronDown className="h-5 w-5" />
                    </motion.div>
                  </div>

                  {/* Expandable Tips Section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-4 pb-4 pt-0">
                          <div className="border-t border-border/60 pt-3 mt-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">
                              Quick Tips
                            </p>
                            <ul className="space-y-2">
                              {category.tips.map((tip, idx) => (
                                <motion.li
                                  key={idx}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className="flex items-start gap-2 text-sm text-muted-foreground"
                                >
                                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-primary/40" />
                                  <span>{tip}</span>
                                </motion.li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Cultural Notes - Full Width */}
      {destinationInfo?.culturalNotes && (
        <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-primary">Cultural Notes</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{destinationInfo.culturalNotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expand All / Collapse All */}
      <div className="flex justify-center">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => {
            if (expandedCards.length === infoCategories.length) {
              setExpandedCards([]);
            } else {
              setExpandedCards(infoCategories.map(c => c.id));
            }
          }}
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          {expandedCards.length === infoCategories.length ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Collapse All
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Expand All Tips
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
