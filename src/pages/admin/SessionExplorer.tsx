import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Search, Clock, AlertTriangle, Eye, MousePointerClick, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

type TimelineEvent = {
  id: string;
  session_id: string;
  event_type: string;
  page_path: string;
  element_id: string | null;
  element_text: string | null;
  scroll_depth: number | null;
  time_on_page_ms: number | null;
  created_at: string;
  event_data: Record<string, unknown> | null;
};

type ClientError = {
  id: string;
  session_id: string;
  error_message: string;
  stack_trace: string | null;
  page_path: string | null;
  created_at: string;
};

function formatMs(ms: number): string {
  if (ms < 1000) return '<1s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const eventIcon = (type: string) => {
  switch (type) {
    case 'page_view': return <Eye size={14} style={{ color: '#38BDF8' }} />;
    case 'page_exit': return <LogOut size={14} style={{ color: '#F87171' }} />;
    case 'error': return <AlertTriangle size={14} style={{ color: '#FBBF24' }} />;
    default: return <MousePointerClick size={14} style={{ color: '#A78BFA' }} />;
  }
};

export default function SessionExplorer() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  // Search sessions by user email or user_id
  const { data: sessions = [], isLoading: searching } = useQuery({
    queryKey: ['session-search', search],
    queryFn: async () => {
      if (!search.trim()) return [];
      
      // First try to find user_id by email
      let userId = search.trim();
      if (search.includes('@')) {
        const { data } = await supabase.rpc('get_user_id_by_email', { lookup_email: search.trim() });
        if (data) userId = data;
        else return [];
      }

      const { data, error } = await supabase
        .from('page_events')
        .select('session_id, user_id, created_at, page_path, event_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5000);
      
      if (error) throw error;
      
      // Group by session
      const sessionMap = new Map<string, { firstSeen: string; lastSeen: string; pageCount: number; pages: string[] }>();
      for (const e of (data || [])) {
        const existing = sessionMap.get(e.session_id);
        if (!existing) {
          sessionMap.set(e.session_id, { firstSeen: e.created_at, lastSeen: e.created_at, pageCount: 1, pages: [e.page_path] });
        } else {
          existing.lastSeen = e.created_at;
          existing.pageCount++;
          if (e.event_type === 'page_view' && !existing.pages.includes(e.page_path)) {
            existing.pages.push(e.page_path);
          }
        }
      }
      
      return Array.from(sessionMap.entries())
        .map(([id, info]) => ({ id, ...info }))
        .sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime())
        .slice(0, 50);
    },
    enabled: search.length > 3,
  });

  // Get timeline for selected session
  const { data: timeline = [], isLoading: loadingTimeline } = useQuery({
    queryKey: ['session-timeline', selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      
      // Get page events
      const { data: events } = await supabase
        .from('page_events')
        .select('id, session_id, event_type, page_path, element_id, element_text, scroll_depth, time_on_page_ms, created_at, event_data')
        .eq('session_id', selectedSession)
        .order('created_at', { ascending: true })
        .limit(1000);
      
      // Get client errors for this session
      const { data: errors } = await supabase
        .from('client_errors')
        .select('id, session_id, error_message, stack_trace, page_path, created_at')
        .eq('session_id', selectedSession)
        .order('created_at', { ascending: true });

      const combined: Array<TimelineEvent | (ClientError & { event_type: 'error' })> = [
        ...(events || []).map((e: any) => ({ ...e } as TimelineEvent)),
        ...(errors || []).map((e: any) => ({ ...e, event_type: 'error' as const })),
      ];

      combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return combined;
    },
    enabled: !!selectedSession,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', color: '#E2E8F0', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => navigate('/admin/user-tracking')} style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <ArrowLeft size={16} /> Back to User Tracking
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', fontFamily: "'Playfair Display', serif" }}>Session Explorer</h1>
        <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 20px' }}>Search by user email or ID to see their exact journey</p>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedSession(null); }}
              placeholder="Enter user email or user_id..."
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1px solid #1E293B', background: '#1E293B', color: '#E2E8F0', fontSize: 14, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedSession ? '300px 1fr' : '1fr', gap: 16 }}>
          {/* Sessions list */}
          <div>
            {searching && <p style={{ color: '#64748B', fontSize: 13 }}>Searching...</p>}
            {!searching && search.length > 3 && sessions.length === 0 && (
              <p style={{ color: '#64748B', fontSize: 13 }}>No sessions found for this user</p>
            )}
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSession(s.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6,
                  borderRadius: 10, border: '1px solid', cursor: 'pointer',
                  borderColor: selectedSession === s.id ? '#38BDF8' : '#1E293B',
                  background: selectedSession === s.id ? '#38BDF811' : '#1E293B55',
                  color: '#E2E8F0',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{format(new Date(s.firstSeen), 'MMM d, yyyy h:mm a')}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{s.pageCount} events · {s.pages.length} pages</div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.pages.slice(0, 4).join(' → ')}{s.pages.length > 4 ? '...' : ''}
                </div>
              </button>
            ))}
          </div>

          {/* Timeline */}
          {selectedSession && (
            <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 12, padding: 16, border: '1px solid #1E293B' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Session Timeline</h3>
              {loadingTimeline && <p style={{ color: '#64748B', fontSize: 13 }}>Loading...</p>}
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                <div style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 2, background: '#1E293B' }} />
                {timeline.map((event, i) => (
                  <div key={event.id} style={{ position: 'relative', paddingBottom: 12, paddingLeft: 16 }}>
                    <div style={{ position: 'absolute', left: -18, top: 2, width: 20, height: 20, borderRadius: '50%', background: '#0B1120', border: '2px solid #1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {eventIcon(event.event_type)}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>
                      {format(new Date(event.created_at), 'h:mm:ss a')}
                    </div>
                    <div style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 600 }}>
                      {event.event_type === 'error' 
                        ? `❌ ${(event as any).error_message?.slice(0, 100)}`
                        : event.event_type === 'page_view'
                        ? `Viewed ${event.page_path}`
                        : event.event_type === 'page_exit'
                        ? `Left ${event.page_path}`
                        : `${event.event_type}: ${(event as TimelineEvent).element_text || (event as TimelineEvent).element_id || event.page_path}`
                      }
                    </div>
                    {event.event_type === 'page_exit' && (event as TimelineEvent).time_on_page_ms && (
                      <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Clock size={10} /> {formatMs((event as TimelineEvent).time_on_page_ms!)}
                        {(event as TimelineEvent).scroll_depth != null && ` · ${(event as TimelineEvent).scroll_depth}% scrolled`}
                      </div>
                    )}
                    {event.event_type === 'error' && (event as any).stack_trace && (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ fontSize: 10, color: '#FBBF24', cursor: 'pointer' }}>Stack trace</summary>
                        <pre style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflow: 'auto', background: '#0B1120', padding: 8, borderRadius: 6, marginTop: 4 }}>
                          {(event as any).stack_trace}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
