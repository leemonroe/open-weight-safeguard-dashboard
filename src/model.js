/**
 * Safeguard Value Model
 *
 * Equations:
 *   P(t) = cumulative progress = ∏(y=0..t) A₁ × decel^y
 *   R(t) = R₀ × r^t                          (tamper resistance over time)
 *   cost_retrain(t)  = C₀ / P(t)              (train from scratch, $)
 *   cost_break(t)    = F₀ × R(t) / P(t)       (break safeguards, $)
 *   cost_naive(t)    = F₀ / P(t)              (fine-tune w/o safeguards, $)
 *   attacker_cost(t) = min(cost_break, cost_retrain)
 *   years_bought     = t_with_SG − t_without_SG
 *     where t_x = first time attacker can afford path x
 */

// Cumulative algorithmic + hardware progress at time t
export function cumulativeProgress(a1, decel, t) {
  let cum = 1;
  let rate = a1;
  for (let y = 0; y < Math.floor(t); y++) {
    cum *= rate;
    rate *= decel;
  }
  const frac = t - Math.floor(t);
  if (frac > 0) cum *= Math.pow(rate, frac);
  return cum;
}

// Full time series for the main chart
export function getTimeSeries(C0, F0, R0, rr, a1, decel, nPoints = 100) {
  const ts = [];
  const breakCost = [];
  const trainCost = [];
  const naiveCost = [];
  const attackerCost = [];

  for (let i = 0; i <= nPoints; i++) {
    const t = (i * 5) / nPoints;
    ts.push(t);
    const Pt = cumulativeProgress(a1, decel, t);
    const Rt = R0 * Math.pow(rr, t);
    const cb = (F0 * Rt) / Pt;
    const ct = C0 / Pt;
    const cn = F0 / Pt;
    breakCost.push(cb);
    trainCost.push(ct);
    naiveCost.push(cn);
    attackerCost.push(Math.min(cb, ct));
  }

  return { ts, breakCost, trainCost, naiveCost, attackerCost };
}

// Years of delay imposed by safeguards for a given attacker budget
export function yearsBought(C0, F0, R0, rr, a1, decel, budget) {
  const N = 200;
  let tWith = null;
  let tWithout = null;

  for (let i = 0; i <= N; i++) {
    const t = (i * 5) / N;
    const Pt = cumulativeProgress(a1, decel, t);
    const Rt = R0 * Math.pow(rr, t);
    const cBreak = (F0 * Rt) / Pt;
    const cTrain = C0 / Pt;
    const cNaive = F0 / Pt;
    const atkCost = Math.min(cBreak, cTrain);

    if (tWith === null && atkCost <= budget) tWith = t;
    if (tWithout === null && cNaive <= budget) tWithout = t;
  }

  if (tWithout === null) tWithout = 5;
  if (tWith === null) tWith = 5;
  return Math.max(0, tWith - tWithout);
}

// Beta random variate via power method
export function betaRandom(a, b) {
  const x = Math.pow(Math.random(), 1 / a);
  const y = Math.pow(Math.random(), 1 / b);
  return x / (x + y);
}

// Beta PDF (unnormalized, for plotting shape)
export function betaPDF(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.pow(x, a - 1) * Math.pow(1 - x, b - 1);
}

// Convert a slider mode to beta shape params over [lo, hi]
export function getShapeParams(mode, lo, hi, concentration = 6) {
  let p = (mode - lo) / (hi - lo);
  p = Math.max(0.05, Math.min(0.95, p));
  return [1 + concentration * p, 1 + concentration * (1 - p)];
}

// Sample from beta on [lo, hi]
export function sampleBeta(a, b, lo, hi) {
  return lo + betaRandom(a, b) * (hi - lo);
}

// Sample uniformly on [lo, hi]
export function sampleUniform(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// Parameter ranges used by both sweep and distribution charts
export const PARAM_RANGES = {
  c0log: [5, 8.5],
  f0log: [-1, 4],
  r0log: [0, 4],
  rr:    [1, 5],
  a1:    [1.5, 5],
  decel: [0.8, 1.0],
};

// Run the full parameter sweep for one budget level
export function runSweep(budget, modes, nSamples = 3000, uniform = false) {
  const { c0log, f0log, r0log, rr, a1, decel } = modes;

  const pC0 = getShapeParams(c0log, ...PARAM_RANGES.c0log);
  const pF0 = getShapeParams(f0log, ...PARAM_RANGES.f0log);
  const pR0 = getShapeParams(r0log, ...PARAM_RANGES.r0log);
  const pRR = getShapeParams(rr, ...PARAM_RANGES.rr);
  const pA1 = getShapeParams(a1, ...PARAM_RANGES.a1);
  const pAd = getShapeParams(decel, ...PARAM_RANGES.decel);

  const sample = (shapeParams, range) =>
    uniform
      ? sampleUniform(...range)
      : sampleBeta(shapeParams[0], shapeParams[1], ...range);

  const counts = [0, 0, 0, 0, 0];

  for (let i = 0; i < nSamples; i++) {
    const sC0 = Math.pow(10, sample(pC0, PARAM_RANGES.c0log));
    const sF0 = Math.pow(10, sample(pF0, PARAM_RANGES.f0log));
    const sR0 = Math.pow(10, sample(pR0, PARAM_RANGES.r0log));
    const sRR = sample(pRR, PARAM_RANGES.rr);
    const sA1 = sample(pA1, PARAM_RANGES.a1);
    const sAd = sample(pAd, PARAM_RANGES.decel);

    const yb = yearsBought(sC0, sF0, sR0, sRR, sA1, sAd, budget);
    for (let y = 0; y < 5; y++) {
      if (yb >= y + 1) counts[y]++;
    }
  }

  return counts.map((c) => Math.round((c / nSamples) * 100));
}

// Generate PDF points for the distribution mini-charts
export function getDistPoints(mode, lo, hi, nPts = 50, labelFn, uniform = false) {
  const [a, b] = getShapeParams(mode, lo, hi);
  const labels = [];
  const values = [];
  for (let i = 0; i <= nPts; i++) {
    const x01 = i / nPts;
    const xVal = lo + x01 * (hi - lo);
    labels.push(labelFn ? labelFn(xVal) : xVal.toFixed(2));
    values.push(uniform ? 1 : betaPDF(x01, a, b));
  }
  return { labels, values, a, b };
}

// Format dollar amounts
export function fmt$(v) {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  if (v < 1) return '$' + v.toFixed(2);
  return '$' + Math.round(v);
}
