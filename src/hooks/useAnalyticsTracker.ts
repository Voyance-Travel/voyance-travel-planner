import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp } from '@/utils/analyticsGate';

const SESSION_KEY = 'voy_session_id';
const ADMIN_PATHS = ['/admin'];

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getDeviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  };
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function trackEvent(event: {
  event_type: string;
  page_path: string;
  page_title?: string;
  referrer?: string;
  element_id?: string;
  element_text?: string;
  scroll_depth?: number;
  time_on_page_ms?: number;
  event_data?: Record<string, unknown>;
}) {
  // Skip in native app (Apple Guideline 5.1.2(i)) and admin pages
  if (isNativeApp()) return;
  if (ADMIN_PATHS.some(p => event.page_path.startsWith(p))) return;

  const utm = getUtmParams();
  const userId = await getUserId();

  const row = {
    session_id: getSessionId(),
    user_id: userId,
    event_type: event.event_type,
    page_path: event.page_path,
    page_title: event.page_title || document.title,
    referrer: event.referrer || document.referrer || null,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    element_id: event.element_id || null,
    element_text: event.element_text || null,
    scroll_depth: event.scroll_depth ?? null,
    time_on_page_ms: event.time_on_page_ms ?? null,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_type: getDeviceType(),
    event_data: event.event_data || {},
  };

  // Fire and forget — don't block UI
  supabase.from('page_events').insert([row as any]).then();
}

/**
 * Tracks page views, scroll depth, time on page, and key CTA clicks.
 * Place this in your top-level App layout.
 */
export function useAnalyticsTracker() {
  const location = useLocation();
  const pageEnteredAt = useRef(Date.now());
  const maxScroll = useRef(0);
  const lastPath = useRef('');

  // Track page exit (time + scroll)
  const flushPageExit = useCallback(() => {
    if (lastPath.current && !ADMIN_PATHS.some(p => lastPath.current.startsWith(p))) {
      trackEvent({
        event_type: 'page_exit',
        page_path: lastPath.current,
        time_on_page_ms: Date.now() - pageEnteredAt.current,
        scroll_depth: maxScroll.current,
      });
    }
  }, []);

  // Page view on route change
  useEffect(() => {
    // Flush previous page
    flushPageExit();

    // Reset for new page
    pageEnteredAt.current = Date.now();
    maxScroll.current = 0;
    lastPath.current = location.pathname;

    trackEvent({
      event_type: 'page_view',
      page_path: location.pathname,
      referrer: document.referrer,
    });
  }, [location.pathname, flushPageExit]);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const pct = Math.round((window.scrollY / scrollHeight) * 100);
        if (pct > maxScroll.current) maxScroll.current = pct;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track page exit on unload
  useEffect(() => {
    const handleBeforeUnload = () => flushPageExit();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushPageExit]);
}

/**
 * Track a specific CTA or interaction event from any component.
 */
export function trackInteraction(
  eventType: string,
  elementId?: string,
  elementText?: string,
  data?: Record<string, unknown>
) {
  trackEvent({
    event_type: eventType,
    page_path: window.location.pathname,
    element_id: elementId,
    element_text: elementText,
    event_data: data,
  });
}
