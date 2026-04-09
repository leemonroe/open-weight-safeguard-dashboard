import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  getTimeSeries,
  yearsBought,
  runSweep,
  getDistPoints,
  PARAM_RANGES,
  fmt$,
} from './model';

ChartJS.register(
  CategoryScale, LinearScale, LogarithmicScale,
  PointElement, LineElement, BarElement, Filler, Tooltip
);

// ─── Theme ────────────────────────────────────────────────────────
const C = {
  bg: '#0c0c0f',
  surface: '#16161a',
  surfaceAlt: '#1c1c22',
  border: 'rgba(255,255,255,0.06)',
  text: '#e0ddd5',
  textMuted: '#8a887f',
  textDim: '#5a5850',
  red: '#e05545',
  blue: '#4a8fd4',
  green: '#3cb07a',
  amber: '#c49035',
  gray: '#777',
  gridLine: 'rgba(255,255,255,0.04)',
};

const BUDGETS = [
  { label: '$10K hobbyist', value: 1e4 },
  { label: '$100K small group', value: 1e5 },
  { label: '$1M funded team', value: 1e6 },
  { label: '$1B+ state actor', value: 1e9 },
];
const B_COLORS = [C.gray, C.amber, C.blue, C.red];

// ─── Slider component ─────────────────────────────────────────────
function Slider({ id, label, hint, min, max, step, value, onChange, format }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <label style={{ fontSize: 13, color: C.text }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace", color: C.text }}>
          {format(value)}
        </span>
      </div>
      {hint && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{hint}</div>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: C.green }}
      />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────
function Stat({ label, value, color, detail }) {
  return (
    <div style={{ background: C.surface, borderRadius: 8, padding: '14px 16px', border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: color || C.text, fontFamily: "'IBM Plex Mono', monospace" }}>
        {value}
      </div>
      {detail && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{detail}</div>}
    </div>
  );
}

// ─── Mini distribution chart ──────────────────────────────────────
function DistChart({ label, mode, lo, hi, labelFn, uniform }) {
  const { labels, values } = useMemo(
    () => getDistPoints(mode, lo, hi, 40, labelFn, uniform),
    [mode, lo, hi, uniform]
  );

  const data = {
    labels,
    datasets: [{
      data: values,
      borderColor: 'rgba(60,176,122,0.6)',
      backgroundColor: 'rgba(60,176,122,0.1)',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: true,
      tension: 0.4,
    }],
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ height: 55 }}>
        <Line data={data} options={{
          responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: true, grid: { display: false },
              ticks: { color: C.textDim, font: { size: 9 }, maxTicksLimit: 4 } },
            y: { display: false },
          },
        }} />
      </div>
    </div>
  );
}

// ─── Sweep bar chart ──────────────────────────────────────────────
function SweepChart({ data: sweepData, title }) {
  const data = {
    labels: ['≥1', '≥2', '≥3', '≥4', '≥5'],
    datasets: [{ data: sweepData, backgroundColor: C.green, borderRadius: 3 }],
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>{title}</div>
      <div style={{ height: 160 }}>
        <Bar data={data} options={{
          responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: C.textMuted, font: { size: 11 } },
              title: { display: true, text: 'years', color: C.textDim, font: { size: 10 } } },
            y: { min: 0, max: 100, grid: { color: C.gridLine },
              ticks: { color: C.textMuted, font: { size: 11 },
                callback: (v) => (v % 25 === 0 ? v + '%' : '') } },
          },
        }} />
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  const [c0log, setC0log] = useState(6.3);
  const [f0log, setF0log] = useState(-0.7);
  const [r0log, setR0log] = useState(0.3);
  const [rrate, setRrate] = useState(1.0);
  const [a1, setA1] = useState(3.0);
  const [decel, setDecel] = useState(0.85);
  const [uniform, setUniform] = useState(false);

  const C0 = Math.pow(10, c0log);
  const F0 = Math.pow(10, f0log);
  const R0 = Math.pow(10, r0log);

  // Main time series
  const series = useMemo(
    () => getTimeSeries(C0, F0, R0, rrate, a1, decel),
    [C0, F0, R0, rrate, a1, decel]
  );

  // Years bought per actor
  const yb = useMemo(
    () => BUDGETS.map((b) => yearsBought(C0, F0, R0, rrate, a1, decel, b.value)),
    [C0, F0, R0, rrate, a1, decel]
  );

  // Sweeps (memoized)
  const modes = useMemo(() => ({ c0log, f0log, r0log, rr: rrate, a1, decel }), [c0log, f0log, r0log, rrate, a1, decel]);
  const sweeps = useMemo(
    () => BUDGETS.map((b) => runSweep(b.value, modes, 2000, uniform)),
    [modes, uniform]
  );

  // Chart data
  const labels = series.ts.map((t) => t.toFixed(1));
  const mainChartData = {
    labels,
    datasets: [
      { data: series.breakCost, borderColor: C.red, borderWidth: 2, pointRadius: 0, tension: 0.3, label: 'Break SG' },
      { data: series.trainCost, borderColor: C.blue, borderWidth: 2, pointRadius: 0, tension: 0.3, label: 'Retrain' },
      { data: series.naiveCost, borderColor: C.gray, borderWidth: 1.5, pointRadius: 0, tension: 0.3, borderDash: [3, 3], label: 'Naive FT' },
      { data: series.attackerCost, borderColor: C.green, borderWidth: 2.5, pointRadius: 0, tension: 0.3, label: 'Attacker pays' },
      ...BUDGETS.map((b, i) => ({
        data: series.ts.map(() => b.value),
        borderColor: B_COLORS[i],
        borderWidth: 1,
        borderDash: [4, 3],
        pointRadius: 0,
        label: b.label,
      })),
    ],
  };

  const mainChartOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + fmt$(ctx.parsed.y) } },
    },
    scales: {
      x: { title: { display: true, text: 'Years', color: C.textMuted }, grid: { color: C.gridLine },
        ticks: { color: C.textMuted, maxTicksLimit: 10 } },
      y: {
        type: 'logarithmic', min: 1, max: 1e9,
        title: { display: true, text: 'Cost ($)', color: C.textMuted },
        grid: { color: C.gridLine },
        ticks: {
          color: C.textMuted,
          callback: (v) => ([1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9].includes(v) ? fmt$(v) : ''),
        },
      },
    },
  };

  const ybColor = (v) => (v >= 3 ? C.green : v >= 1 ? C.amber : C.red);

  return (
    <div style={{
      background: C.bg, color: C.text, minHeight: '100vh',
      fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, lineHeight: 1.6,
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.02em' }}>
          Safeguard value model
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 32, maxWidth: 640 }}>
          When do AI model safeguards buy meaningful time against adversaries?
          An interactive exploration of tamper resistance, algorithmic progress, and attacker budgets.
        </p>

        {/* Equations */}
        <div style={{
          background: C.surface, borderRadius: 10, padding: '16px 20px', marginBottom: 28,
          border: `1px solid ${C.border}`, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
          lineHeight: 1.9,
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Model equations
          </div>
          <div>P(t) = <span style={{ color: C.textMuted }}>cumulative progress</span> = ∏ A₁ × decel<sup>y</sup> for y=0..t</div>
          <div>R(t) = R₀ × r<sup>t</sup> <span style={{ color: C.textMuted }}> tamper resistance</span></div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 6 }}>
            cost_retrain(t) = C₀ / P(t)
          </div>
          <div>cost_break(t) = F₀ × R(t) / P(t)</div>
          <div>cost_naive(t) = F₀ / P(t)</div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 6 }}>
            attacker_cost(t) = min( cost_break, cost_retrain )
          </div>
          <div style={{ color: C.green }}>
            years_bought = t<sub>with_SG</sub> − t<sub>without_SG</sub>
          </div>
          <div style={{ color: C.textDim }}>where t<sub>x</sub> = first time cost ≤ budget</div>
        </div>

        {/* Sliders — 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 24 }}>
          <Slider label="C₀ — train from scratch cost" hint="7B ~ $2M | 70B ~ $20M | frontier ~ $200M"
            min={5} max={8.5} step={0.1} value={c0log} onChange={setC0log}
            format={(v) => fmt$(Math.pow(10, v))} />
          <Slider label="F₀ — naive fine-tune cost" hint="Undo RLHF on 7B ~ $0.20 | 70B ~ $5 | frontier ~ $50"
            min={-1} max={4} step={0.1} value={f0log} onChange={setF0log}
            format={(v) => fmt$(Math.pow(10, v))} />
          <Slider label="R₀ — current tamper resistance" hint="RLHF: 1–3× | RMU: 10–50× | Deep Ignorance: 200–1000×"
            min={0} max={4} step={0.01} value={r0log} onChange={setR0log}
            format={(v) => {
              const r = Math.pow(10, v);
              return r >= 100 ? Math.round(r).toLocaleString() + '×' : r.toFixed(1) + '×';
            }} />
          <Slider label="r — annual TR improvement" hint="1.0 = no improvement | 2.0 = doubles/yr"
            min={1} max={5} step={0.1} value={rrate} onChange={setRrate}
            format={(v) => v.toFixed(1) + '×/yr'} />
          <Slider label="A₁ — progress Y1 multiplier" hint="Epoch AI central: ~2.5–3×/yr (algo + hardware)"
            min={1.5} max={5} step={0.1} value={a1} onChange={setA1}
            format={(v) => v.toFixed(1) + '×'} />
          <Slider label="decel — progress deceleration" hint="1.0 = steady | 0.85 = moderate | <0.8 implausible"
            min={0.8} max={1} step={0.01} value={decel} onChange={setDecel}
            format={(v) => v.toFixed(2)} />
        </div>

        {/* Live diagnostics */}
        <div style={{
          background: C.surface, borderRadius: 10, padding: '14px 18px', marginBottom: 24,
          border: `1px solid ${C.border}`, fontSize: 13,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', color: C.textMuted }}>
            <span>Break SG now: <b style={{ color: C.text }}>{fmt$(F0 * R0)}</b></span>
            <span>Naive FT now: <b style={{ color: C.text }}>{fmt$(F0)}</b></span>
            <span>Retrain now: <b style={{ color: C.text }}>{fmt$(C0)}</b></span>
            <span>Deep Ignorance (~500×): <b style={{ color: C.amber }}>{fmt$(F0 * 500)}</b></span>
            <span>Ceiling R = C₀/F₀: <b style={{ color: C.text }}>{Math.round(C0 / F0).toLocaleString()}×</b></span>
          </div>
        </div>

        {/* Main chart */}
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Cost curves (absolute $)</h2>
          <div style={{ height: 360 }}>
            <Line data={mainChartData} options={mainChartOpts} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 8, fontSize: 12, color: C.textMuted }}>
            <span>● <span style={{ color: C.red }}>Break SG</span>: F₀×R(t)/P(t)</span>
            <span>● <span style={{ color: C.blue }}>Retrain</span>: C₀/P(t)</span>
            <span style={{ color: C.gray }}>┄ Naive FT: F₀/P(t)</span>
            <span>● <span style={{ color: C.green }}>Attacker pays</span>: min(red, blue)</span>
            <span style={{ color: C.textDim }}>┄ Budget lines ($10K / $100K / $1M / $1B)</span>
          </div>
        </div>

        {/* Years bought cards */}
        <div style={{ marginTop: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Years bought by safeguards</h2>
          <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
            Delay vs. world with no safeguards (attacker pays F₀/P(t))
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {BUDGETS.map((b, i) => (
              <Stat
                key={b.label}
                label={b.label}
                value={yb[i] < 0.05 ? '0 yr' : yb[i].toFixed(1) + ' yr'}
                color={ybColor(yb[i])}
                detail={F0 <= b.value ? `naive FT ${fmt$(F0)} < budget` : "can't afford naive FT"}
              />
            ))}
          </div>
        </div>

        {/* Distribution plots + Sweep panels */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontSize: 15, fontWeight: 500 }}>Parameter sweep</h2>
            <button
              onClick={() => setUniform(!uniform)}
              style={{
                background: uniform ? C.amber : C.green,
                color: '#000',
                border: 'none',
                borderRadius: 4,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {uniform ? 'Uniform priors' : 'Beta priors'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
            {uniform
              ? 'Uniform sampling across entire range. Slider position ignored.'
              : 'Beta-shaped priors centered on slider values. Spread covers plausible range.'}
          </p>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>Sampling distributions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <DistChart label="C₀ (train cost)" mode={c0log} lo={PARAM_RANGES.c0log[0]} hi={PARAM_RANGES.c0log[1]}
                labelFn={(v) => fmt$(Math.pow(10, v))} uniform={uniform} />
              <DistChart label="F₀ (fine-tune cost)" mode={f0log} lo={PARAM_RANGES.f0log[0]} hi={PARAM_RANGES.f0log[1]}
                labelFn={(v) => fmt$(Math.pow(10, v))} uniform={uniform} />
              <DistChart label="R₀ (tamper resistance)" mode={r0log} lo={PARAM_RANGES.r0log[0]} hi={PARAM_RANGES.r0log[1]}
                labelFn={(v) => Math.round(Math.pow(10, v)) + '×'} uniform={uniform} />
              <DistChart label="r (TR improvement)" mode={rrate} lo={PARAM_RANGES.rr[0]} hi={PARAM_RANGES.rr[1]}
                labelFn={(v) => v.toFixed(1) + '×'} uniform={uniform} />
              <DistChart label="A₁ (progress Y1)" mode={a1} lo={PARAM_RANGES.a1[0]} hi={PARAM_RANGES.a1[1]}
                labelFn={(v) => v.toFixed(1) + '×'} uniform={uniform} />
              <DistChart label="decel" mode={decel} lo={PARAM_RANGES.decel[0]} hi={PARAM_RANGES.decel[1]}
                labelFn={(v) => v.toFixed(2)} uniform={uniform} />
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>
            % of worlds where safeguards buy ≥ N years
          </div>
          <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
            2000 samples from distributions above. Fixed budget per panel.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {BUDGETS.map((b, i) => (
              <SweepChart key={b.label} title={b.label} data={sweeps[i]} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 16, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textDim }}>
          Safeguard Value Model v0.6 — Dollar-calibrated, beta-distributed parameter sweeps.
          Based on Deep Ignorance (O'Brien et al. 2025), Epoch AI algorithmic progress estimates.
        </div>
      </div>
    </div>
  );
}
