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
import { Cookie, Settings, Check, X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

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
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);
  const [isSaving, setIsSaving] = useState(false);

  // Check for existing consent on mount
  useEffect(() => {
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
    setShowSettings(false);
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
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Main banner */}
              {!showSettings ? (
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
                        We use cookies to enhance your browsing experience, personalize content, and analyze our traffic. 
                        By clicking "Accept All", you consent to our use of cookies.{' '}
                        <Link to={ROUTES.PRIVACY} className="text-primary hover:underline">
                          Learn more
                        </Link>
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleAcceptAll}
                          disabled={isSaving}
                          className="gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Accept All
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleRejectNonEssential}
                          disabled={isSaving}
                        >
                          Essential Only
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setShowSettings(true)}
                          className="gap-2"
                        >
                          <Settings className="w-4 h-4" />
                          Customize
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Settings panel */
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Cookie Preferences</h3>
                    </div>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    {/* Essential cookies - always on */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm text-foreground">Essential Cookies</p>
                        <p className="text-xs text-muted-foreground">
                          Required for the website to function. Cannot be disabled.
                        </p>
                      </div>
                      <Switch checked={true} disabled />
                    </div>
                    
                    {/* Analytics cookies */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm text-foreground">Analytics Cookies</p>
                        <p className="text-xs text-muted-foreground">
                          Help us understand how you use our site to improve it.
                        </p>
                      </div>
                      <Switch
                        checked={preferences.analytics}
                        onCheckedChange={(checked) => 
                          setPreferences(prev => ({ ...prev, analytics: checked }))
                        }
                      />
                    </div>
                    
                    {/* Marketing cookies */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm text-foreground">Marketing Cookies</p>
                        <p className="text-xs text-muted-foreground">
                          Used to deliver relevant ads and track campaign effectiveness.
                        </p>
                      </div>
                      <Switch
                        checked={preferences.marketing}
                        onCheckedChange={(checked) => 
                          setPreferences(prev => ({ ...prev, marketing: checked }))
                        }
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSavePreferences}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      Save Preferences
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowSettings(false)}
                    >
                      Cancel
                    </Button>
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
