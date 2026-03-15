type FunnelStep = {
  label: string;
  count: number;
};

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length) return null;
  const max = steps[0].count;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((step, i) => {
        const pct = max > 0 ? Math.round((step.count / max) * 100) : 0;
        const dropoff = i > 0 && steps[i - 1].count > 0
          ? Math.round(((steps[i - 1].count - step.count) / steps[i - 1].count) * 100)
          : 0;

        return (
          <div key={step.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 600 }}>{step.label}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                {i > 0 && dropoff > 0 && (
                  <span style={{ fontSize: 10, color: '#F87171' }}>-{dropoff}%</span>
                )}
                <span style={{ fontSize: 12, color: '#38BDF8', fontFamily: 'monospace' }}>{step.count}</span>
              </div>
            </div>
            <div style={{ width: '100%', height: 8, borderRadius: 4, background: '#1E293B' }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 4,
                background: `linear-gradient(90deg, #38BDF8, ${i === 0 ? '#38BDF8' : i === steps.length - 1 ? '#34D399' : '#A78BFA'})`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
