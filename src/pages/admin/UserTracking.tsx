import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, TrendingUp, TrendingDown, Users, MousePointerClick, Eye, Clock, ArrowRight, Search, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay } from 'date-fns';
import { FunnelChart } from '@/components/admin/FunnelChart';

type PageEvent = {
  id: string;
  session_id: string;
  user_id: string | null;
  event_type: string;
  page_path: string;
  page_title: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  scroll_depth: number | null;
  time_on_page_ms: number | null;
  device_type: string | null;
  element_text: string | null;
  created_at: string;
};

// All known site pages — ensures they always appear in the stats table
const ALL_SITE_PAGES: Record<string, string> = {
  '/': 'Home',
  '/explore': 'Explore',
  '/destinations': 'Destinations',
  '/demo': 'Demo',
  '/how-it-works': 'How It Works',
  '/about': 'About',
  '/archetypes': 'Travel Types',
  '/guides': 'Guides',
  '/travel-tips': 'Travel Tips',
  '/sample-itinerary': 'Sample Itinerary',
  '/careers': 'Careers',
  '/press': 'Press',
  '/faq': 'FAQ',
  '/help': 'Help Center',
  '/contact': 'Contact',
  '/pricing': 'Pricing',
  '/privacy': 'Privacy',
  '/terms': 'Terms',
  '/signin': 'Sign In',
  '/signup': 'Sign Up',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
  '/welcome': 'Welcome',
  '/start': 'Start',
  '/quiz': 'Quiz',
  '/onboard/conversation': 'Onboard Conversation',
  '/profile': 'Profile',
  '/profile/edit': 'Profile Edit',
  '/profile/settings': 'Settings',
  '/planner/multi-city': 'Multi-City Planner',
  '/planner/flight': 'Flight Search',
  '/planner/hotel': 'Hotel Search',
  '/planner/summary': 'Trip Summary',
  '/planner/itinerary': 'Planner Itinerary',
  '/planner/booking': 'Booking',
  '/trip/dashboard': 'Trip Dashboard',
  '/payment-success': 'Payment Success',
};

const NICE_NAMES: Record<string, string> = { ...ALL_SITE_PAGES };

function niceName(path: string): string {
  if (NICE_NAMES[path]) return NICE_NAMES[path];
  if (path.startsWith('/destination/')) return 'Destination Detail';
  if (path.startsWith('/guide/')) return 'Guide Detail';
  if (path.startsWith('/trip/')) return 'Trip View';
  return path;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function extractDomain(ref: string): string {
  try {
    const u = new URL(ref);
    return u.hostname.replace('www.', '');
  } catch {
    return ref || 'direct';
  }
}

export default function UserTracking() {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  
  const since = useMemo(() => startOfDay(subDays(new Date(), days)).toISOString(), [days]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['page-events', days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_events')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(50000);
      if (error) throw error;
      return (data || []) as PageEvent[];
    },
  });

  // Compute analytics
  const analytics = useMemo(() => {
    if (!events.length) return null;

    const pageViews = events.filter(e => e.event_type === 'page_view');
    const pageExits = events.filter(e => e.event_type === 'page_exit');
    const interactions = events.filter(e => !['page_view', 'page_exit'].includes(e.event_type));
    const sessions = new Set(events.map(e => e.session_id));
    const authedSessions = new Set(events.filter(e => e.user_id).map(e => e.session_id));

    // --- Entry pages (first page_view per session) ---
    const firstBySession = new Map<string, PageEvent>();
    for (const e of pageViews) {
      if (!firstBySession.has(e.session_id)) firstBySession.set(e.session_id, e);
    }
    const entryCounts: Record<string, number> = {};
    for (const e of firstBySession.values()) {
      entryCounts[e.page_path] = (entryCounts[e.page_path] || 0) + 1;
    }

    // --- Exit pages (last page_view per session) + avg time on exit page ---
    const lastBySession = new Map<string, PageEvent>();
    for (const e of pageViews) {
      lastBySession.set(e.session_id, e);
    }
    const exitTimeBySession = new Map<string, { path: string; time: number }>();
    for (const e of pageExits) {
      exitTimeBySession.set(e.session_id, { path: e.page_path, time: e.time_on_page_ms || 0 });
    }
    const exitData: Record<string, { count: number; totalTime: number; timeEntries: number }> = {};
    for (const e of lastBySession.values()) {
      if (!exitData[e.page_path]) exitData[e.page_path] = { count: 0, totalTime: 0, timeEntries: 0 };
      exitData[e.page_path].count++;
      const exitInfo = exitTimeBySession.get(e.session_id);
      if (exitInfo && exitInfo.path === e.page_path && exitInfo.time > 0) {
        exitData[e.page_path].totalTime += exitInfo.time;
        exitData[e.page_path].timeEntries++;
      }
    }

    // --- Page traffic ---
    const pageTraffic: Record<string, { views: number; avgTime: number; avgScroll: number; exits: number }> = {};
    for (const e of pageViews) {
      if (!pageTraffic[e.page_path]) pageTraffic[e.page_path] = { views: 0, avgTime: 0, avgScroll: 0, exits: 0 };
      pageTraffic[e.page_path].views++;
    }
    for (const e of pageExits) {
      if (pageTraffic[e.page_path]) {
        if (e.time_on_page_ms) pageTraffic[e.page_path].avgTime += e.time_on_page_ms;
        if (e.scroll_depth) pageTraffic[e.page_path].avgScroll += e.scroll_depth;
        pageTraffic[e.page_path].exits++;
      }
    }
    for (const p of Object.keys(pageTraffic)) {
      const t = pageTraffic[p];
      if (t.exits > 0) {
        t.avgTime = Math.round(t.avgTime / t.exits);
        t.avgScroll = Math.round(t.avgScroll / t.exits);
      }
    }

    // --- Referrer sources ---
    const refCounts: Record<string, number> = {};
    for (const e of firstBySession.values()) {
      const domain = e.referrer ? extractDomain(e.referrer) : 'direct';
      refCounts[domain] = (refCounts[domain] || 0) + 1;
    }

    // --- Flow: page transitions ---
    const sessionPages = new Map<string, string[]>();
    for (const e of pageViews) {
      if (!sessionPages.has(e.session_id)) sessionPages.set(e.session_id, []);
      sessionPages.get(e.session_id)!.push(e.page_path);
    }
    const transitions: Record<string, number> = {};
    for (const pages of sessionPages.values()) {
      for (let i = 0; i < pages.length - 1; i++) {
        const key = `${pages[i]} → ${pages[i + 1]}`;
        transitions[key] = (transitions[key] || 0) + 1;
      }
    }

    // --- Bounce ---
    const bounceSessions = new Set<string>();
    const bounceTimeByPage: Record<string, { total: number; count: number }> = {};
    for (const [sid, pages] of sessionPages.entries()) {
      if (pages.length === 1) {
        bounceSessions.add(sid);
        const entryPath = pages[0];
        if (!bounceTimeByPage[entryPath]) bounceTimeByPage[entryPath] = { total: 0, count: 0 };
        const exitInfo = exitTimeBySession.get(sid);
        if (exitInfo && exitInfo.time > 0) {
          bounceTimeByPage[entryPath].total += exitInfo.time;
          bounceTimeByPage[entryPath].count++;
        }
      }
    }
    const bounceCounts: Record<string, number> = {};
    for (const sid of bounceSessions) {
      const entry = firstBySession.get(sid);
      if (entry) bounceCounts[entry.page_path] = (bounceCounts[entry.page_path] || 0) + 1;
    }

    // --- Device breakdown ---
    const deviceCounts: Record<string, number> = { mobile: 0, tablet: 0, desktop: 0 };
    for (const e of firstBySession.values()) {
      const d = e.device_type || 'desktop';
      deviceCounts[d] = (deviceCounts[d] || 0) + 1;
    }

    // --- UTM breakdown ---
    const utmCounts: Record<string, number> = {};
    for (const e of firstBySession.values()) {
      if (e.utm_source) {
        const key = [e.utm_source, e.utm_medium].filter(Boolean).join(' / ');
        utmCounts[key] = (utmCounts[key] || 0) + 1;
      }
    }

    // --- CTA / Interaction clicks ---
    const ctaCounts: Record<string, { count: number; text: string }> = {};
    for (const e of interactions) {
      const key = e.event_type + '::' + (e.element_text || e.element_text || 'unknown');
      if (!ctaCounts[key]) ctaCounts[key] = { count: 0, text: e.element_text || '' };
      ctaCounts[key].count++;
    }

    // --- Funnel: Landing → Signup → Quiz → Trip Dashboard → Itinerary ---
    const funnelSessions = {
      landing: new Set<string>(),
      signup: new Set<string>(),
      quiz: new Set<string>(),
      tripDashboard: new Set<string>(),
      itinerary: new Set<string>(),
    };
    for (const e of pageViews) {
      if (e.page_path === '/') funnelSessions.landing.add(e.session_id);
      if (e.page_path === '/signup') funnelSessions.signup.add(e.session_id);
      if (e.page_path === '/quiz') funnelSessions.quiz.add(e.session_id);
      if (e.page_path === '/trip/dashboard') funnelSessions.tripDashboard.add(e.session_id);
      if (e.page_path.startsWith('/itinerary/') || e.page_path === '/planner/itinerary') funnelSessions.itinerary.add(e.session_id);
    }

    return {
      totalSessions: sessions.size,
      totalPageViews: pageViews.length,
      authedSessions: authedSessions.size,
      entryCounts,
      exitData,
      pageTraffic,
      refCounts,
      transitions,
      bounceCounts,
      bounceTimeByPage,
      deviceCounts,
      utmCounts,
      ctaCounts,
      funnelSessions,
      totalInteractions: interactions.length,
    };
  }, [events]);

  const sorted = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', color: '#E2E8F0', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => navigate('/profile/settings')} style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <ArrowLeft size={16} /> Back to Settings
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, fontFamily: "'Playfair Display', serif" }}>User Tracking</h1>
            <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>Where users enter, where they leave, and what converts</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid',
                  borderColor: days === d ? '#38BDF8' : '#1E293B',
                  background: days === d ? '#38BDF822' : '#1E293B',
                  color: days === d ? '#38BDF8' : '#94A3B8',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {d === 1 ? 'Today' : `${d}d`}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>Loading events...</p>
        ) : !analytics || analytics.totalSessions === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748B' }}>
            <Eye size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 600 }}>No tracking data yet</p>
            <p style={{ fontSize: 13 }}>Events will appear here as users visit your site</p>
          </div>
        ) : (
          <>
            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Sessions', value: analytics.totalSessions, icon: <Users size={14} />, color: '#38BDF8' },
                { label: 'Page Views', value: analytics.totalPageViews, icon: <Eye size={14} />, color: '#A78BFA' },
                { label: 'Authenticated', value: analytics.authedSessions, icon: <MousePointerClick size={14} />, color: '#34D399' },
                { label: 'Auth Rate', value: `${analytics.totalSessions > 0 ? Math.round((analytics.authedSessions / analytics.totalSessions) * 100) : 0}%`, icon: <TrendingUp size={14} />, color: '#FBBF24' },
              ].map((m, i) => (
                <div key={i} style={{ background: 'rgba(30,41,59,0.7)', borderRadius: 12, padding: '12px 14px', border: `1px solid ${m.color}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <span style={{ color: m.color }}>{m.icon}</span>
                    <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</span>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 800, color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Entry Pages */}
              <Panel title="🚪 Entry Pages" subtitle="Where sessions begin">
                {sorted(analytics.entryCounts).slice(0, 10).map(([path, count]) => {
                  const bounces = analytics.bounceCounts[path] || 0;
                  const bounceRate = Math.round((bounces / count) * 100);
                  const bTime = analytics.bounceTimeByPage[path];
                  const avgBounceTime = bTime && bTime.count > 0 ? formatDuration(bTime.total / bTime.count) : null;
                  return (
                    <Row key={path} label={niceName(path)} sublabel={path} value={count} total={analytics.totalSessions}
                      extra={
                        <span style={{ fontSize: 10, color: bounceRate > 60 ? '#F87171' : '#94A3B8' }}>
                          {bounceRate}% bounce{avgBounceTime ? ` · ${avgBounceTime}` : ''}
                        </span>
                      }
                    />
                  );
                })}
              </Panel>

              {/* Exit Pages — "Experience Killers" */}
              <Panel title="💀 Exit Pages" subtitle="Where users leave · avg time before exit">
                {Object.entries(analytics.exitData)
                  .sort((a, b) => b[1].count - a[1].count)
                  .slice(0, 10)
                  .map(([path, data]) => {
                    const avgTime = data.timeEntries > 0 ? formatDuration(data.totalTime / data.timeEntries) : '-';
                    return (
                      <Row key={path} label={niceName(path)} sublabel={path} value={data.count} total={analytics.totalSessions}
                        extra={
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={10} style={{ color: '#94A3B8' }} />
                            <span style={{ fontSize: 10, color: '#94A3B8' }}>{avgTime}</span>
                          </span>
                        }
                      />
                    );
                  })}
              </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Traffic by Page */}
              <Panel title="📊 Page Traffic" subtitle="Views, time, scroll depth">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>PAGE</span>
                  <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600, textAlign: 'right' }}>VIEWS</span>
                  <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600, textAlign: 'right' }}>AVG TIME</span>
                  <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600, textAlign: 'right' }}>SCROLL</span>
                </div>
                {Object.entries(analytics.pageTraffic)
                  .sort((a, b) => b[1].views - a[1].views)
                  .slice(0, 12)
                  .map(([path, data]) => (
                    <div key={path} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 4, padding: '5px 0', borderBottom: '1px solid #1E293B' }}>
                      <span style={{ fontSize: 12, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{niceName(path)}</span>
                      <span style={{ fontSize: 12, color: '#38BDF8', textAlign: 'right', fontFamily: 'monospace' }}>{data.views}</span>
                      <span style={{ fontSize: 12, color: '#94A3B8', textAlign: 'right', fontFamily: 'monospace' }}>{data.avgTime ? formatDuration(data.avgTime) : '-'}</span>
                      <span style={{ fontSize: 12, color: data.avgScroll > 70 ? '#34D399' : data.avgScroll > 30 ? '#FBBF24' : '#F87171', textAlign: 'right', fontFamily: 'monospace' }}>{data.avgScroll ? `${data.avgScroll}%` : '-'}</span>
                    </div>
                  ))}
              </Panel>

              {/* Top Flows */}
              <Panel title="🔀 Top User Flows" subtitle="Most common page transitions">
                {sorted(analytics.transitions).slice(0, 12).map(([flow, count]) => {
                  const [from, to] = flow.split(' → ');
                  return (
                    <div key={flow} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid #1E293B' }}>
                      <span style={{ fontSize: 11, color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{niceName(from)}</span>
                      <ArrowRight size={12} style={{ color: '#38BDF8', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#E2E8F0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{niceName(to)}</span>
                      <span style={{ fontSize: 11, color: '#38BDF8', fontFamily: 'monospace', flexShrink: 0 }}>{count}</span>
                    </div>
                  );
                })}
              </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Referrer Sources */}
              <Panel title="🌐 Traffic Sources" subtitle="Where users come from">
                {sorted(analytics.refCounts).slice(0, 8).map(([source, count]) => (
                  <Row key={source} label={source} value={count} total={analytics.totalSessions} />
                ))}
              </Panel>

              {/* Device Breakdown */}
              <Panel title="📱 Devices" subtitle="Session device type">
                {sorted(analytics.deviceCounts).map(([device, count]) => (
                  <Row key={device} label={device.charAt(0).toUpperCase() + device.slice(1)} value={count} total={analytics.totalSessions} />
                ))}
              </Panel>

              {/* UTM Campaigns */}
              <Panel title="🎯 UTM Campaigns" subtitle="Tracked campaign traffic">
                {Object.keys(analytics.utmCounts).length === 0 ? (
                  <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', padding: '8px 0' }}>No UTM-tagged traffic yet</p>
                ) : (
                  sorted(analytics.utmCounts).slice(0, 8).map(([campaign, count]) => (
                    <Row key={campaign} label={campaign} value={count} total={analytics.totalSessions} />
                  ))
                )}
              </Panel>
            </div>

            {/* All Pages Stats Table */}
            <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 12, padding: 16, border: '1px solid #1E293B' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px', color: '#E2E8F0' }}>📋 All Pages Overview</h3>
              <p style={{ fontSize: 10, color: '#64748B', margin: '0 0 12px' }}>Complete stats for every page on the site</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #1E293B' }}>
                      {['Page', 'Views', 'Entries', 'Exits', 'Bounces', 'Bounce %', 'Avg Time', 'Avg Scroll', 'Exit %'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Page' ? 'left' : 'right', fontSize: 9, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Include all known site pages + any pages with recorded data
                      const allPaths = new Set([
                        ...Object.keys(ALL_SITE_PAGES),
                        ...Object.keys(analytics.pageTraffic),
                        ...Object.keys(analytics.entryCounts),
                        ...Object.keys(analytics.exitData),
                        ...Object.keys(analytics.bounceCounts),
                      ]);
                      return Array.from(allPaths)
                        .map(path => {
                          const traffic = analytics.pageTraffic[path] || { views: 0, avgTime: 0, avgScroll: 0, exits: 0 };
                          const entries = analytics.entryCounts[path] || 0;
                          const exitInfo = analytics.exitData[path] || { count: 0, totalTime: 0, timeEntries: 0 };
                          const bounces = analytics.bounceCounts[path] || 0;
                          const bounceRate = entries > 0 ? Math.round((bounces / entries) * 100) : 0;
                          const exitRate = traffic.views > 0 ? Math.round((exitInfo.count / traffic.views) * 100) : 0;
                          return { path, views: traffic.views, entries, exits: exitInfo.count, bounces, bounceRate, avgTime: traffic.avgTime, avgScroll: traffic.avgScroll, exitRate };
                        })
                        .sort((a, b) => b.views - a.views)
                        .map(row => (
                          <tr key={row.path} style={{ borderBottom: '1px solid #1E293B' }}>
                            <td style={{ padding: '7px 10px', color: '#E2E8F0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span>{niceName(row.path)}</span>
                              <span style={{ display: 'block', fontSize: 9, color: '#475569' }}>{row.path}</span>
                            </td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#38BDF8', fontFamily: 'monospace' }}>{row.views}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#A78BFA', fontFamily: 'monospace' }}>{row.entries}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#F87171', fontFamily: 'monospace' }}>{row.exits}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#94A3B8', fontFamily: 'monospace' }}>{row.bounces}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: row.bounceRate > 60 ? '#F87171' : row.bounceRate > 30 ? '#FBBF24' : '#34D399', fontFamily: 'monospace' }}>{row.bounceRate}%</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#94A3B8', fontFamily: 'monospace' }}>{row.avgTime ? formatDuration(row.avgTime) : '-'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: row.avgScroll > 70 ? '#34D399' : row.avgScroll > 30 ? '#FBBF24' : '#F87171', fontFamily: 'monospace' }}>{row.avgScroll ? `${row.avgScroll}%` : '-'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: row.exitRate > 50 ? '#F87171' : '#94A3B8', fontFamily: 'monospace' }}>{row.exitRate}%</td>
                          </tr>
                        ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Reusable sub-components ---

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 12, padding: 16, border: '1px solid #1E293B' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px', color: '#E2E8F0' }}>{title}</h3>
      <p style={{ fontSize: 10, color: '#64748B', margin: '0 0 10px' }}>{subtitle}</p>
      {children}
    </div>
  );
}

function Row({ label, sublabel, value, total, extra }: { label: string; sublabel?: string; value: number; total: number; extra?: React.ReactNode }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #1E293B' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 9, color: '#475569' }}>{sublabel}</div>}
      </div>
      {extra}
      <div style={{ width: 50, height: 4, borderRadius: 2, background: '#1E293B', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: '#38BDF8' }} />
      </div>
      <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#38BDF8', minWidth: 28, textAlign: 'right' }}>{value}</span>
      <span style={{ fontSize: 10, color: '#64748B', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}
