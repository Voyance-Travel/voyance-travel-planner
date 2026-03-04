/**
 * Cookie Consent Banner
 * 
 * GDPR/CCPA compliant cookie consent with:
 * - Persistent consent tracking in localStorage
 * - Database recording for authenticated users
 * - Granular cookie preferences (essential, analytics, marketing)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const CONSENT_STORAGE_KEY = 'voyance_cookie_consent';
const CONSENT_VERSION = '1.0'; // Increment to re-prompt users after policy changes

export interface CookiePreferences {
  essential: boolean; // Always true, can't be disabled
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

const defaultPreferences: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
  timestamp: '',
  version: CONSENT_VERSION,
};

export function CookieConsent() {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);
  const [isSaving, setIsSaving] = useState(false);

  // Check for existing consent on mount
  useEffect(() => {
    // Suppress cookie banner inside native app (Apple Guideline 5.1.2(i))
    const isNativeApp = !!(
      (window as any).isNativeApp ||
      navigator.userAgent.includes('VoyanceApp') ||
      (window as any).Capacitor?.isNativePlatform?.() ||
      (window as any).webkit?.messageHandlers?.nativeApp
    );
    if (isNativeApp) {
      const nativePrefs: CookiePreferences = {
        essential: true,
        analytics: false,
        marketing: false,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(nativePrefs));
      setPreferences(nativePrefs);
      return; // Never show banner in native app
    }

    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CookiePreferences;
        // Check if consent is for current version
        if (parsed.version === CONSENT_VERSION) {
          setPreferences(parsed);
          return; // Valid consent exists
        }
      } catch {
        // Invalid stored data, show banner
      }
    }
    
    // No valid consent, show banner after a short delay
    const timer = setTimeout(() => setShowBanner(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Save consent to database for authenticated users
  const saveConsentToDatabase = async (prefs: CookiePreferences) => {
    if (!user?.id) return;
    
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('consent_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('consent_type', 'cookies')
        .maybeSingle();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prefsJson = JSON.parse(JSON.stringify(prefs)) as any;
      
      if (existing) {
        await supabase
          .from('consent_records')
          .update({
            consent_version: CONSENT_VERSION,
            preferences: prefsJson,
            consented_at: prefs.timestamp,
          })
          .eq('id', existing.id);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('consent_records').insert({
          user_id: user.id,
          consent_type: 'cookies',
          consent_version: CONSENT_VERSION,
          preferences: prefsJson,
          consented_at: prefs.timestamp,
        });
      }
    } catch (error) {
      console.error('Failed to save consent to database:', error);
    }
  };

  const handleAcceptAll = async () => {
    setIsSaving(true);
    const prefs: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    await saveConsentToDatabase(prefs);
    setShowBanner(false);
    setIsSaving(false);
  };

  const handleRejectNonEssential = async () => {
    setIsSaving(true);
    const prefs: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    await saveConsentToDatabase(prefs);
    setShowBanner(false);
    setIsSaving(false);
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    const prefs: CookiePreferences = {
      ...preferences,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    await saveConsentToDatabase(prefs);
    setShowBanner(false);
    
    setIsSaving(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
        >
          <div className="max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden relative">
              {/* Main banner */}
              {(
                <div className="p-4 md:p-6">
                  <div className="flex items-start gap-4">
                    <div className="hidden sm:flex w-12 h-12 rounded-xl bg-primary/10 items-center justify-center flex-shrink-0">
                      <Cookie className="w-6 h-6 text-primary" />
                    </div>
                    
              <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1">
                        We value your privacy
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        This site uses cookies to enhance your browsing experience, personalize content, and analyze traffic. 
                        By continuing to use this site, you consent to the use of cookies.
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleAcceptAll}
                          disabled={isSaving}
                          className="gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Accept
                        </Button>
                      </div>
                    </div>
                    <button
                      onClick={handleAcceptAll}
                      className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to check current cookie preferences
export function useCookiePreferences(): CookiePreferences | null {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);
  
  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch {
        setPreferences(null);
      }
    }
  }, []);
  
  return preferences;
}

export default CookieConsent;
