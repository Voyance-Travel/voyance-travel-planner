/**
 * Admin Unit Economics Dashboard - Verified Production Data
 * Built from actual billing data: Google Cloud, Lovable, Perplexity, Amadeus
 * Last Updated: February 4, 2026
 */

import { useState, useMemo } from "react";

// =============================================================================
// VERIFIED PRODUCTION DATA (Feb 4, 2026)
// Source: Google Cloud Console, Lovable Cloud, Perplexity API, Amadeus Docs
// =============================================================================

const VERIFIED_DATA = {
  trips: 61,
  period: "Jan 25 – Feb 4, 2026",
  services: {
    google: { total: 30.82, perTrip: 0.5052, calls: null, callsPerTrip: 55, label: "Google Places", color: "#4285F4" },
    lovableAI: { total: 3.93, perTrip: 0.0644, perCall: 0.013, calls: 303, callsPerTrip: 4.97, label: "Lovable AI (Gemini)", color: "#A855F7" },
    perplexity: { total: 1.10, perTrip: 0.0180, perCall: 0.005, calls: 208, callsPerTrip: 3.41, label: "Perplexity (Sonar)", color: "#06B6D4" },
    amadeus: { total: 0, perTrip: 0, perCall: 0.024, calls: 0, callsPerTrip: 5, label: "Amadeus Hotels", color: "#F59E0B" },
  },
  fixed: {
    lovableCloud: 25.00,
    domain: 4.08,
    email: 0.00, // Zoho free tier
  },
  revenue: { single: 29, explorer: 35, voyager: 45 } as Record<string, number>,
};

// Amadeus: 1 hotel list + 4 offer batches (~200 hotels) = 5 calls
const AMADEUS_CALLS_PER_TRIP = 5;
const AMADEUS_COST_PER_CALL = 0.024;
const AMADEUS_FREE_MONTHLY = 2000; // per endpoint
const AMADEUS_FREE_TRIPS = Math.floor(AMADEUS_FREE_MONTHLY / AMADEUS_CALLS_PER_TRIP); // 400 trips

const PHOTO_CACHE_SAVINGS_RATIO = 0.33; // Estimated, not yet verified post-deployment

// AI Model breakdown (7-day production data)
const AI_MODELS = [
  { model: "gemini-3-flash-preview", calls: 125, usage: "Primary generation" },
  { model: "gemini-2.5-flash-image", calls: 92, usage: "Image-related tasks" },
  { model: "gemini-2.5-flash-lite", calls: 75, usage: "Lightweight tasks" },
  { model: "gemini-2.5-flash", calls: 11, usage: "Fallback" },
];

// Free tier thresholds
const FREE_TIERS = {
  googleTextSearch: { free: 5000, price: 0.032, callsPerTrip: 18 },
  googleDetails: { free: 5000, price: 0.020, callsPerTrip: 28 },
  googleGeocoding: { free: 10000, price: 0.005, callsPerTrip: 5 },
  googlePhotos: { free: 10000, price: 0.007, callsPerTrip: 15 },
  lovableAI: { free: 1.00, perTrip: 0.0644 }, // ~15 trips/mo
  amadeus: { free: 2000, callsPerTrip: 5 }, // 400 trips/mo
};

type Scenario = 'A' | 'B' | 'C' | 'D';

const SCENARIOS: Record<Scenario, { name: string; description: string; caching: boolean; amadeus: boolean; amadeusWithinFree: boolean }> = {
  A: { name: "Current Production", description: "Pre-cache, no Amadeus", caching: false, amadeus: false, amadeusWithinFree: true },
  B: { name: "Post Photo-Cache", description: "With caching, no Amadeus", caching: true, amadeus: false, amadeusWithinFree: true },
  C: { name: "Cache + Amadeus (Free)", description: "Within Amadeus free tier", caching: true, amadeus: true, amadeusWithinFree: true },
  D: { name: "Cache + Amadeus (Paid)", description: "Beyond 400 trips/mo", caching: true, amadeus: true, amadeusWithinFree: false },
};

export default function UnitEconomics() {
  const [volume, setVolume] = useState(61);
  const [tier, setTier] = useState("explorer");
  const [scenario, setScenario] = useState<Scenario>('A');

  const revenue = VERIFIED_DATA.revenue[tier];
  const scenarioConfig = SCENARIOS[scenario];

  const costs = useMemo(() => {
    const googleBase = VERIFIED_DATA.services.google.perTrip;
    const googlePerTrip = scenarioConfig.caching ? googleBase * (1 - PHOTO_CACHE_SAVINGS_RATIO) : googleBase;

    const aiPerTrip = VERIFIED_DATA.services.lovableAI.perTrip;
    const perplexityPerTrip = VERIFIED_DATA.services.perplexity.perTrip;

    // Amadeus: $0 within free tier (400 trips), $0.12/trip beyond
    let amadeusPerTrip = 0;
    if (scenarioConfig.amadeus) {
      if (scenarioConfig.amadeusWithinFree || volume <= AMADEUS_FREE_TRIPS) {
        amadeusPerTrip = 0;
      } else {
        // Beyond free tier: pay for all calls
        amadeusPerTrip = AMADEUS_CALLS_PER_TRIP * AMADEUS_COST_PER_CALL; // $0.12
      }
    }

    const variablePerTrip = googlePerTrip + aiPerTrip + perplexityPerTrip + amadeusPerTrip;
    const variableTotal = variablePerTrip * volume;

    const fixedTotal = VERIFIED_DATA.fixed.lovableCloud + VERIFIED_DATA.fixed.domain;
    const fixedPerTrip = fixedTotal / volume;

    const fullyLoaded = variablePerTrip + fixedPerTrip;
    const margin = ((revenue - fullyLoaded) / revenue) * 100;
    const contributionMargin = ((revenue - variablePerTrip) / revenue) * 100;

    const googleShare = variablePerTrip > 0 ? (googlePerTrip / variablePerTrip) * 100 : 0;

    return {
      google: { perTrip: googlePerTrip, total: googlePerTrip * volume, share: googleShare },
      ai: { perTrip: aiPerTrip, total: aiPerTrip * volume },
      perplexity: { perTrip: perplexityPerTrip, total: perplexityPerTrip * volume },
      amadeus: { perTrip: amadeusPerTrip, total: amadeusPerTrip * volume },
      variable: { perTrip: variablePerTrip, total: variableTotal },
      fixed: { perTrip: fixedPerTrip, total: fixedTotal },
      fullyLoaded,
      margin,
      contributionMargin,
    };
  }, [volume, tier, scenario, scenarioConfig, revenue]);

  const verifiedMargins = useMemo(() => {
    return Object.entries(VERIFIED_DATA.revenue).map(([key, rev]) => {
      const cost = costs.fullyLoaded;
      return { tier: key, revenue: rev, cost, margin: ((rev - cost) / rev * 100), profit: rev - cost };
    });
  }, [costs.fullyLoaded]);

  // Scale points matching the reference doc
  const scalePoints = [10, 50, 100, 250, 400, 500, 750, 1000];

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: "#F1F5F9",
      padding: "32px 24px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ maxWidth: 1400, margin: "0 auto 40px" }}>
        <div style={{ 
          background: "rgba(30, 41, 59, 0.6)",
          borderRadius: 16,
          padding: "28px 36px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34D399" }} />
                <span style={{ fontSize: 13, color: "#94A3B8", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Voyance · Verified Unit Economics
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 0", letterSpacing: "-0.02em" }}>
                Cost Per Trip Analysis
              </h1>
              <p style={{ fontSize: 14, color: "#64748B", marginTop: 6 }}>
                Built from production billing data · {VERIFIED_DATA.trips} trips · {VERIFIED_DATA.period}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#34D399", fontWeight: 600, marginBottom: 4 }}>
                All Sources Verified
              </div>
              <div style={{ fontSize: 11, color: "#64748B" }}>
                Google Cloud · Lovable · Perplexity · Amadeus
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Hero Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Variable Cost / Trip", value: `$${costs.variable.perTrip.toFixed(4)}`, sub: `Scenario ${scenario}: ${scenarioConfig.name}`, accent: "#63B3AA" },
            { label: "Fully-Loaded / Trip", value: `$${costs.fullyLoaded.toFixed(2)}`, sub: `At ${volume} trips/mo`, accent: "#A78BFA" },
            { label: "Gross Margin", value: `${costs.margin.toFixed(1)}%`, sub: `${tier.charAt(0).toUpperCase() + tier.slice(1)} tier · $${revenue}`, accent: costs.margin > 97 ? "#34D399" : costs.margin > 95 ? "#FBBF24" : "#F87171" },
            { label: "Contribution Margin", value: `${costs.contributionMargin.toFixed(1)}%`, sub: "Variable costs only", accent: "#38BDF8" },
          ].map((m, i) => (
            <div key={i} style={{
              background: "rgba(30, 41, 59, 0.5)",
              borderRadius: 12,
              padding: "24px 28px",
              border: "1px solid rgba(100, 116, 139, 0.2)",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: m.accent }} />
              <p style={{ fontSize: 12, color: "#64748B", marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {m.label}
              </p>
              <p style={{ fontSize: 32, fontWeight: 700, color: m.accent, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                {m.value}
              </p>
              <p style={{ fontSize: 12, color: "#94A3B8" }}>{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr", 
          gap: 16, 
          marginBottom: 32,
        }}>
          {/* Volume Slider */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "24px 28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>Monthly Volume</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#63B3AA", fontFamily: "'JetBrains Mono', monospace" }}>{volume} trips</span>
            </div>
            <input
              type="range"
              min="1"
              max="1000"
              value={volume}
              onChange={(e) => setVolume(+e.target.value)}
              style={{ width: "100%", accentColor: "#63B3AA", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 8 }}>
              <span>1</span><span>250</span><span>400</span><span>500</span><span>1,000</span>
            </div>
            {volume > AMADEUS_FREE_TRIPS && scenarioConfig.amadeus && (
              <p style={{ fontSize: 10, color: "#F59E0B", marginTop: 8 }}>
                ⚠️ Beyond Amadeus free tier ({AMADEUS_FREE_TRIPS} trips)
              </p>
            )}
          </div>

          {/* Scenario & Tier */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "24px 28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <p style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500, marginBottom: 12 }}>Scenario & Pricing Tier</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setScenario(key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: scenario === key ? "1px solid #A78BFA" : "1px solid rgba(100,116,139,0.3)",
                    background: scenario === key ? "rgba(167, 139, 250, 0.15)" : "transparent",
                    color: scenario === key ? "#A78BFA" : "#64748B",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {key}: {SCENARIOS[key].name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(VERIFIED_DATA.revenue).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setTier(key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: tier === key ? "1px solid #63B3AA" : "1px solid rgba(100,116,139,0.3)",
                    background: tier === key ? "rgba(99, 179, 170, 0.15)" : "transparent",
                    color: tier === key ? "#63B3AA" : "#64748B",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)} · ${val}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10, color: "#64748B", marginTop: 10 }}>
              {scenarioConfig.description}
            </p>
          </div>
        </div>

        {/* Two column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>

          {/* Cost Breakdown */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
              Variable Cost Breakdown · Scenario {scenario}
            </h3>

            {[
              { label: "Google Places", cost: costs.google.perTrip, color: "#4285F4", verified: scenario === 'A', note: scenarioConfig.caching ? "Post-cache estimate (-33%)" : "Verified: $30.82 ÷ 61 trips" },
              { label: "Lovable AI (Gemini)", cost: costs.ai.perTrip, color: "#A855F7", verified: true, note: `${VERIFIED_DATA.services.lovableAI.calls} calls ÷ ${VERIFIED_DATA.trips} trips = ${VERIFIED_DATA.services.lovableAI.callsPerTrip} calls/trip` },
              { label: "Perplexity (Sonar)", cost: costs.perplexity.perTrip, color: "#06B6D4", verified: true, note: `${VERIFIED_DATA.services.perplexity.calls} calls × $${VERIFIED_DATA.services.perplexity.perCall}/call` },
              { label: "Amadeus Hotels", cost: costs.amadeus.perTrip, color: "#F59E0B", verified: false, note: scenarioConfig.amadeus ? (volume <= AMADEUS_FREE_TRIPS || scenarioConfig.amadeusWithinFree ? `Free tier (${AMADEUS_FREE_TRIPS} trips/mo)` : `${AMADEUS_CALLS_PER_TRIP} calls × $${AMADEUS_COST_PER_CALL} = $0.12/trip`) : "Not active" },
            ].map((item, i) => {
              const maxCost = Math.max(costs.google.perTrip, costs.ai.perTrip, costs.perplexity.perTrip, costs.amadeus.perTrip, 0.01);
              const barWidth = (item.cost / maxCost) * 100;
              return (
                <div key={i} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
                      <span style={{ fontSize: 13, color: "#CBD5E1" }}>{item.label}</span>
                      {item.verified && (
                        <span style={{ fontSize: 9, background: "rgba(52, 211, 153, 0.15)", color: "#34D399", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>VERIFIED</span>
                      )}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", fontFamily: "'JetBrains Mono', monospace" }}>
                      ${item.cost.toFixed(4)}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "rgba(30, 41, 59, 0.8)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${barWidth}%`, background: item.color, borderRadius: 3, transition: "width 0.3s ease" }} />
                  </div>
                  <p style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>{item.note}</p>
                </div>
              );
            })}

            <div style={{ borderTop: "1px solid rgba(100, 116, 139, 0.2)", paddingTop: 16, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>Total Variable</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#63B3AA", fontFamily: "'JetBrains Mono', monospace" }}>
                  ${costs.variable.perTrip.toFixed(4)}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                Google = {costs.google.share.toFixed(0)}% of variable cost
              </p>
            </div>
          </div>

          {/* Margin by Tier */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 24 }}>
              Margin By Pricing Tier · {volume} trips/mo
            </h3>

            {verifiedMargins.map((m, i) => {
              const barColor = m.margin > 97 ? "#34D399" : m.margin > 95 ? "#FBBF24" : "#F87171";
              const isActive = m.tier === tier;
              return (
                <div key={i} style={{
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 8,
                  background: isActive ? "rgba(99, 179, 170, 0.08)" : "rgba(15, 23, 42, 0.4)",
                  border: isActive ? "1px solid rgba(99, 179, 170, 0.3)" : "1px solid rgba(100, 116, 139, 0.15)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }} onClick={() => setTier(m.tier)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", textTransform: "capitalize" }}>{m.tier}</span>
                      <span style={{ fontSize: 12, color: "#64748B", marginLeft: 8 }}>${m.revenue}/trip</span>
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 700, color: barColor, fontFamily: "'JetBrains Mono', monospace" }}>
                      {m.margin.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: "rgba(30, 41, 59, 0.8)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${m.margin}%`, background: barColor, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#64748B" }}>
                    <span>Revenue: ${m.revenue.toFixed(2)}</span>
                    <span>Cost: ${m.cost.toFixed(2)}</span>
                    <span style={{ color: "#34D399" }}>Profit: ${m.profit.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}

            {/* Fixed cost detail */}
            <div style={{ marginTop: 20, padding: 16, background: "rgba(15, 23, 42, 0.5)", borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500, marginBottom: 8 }}>
                Fixed Costs · $29.08/mo
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 4 }}>
                <span>Lovable Cloud</span>
                <span>$25.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 4 }}>
                <span>Domain</span>
                <span>$4.08</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 4 }}>
                <span>Email (Zoho)</span>
                <span>$0.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94A3B8", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(100, 116, 139, 0.2)" }}>
                <span>Per-trip allocation at {volume}/mo</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>${costs.fixed.perTrip.toFixed(3)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scale Economics Table */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
          overflowX: "auto",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            Economics At Scale · {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier (${revenue}) · Scenario D
          </h3>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Trips/Mo", "Google", "AI", "Perplexity", "Amadeus", "Variable", "Fixed/Trip", "Loaded", "Margin", "Monthly Rev", "Monthly Profit"].map(h => (
                  <th key={h} style={{ 
                    textAlign: "right", 
                    padding: "10px 10px", 
                    color: "#64748B", 
                    fontWeight: 500, 
                    borderBottom: "1px solid rgba(100, 116, 139, 0.3)",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scalePoints.map((vol) => {
                const goog = VERIFIED_DATA.services.google.perTrip * (1 - PHOTO_CACHE_SAVINGS_RATIO); // Scenario D uses caching
                const ai = VERIFIED_DATA.services.lovableAI.perTrip;
                const perp = VERIFIED_DATA.services.perplexity.perTrip;
                // Amadeus: free under 400, $0.12/trip after
                const amad = vol > AMADEUS_FREE_TRIPS ? AMADEUS_CALLS_PER_TRIP * AMADEUS_COST_PER_CALL : 0;
                const variable = goog + ai + perp + amad;
                const fixedPer = 29.08 / vol;
                const loaded = variable + fixedPer;
                const margin = ((revenue - loaded) / revenue * 100);
                const monthlyRev = vol * revenue;
                const monthlyProfit = vol * (revenue - loaded);

                const isHighlight = vol === 100 || vol === 500;
                const isAmadeusThreshold = vol === 400;
                return (
                  <tr key={vol} style={{ 
                    background: isAmadeusThreshold ? "rgba(245, 158, 11, 0.08)" : isHighlight ? "rgba(99, 179, 170, 0.08)" : "transparent" 
                  }}>
                    {[
                      vol.toLocaleString() + (isAmadeusThreshold ? " ⚠️" : ""),
                      `$${goog.toFixed(3)}`,
                      `$${ai.toFixed(3)}`,
                      `$${perp.toFixed(3)}`,
                      `$${amad.toFixed(3)}`,
                      `$${variable.toFixed(3)}`,
                      `$${fixedPer.toFixed(3)}`,
                      `$${loaded.toFixed(2)}`,
                      `${margin.toFixed(1)}%`,
                      `$${monthlyRev.toLocaleString()}`,
                      `$${monthlyProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    ].map((cell, j) => (
                      <td key={j} style={{
                        color: j === 4 && amad > 0 ? "#F59E0B" : j === 8 ? (margin > 97 ? "#34D399" : margin > 95 ? "#FBBF24" : "#CBD5E1") : j === 10 ? "#34D399" : "#CBD5E1",
                        padding: "10px 10px",
                        textAlign: "right",
                        borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                        fontWeight: j === 8 || j === 10 ? 600 : 400,
                        fontFamily: j > 0 ? "'JetBrains Mono', monospace" : "inherit",
                      }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 10, color: "#64748B", marginTop: 12 }}>
            ⚠️ Amadeus free tier ends at 400 trips/mo. Beyond this, adds $0.12/trip.
          </p>
        </div>

        {/* Monthly Expense Projections */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
          overflowX: "auto",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            Monthly Expense Projections · Scenario D
          </h3>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Trips/Mo", "Google", "Lovable (fixed)", "Lovable AI", "Perplexity", "Amadeus", "Domain", "Total"].map(h => (
                  <th key={h} style={{ 
                    textAlign: "right", 
                    padding: "10px 10px", 
                    color: "#64748B", 
                    fontWeight: 500, 
                    borderBottom: "1px solid rgba(100, 116, 139, 0.3)",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[50, 100, 250, 500, 1000].map((vol) => {
                const google = 0.3385 * vol;
                const lovableFixed = 25.00;
                const lovableAI = 0.0644 * vol;
                const perplexity = 0.018 * vol;
                const amadeus = vol > AMADEUS_FREE_TRIPS ? (vol - AMADEUS_FREE_TRIPS) * 0.12 : 0;
                const domain = 4.08;
                const total = google + lovableFixed + lovableAI + perplexity + amadeus + domain;

                return (
                  <tr key={vol}>
                    {[
                      vol.toLocaleString(),
                      `$${google.toFixed(2)}`,
                      `$${lovableFixed.toFixed(2)}`,
                      `$${lovableAI.toFixed(2)}`,
                      `$${perplexity.toFixed(2)}`,
                      `$${amadeus.toFixed(2)}`,
                      `$${domain.toFixed(2)}`,
                      `$${total.toFixed(2)}`,
                    ].map((cell, j) => (
                      <td key={j} style={{
                        color: j === 7 ? "#F87171" : "#CBD5E1",
                        padding: "10px 10px",
                        textAlign: "right",
                        borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                        fontWeight: j === 7 ? 600 : 400,
                        fontFamily: j > 0 ? "'JetBrains Mono', monospace" : "inherit",
                      }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Verified Source Data */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            Source Data · Raw Billing Verification
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {[
              {
                source: "Google Cloud Console",
                icon: "☁️",
                data: [
                  { k: "Project", v: "voyance-462423" },
                  { k: "Service", v: "Places API (New)" },
                  { k: "YTD Billed", v: "$30.82" },
                  { k: "SKUs Active", v: "7" },
                  { k: "Free Tiers", v: "EXCEEDED" },
                  { k: "Charges Since", v: "Jan 25, 2026" },
                ],
                color: "#4285F4",
              },
              {
                source: "Lovable Cloud",
                icon: "🧡",
                data: [
                  { k: "Cloud Usage", v: "$0.89 / $25.00" },
                  { k: "AI Usage", v: "$3.93 ($1 free + $2.93)" },
                  { k: "Top-up Balance", v: "$37.00 remaining" },
                  { k: "Total Requests", v: "303" },
                  { k: "Models", v: "4 (all Gemini Flash)" },
                  { k: "⚠️ Pricing", v: "Temporary until 2026" },
                ],
                color: "#A855F7",
              },
              {
                source: "Perplexity API",
                icon: "🔍",
                data: [
                  { k: "Model", v: "sonar (s4qP)" },
                  { k: "API Requests", v: "208" },
                  { k: "Request Cost", v: "$1.04" },
                  { k: "Token Cost", v: "~$0.04" },
                  { k: "Budget Loaded", v: "$5.00" },
                  { k: "Remaining", v: "~$3.90" },
                ],
                color: "#06B6D4",
              },
              {
                source: "Amadeus Self-Service",
                icon: "✈️",
                data: [
                  { k: "Status", v: "Configured (not live)" },
                  { k: "Endpoints", v: "Hotel List + Offers" },
                  { k: "Price/Call", v: "$0.024" },
                  { k: "Calls/Trip", v: "5 (1 list + 4 batches)" },
                  { k: "Cost/Trip", v: "$0.12 (beyond free)" },
                  { k: "Free Tier", v: "2,000/mo = 400 trips" },
                ],
                color: "#F59E0B",
              },
            ].map((src, i) => (
              <div key={i} style={{
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: 8,
                padding: 16,
                borderLeft: `3px solid ${src.color}`,
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0", marginBottom: 12 }}>
                  {src.icon} {src.source}
                </p>
                {src.data.map((d, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                    <span style={{ color: d.k.startsWith("⚠️") ? "#F59E0B" : "#64748B" }}>{d.k}</span>
                    <span style={{ color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{d.v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* AI Models in Production */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            AI Models in Production · NOT GPT-5, NOT Claude
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {AI_MODELS.map((m, i) => (
              <div key={i} style={{
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: 8,
                padding: 14,
                borderLeft: "3px solid #A855F7",
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0", marginBottom: 4 }}>
                  {m.model}
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#A855F7", fontFamily: "'JetBrains Mono', monospace" }}>
                  {m.calls} calls
                </p>
                <p style={{ fontSize: 10, color: "#64748B" }}>{m.usage}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#64748B", marginTop: 16, padding: 12, background: "rgba(248, 113, 113, 0.1)", borderRadius: 6, borderLeft: "3px solid #F87171" }}>
            <strong style={{ color: "#F87171" }}>CORRECTED:</strong> Production runs Gemini Flash variants, not GPT-5/GPT-5-mini. Previous internal docs were wrong. Real AI cost is 3-10× lower than documented estimates.
          </p>
        </div>

        {/* Key Findings */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            Key Findings & Caveats
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 16 }}>
            {[
              { title: "AI is a rounding error", body: "Lovable AI + Perplexity combined = $0.082/trip. At $35 revenue, AI is 0.23% of revenue. Model selection barely matters for margins.", tag: "VERIFIED", tagColor: "#34D399" },
              { title: "Google Places is 63-86% of variable cost", body: "$0.505/trip pre-caching. Photo caching deployed but not yet measured — 33% reduction is estimated, not verified.", tag: "CRITICAL", tagColor: "#F87171" },
              { title: "AI cost includes non-trip overhead", body: "The $0.064/trip includes quiz, explore, homepage preview — not just itinerary generation. Marginal cost of one more trip is lower.", tag: "NOTE", tagColor: "#38BDF8" },
              { title: "Amadeus adds $0.12/trip beyond 400/mo", body: "5 calls × $0.024/call. Free tier covers 400 trips/month. Step change visible in economics at scale table.", tag: "PROJECTED", tagColor: "#F59E0B" },
              { title: "Google free tiers already exceeded", body: "As of Jan 25, 2026, Google Places free tiers are exhausted. All usage now billable. Need SKU breakdown to optimize.", tag: "ACTION", tagColor: "#FBBF24" },
              { title: "Lovable pricing is temporary", body: "Billing page states pricing model being refined through early 2026. Current margins depend partly on a structure the vendor may change.", tag: "RISK", tagColor: "#F87171" },
            ].map((f, i) => (
              <div key={i} style={{
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: 8,
                padding: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 9, background: `${f.tagColor}20`, color: f.tagColor, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{f.tag}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>{f.title}</span>
                </div>
                <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What to Track */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            What to Track Going Forward
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            {[
              { metric: "Google Places spend", where: "console.cloud.google.com/billing", freq: "Weekly" },
              { metric: "Google SKU breakdown", where: "Cloud Console → Cost breakdown", freq: "Weekly" },
              { metric: "Lovable AI spend", where: "Lovable → Cloud & AI balance", freq: "Weekly" },
              { metric: "Perplexity balance", where: "perplexity.ai/account/api/billing", freq: "Monthly" },
              { metric: "Amadeus calls (when live)", where: "developers.amadeus.com dashboard", freq: "Weekly" },
              { metric: "Photo cache hit rate", where: "curated_images + storage bucket", freq: "Weekly" },
              { metric: "Cost per trip (actual)", where: "Total spend ÷ trips", freq: "Weekly" },
            ].map((item, i) => (
              <div key={i} style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                padding: "10px 14px",
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: 6,
                fontSize: 11,
              }}>
                <span style={{ color: "#E2E8F0", fontWeight: 500 }}>{item.metric}</span>
                <span style={{ color: "#64748B", fontSize: 10 }}>{item.freq}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 20, borderTop: "1px solid rgba(100, 116, 139, 0.2)" }}>
          <p style={{ fontSize: 11, color: "#64748B" }}>
            Voyance Unit Economics · Built from verified production billing data · {VERIFIED_DATA.trips} trips · {VERIFIED_DATA.period}
          </p>
          <p style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
            Generated Feb 4, 2026. "Verified" = from billing dashboards. "Projected" = documented pricing + estimates. Update weekly.
          </p>
        </div>
      </div>
    </div>
  );
}
