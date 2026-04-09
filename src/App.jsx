import React, { useState, useMemo } from 'react';
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
  trainingCost,
  breakCostAtSize,
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
function Slider({ label, hint, min, max, step, value, onChange, format }) {
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

// ─── Toggle button ────────────────────────────────────────────────
function Toggle({ label, active, onClick, activeColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? (activeColor || C.green) : C.surfaceAlt,
        color: active ? '#000' : C.textMuted,
        border: `1px solid ${active ? 'transparent' : C.border}`,
        borderRadius: 4,
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  // Model size (billions of parameters)
  const [modelSize, setModelSize] = useState(7);
  // Break cost at 7B reference size ($)
  const [b0log, setB0log] = useState(2); // 10^2 = $100 (Deep Ignorance at 7B)
  // Break cost scaling with model size
  const [expScaling, setExpScaling] = useState(false);
  // Safeguard improvement rate
  const [rrate, setRrate] = useState(1.0);
  // Algorithmic progress
  const [a1, setA1] = useState(3.0);
  const [decel, setDecel] = useState(0.85);
  // Sweep distribution mode
  const [uniform, setUniform] = useState(false);

  // Derived costs
  const B0_7B = Math.pow(10, b0log);
  const B0_scaled = breakCostAtSize(B0_7B, modelSize, expScaling);
  const C0 = trainingCost(modelSize);

  // Main time series
  const series = useMemo(
    () => getTimeSeries(C0, B0_scaled, rrate, a1, decel),
    [C0, B0_scaled, rrate, a1, decel]
  );

  // Years bought per actor
  const yb = useMemo(
    () => BUDGETS.map((b) => yearsBought(C0, B0_scaled, rrate, a1, decel, b.value)),
    [C0, B0_scaled, rrate, a1, decel]
  );

  // Sweeps
  const modes = useMemo(() => ({ b0log, rr: rrate, a1, decel }), [b0log, rrate, a1, decel]);
  const sweeps = useMemo(
    () => BUDGETS.map((b) => runSweep(b.value, modes, modelSize, expScaling, 2000, uniform)),
    [modes, modelSize, expScaling, uniform]
  );

  // Chart data
  const labels = series.ts.map((t) => t.toFixed(1));
  const mainChartData = {
    labels,
    datasets: [
      { data: series.breakCost, borderColor: C.red, borderWidth: 2, pointRadius: 0, tension: 0.3, label: 'Break safeguard' },
      { data: series.trainCost, borderColor: C.blue, borderWidth: 2, pointRadius: 0, tension: 0.3, label: 'Retrain from scratch' },
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
        type: 'logarithmic', min: 1, max: 1e10,
        title: { display: true, text: 'Cost ($)', color: C.textMuted },
        grid: { color: C.gridLine },
        ticks: {
          color: C.textMuted,
          callback: (v) => ([1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10].includes(v) ? fmt$(v) : ''),
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
          How long do open-weight model safeguards delay adversaries?
          Without safeguards, dangerous capability is freely available. Safeguards
          buy time = how long until an attacker can afford to break them.
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
          <div>C₀(N) = 800K × (N/7)² <span style={{ color: C.textMuted }}> training cost at N billion params</span></div>
          <div>
            B(N) = B₀ × (N/7){' '}
            <span style={{ color: C.textMuted }}>
              [linear] {expScaling ? '' : '← active'}
            </span>
          </div>
          <div>
            {'     '}= B₀ × e<sup>(N−7)/7</sup>{' '}
            <span style={{ color: C.textMuted }}>
              [exponential] {expScaling ? '← active' : ''}
            </span>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 6 }}>
            P(t) = <span style={{ color: C.textMuted }}>cumulative progress</span> = ∏ A₁ × decel<sup>y</sup> for y=0..t
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 6 }}>
            cost_retrain(t) = C₀(N) / P(t)
          </div>
          <div>cost_break(t) = B(N) × r<sup>t</sup> / P(t)</div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 6 }}>
            attacker_cost(t) = min( cost_break, cost_retrain )
          </div>
          <div style={{ color: C.green }}>
            years_bought = first t where attacker_cost(t) ≤ budget
          </div>
          <div style={{ color: C.textDim }}>without safeguards, capability is free (cost = $0)</div>
        </div>

        {/* Sliders */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 16 }}>
          <Slider label="N — model size (billions)" hint="Determines training cost C₀ and scales break cost B"
            min={1} max={500} step={1} value={modelSize} onChange={setModelSize}
            format={(v) => v + 'B'} />
          <Slider label="B₀ — break cost at 7B (full fine-tune)" hint="Deep Ignorance ≈ $100 | uses full FT (over-optimistic for safeguard value — LoRA is cheaper)"
            min={0} max={5} step={0.1} value={b0log} onChange={setB0log}
            format={(v) => fmt$(Math.pow(10, v))} />
          <Slider label="r — annual safeguard improvement" hint="1.0 = no improvement | 2.0 = techniques double break cost/yr"
            min={1} max={5} step={0.1} value={rrate} onChange={setRrate}
            format={(v) => v.toFixed(1) + '×/yr'} />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>Break cost scaling with model size</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Toggle label="Linear: B₀×(N/7)" active={!expScaling} onClick={() => setExpScaling(false)} />
              <Toggle label="Exponential: B₀×e^((N−7)/7)" active={expScaling} onClick={() => setExpScaling(true)} activeColor={C.amber} />
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
              Does tamper resistance scale linearly or exponentially with model size? Unknown.
            </div>
          </div>
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
            <span>Model: <b style={{ color: C.text }}>{modelSize}B</b></span>
            <span>Break cost now: <b style={{ color: C.red }}>{fmt$(B0_scaled)}</b></span>
            <span>Retrain cost: <b style={{ color: C.blue }}>{fmt$(C0)}</b></span>
            <span>B₀ at 7B: <b style={{ color: C.text }}>{fmt$(B0_7B)}</b></span>
            <span>Scaling: <b style={{ color: C.text }}>{expScaling ? 'exponential' : 'linear'}</b></span>
            {B0_scaled >= C0 && <span style={{ color: C.green }}>Break ≥ retrain (safeguard is ceiling-bound)</span>}
          </div>
        </div>

        {/* Main chart */}
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Cost curves (absolute $) — {modelSize}B model</h2>
          <div style={{ height: 360 }}>
            <Line data={mainChartData} options={mainChartOpts} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 8, fontSize: 12, color: C.textMuted }}>
            <span>● <span style={{ color: C.red }}>Break safeguard</span>: B(N)×r<sup>t</sup>/P(t)</span>
            <span>● <span style={{ color: C.blue }}>Retrain from scratch</span>: C₀(N)/P(t)</span>
            <span>● <span style={{ color: C.green }}>Attacker pays</span>: min(red, blue)</span>
            <span style={{ color: C.textDim }}>┄ Budget lines ($10K / $100K / $1M / $1B)</span>
          </div>
        </div>

        {/* Years bought cards */}
        <div style={{ marginTop: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Years bought by safeguards</h2>
          <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
            Without safeguards, capability is freely available (0 delay).
            Safeguards buy time until attacker can afford to break them.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {BUDGETS.map((b, i) => (
              <Stat
                key={b.label}
                label={b.label}
                value={yb[i] < 0.05 ? '0 yr' : yb[i].toFixed(1) + ' yr'}
                color={ybColor(yb[i])}
                detail={B0_scaled <= b.value
                  ? `break ${fmt$(B0_scaled)} ≤ budget`
                  : `break ${fmt$(B0_scaled)} > budget`}
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
            {' '}Model size ({modelSize}B) and scaling mode ({expScaling ? 'exp' : 'linear'}) are fixed.
          </p>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>Sampling distributions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <DistChart label="B₀ at 7B (break cost)" mode={b0log} lo={PARAM_RANGES.b0log[0]} hi={PARAM_RANGES.b0log[1]}
                labelFn={(v) => fmt$(Math.pow(10, v))} uniform={uniform} />
              <DistChart label="r (safeguard improvement)" mode={rrate} lo={PARAM_RANGES.rr[0]} hi={PARAM_RANGES.rr[1]}
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
          Safeguard Value Model v1.0 — Absolute cost framing, model-size dependent.
          Deep Ignorance break cost calibrated from O'Brien et al. 2025. Progress estimates from Epoch AI.
          Break costs assume full fine-tuning (over-optimistic for safeguard value).
        </div>
      </div>
    </div>
  );
}
