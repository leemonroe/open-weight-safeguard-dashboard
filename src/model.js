/**
 * Safeguard Value Model (v2 — absolute cost framing)
 *
 * Key insight: without safeguards, dangerous capability is freely
 * available (cost = $0). Safeguards buy time = how long until an
 * attacker can afford to break them.
 *
 * Equations:
 *   C₀(N) = 800K × (N/7)²                        training cost at model size N
 *   B(N)  = B₀ × (N/7)           [linear]         break cost at model size N
 *         = B₀ × e^((N−7)/7)     [exponential]
 *   P(t)  = cumulative progress = ∏(y=0..t) A₁ × decel^y
 *
 *   cost_retrain(t) = C₀(N) / P(t)
 *   cost_break(t)   = B(N) × r^t / P(t)
 *   attacker_cost(t) = min(cost_break, cost_retrain)
 *
 *   years_bought = first t where attacker_cost(t) ≤ budget
 */

// ─── Cost derivation from model size ──────────────────────────────

// Training from scratch: Chinchilla scaling ∝ N², anchored at 7B = $800K
export function trainingCost(N) {
  return 800_000 * Math.pow(N / 7, 2);
}

// Break cost at model size N, given break cost B0 at 7B
export function breakCostAtSize(B0, N, exponential = false) {
  if (exponential) {
    // Cap exponent to avoid overflow; min() with C0 handles the economics
    const exp = Math.min((N - 7) / 7, 50);
    return B0 * Math.exp(exp);
  }
  return B0 * (N / 7);
}

// ─── Cumulative progress ──────────────────────────────────────────

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

// ─── Time series for main chart ───────────────────────────────────

export function getTimeSeries(C0, B0_scaled, rr, a1, decel, nPoints = 100) {
  const ts = [];
  const breakCost = [];
  const trainCost = [];
  const attackerCost = [];

  for (let i = 0; i <= nPoints; i++) {
    const t = (i * 5) / nPoints;
    ts.push(t);
    const Pt = cumulativeProgress(a1, decel, t);
    const cb = (B0_scaled * Math.pow(rr, t)) / Pt;
    const ct = C0 / Pt;
    breakCost.push(cb);
    trainCost.push(ct);
    attackerCost.push(Math.min(cb, ct));
  }

  return { ts, breakCost, trainCost, attackerCost };
}

// ─── Years bought ─────────────────────────────────────────────────
// Without safeguards, capability is free (cost=$0, available at t=0).
// years_bought = total time (within 5yr horizon) where attacker
// cannot afford to break or retrain. With r > 1, break cost can
// rise over time as safeguard techniques improve, so protection
// may start later and/or have gaps.

export function yearsBought(C0, B0_scaled, rr, a1, decel, budget) {
  const N = 200;
  let protectedSteps = 0;

  for (let i = 0; i <= N; i++) {
    const t = (i * 5) / N;
    const Pt = cumulativeProgress(a1, decel, t);
    const cBreak = (B0_scaled * Math.pow(rr, t)) / Pt;
    const cTrain = C0 / Pt;
    const atkCost = Math.min(cBreak, cTrain);

    if (atkCost > budget) protectedSteps++;
  }

  return (protectedSteps / (N + 1)) * 5;
}

// ─── Beta distribution utilities ──────────────────────────────────

export function betaRandom(a, b) {
  const x = Math.pow(Math.random(), 1 / a);
  const y = Math.pow(Math.random(), 1 / b);
  return x / (x + y);
}

export function betaPDF(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.pow(x, a - 1) * Math.pow(1 - x, b - 1);
}

export function getShapeParams(mode, lo, hi, concentration = 6) {
  let p = (mode - lo) / (hi - lo);
  p = Math.max(0.05, Math.min(0.95, p));
  return [1 + concentration * p, 1 + concentration * (1 - p)];
}

export function sampleBeta(a, b, lo, hi) {
  return lo + betaRandom(a, b) * (hi - lo);
}

export function sampleUniform(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// ─── Sweep ────────────────────────────────────────────────────────

// Parameter ranges for sweep sampling
export const PARAM_RANGES = {
  b0log: [0, 5],     // $1 to $100K (break cost at 7B)
  rr:    [1, 5],     // safeguard improvement rate
  a1:    [1.5, 5],   // progress Y1
  decel: [0.8, 1.0], // deceleration
};

export function runSweep(budget, modes, N, exponentialScaling, nSamples = 3000, uniform = false) {
  const { b0log, rr, a1, decel } = modes;

  const pB0 = getShapeParams(b0log, ...PARAM_RANGES.b0log);
  const pRR = getShapeParams(rr, ...PARAM_RANGES.rr);
  const pA1 = getShapeParams(a1, ...PARAM_RANGES.a1);
  const pAd = getShapeParams(decel, ...PARAM_RANGES.decel);

  const sample = (shapeParams, range) =>
    uniform
      ? sampleUniform(...range)
      : sampleBeta(shapeParams[0], shapeParams[1], ...range);

  const C0 = trainingCost(N);
  // Histogram buckets: [0-1yr, 1-2yr, 2-3yr, 3-4yr, 4-5yr, 5yr]
  const buckets = [0, 0, 0, 0, 0, 0];

  for (let i = 0; i < nSamples; i++) {
    const sB0 = Math.pow(10, sample(pB0, PARAM_RANGES.b0log));
    const sB = breakCostAtSize(sB0, N, exponentialScaling);
    const sRR = sample(pRR, PARAM_RANGES.rr);
    const sA1 = sample(pA1, PARAM_RANGES.a1);
    const sAd = sample(pAd, PARAM_RANGES.decel);

    const yb = yearsBought(C0, sB, sRR, sA1, sAd, budget);
    const bucket = Math.min(Math.floor(yb), 5);
    buckets[bucket]++;
  }

  return buckets.map((c) => Math.round((c / nSamples) * 100));
}

// ─── Distribution chart data ──────────────────────────────────────

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

// ─── Formatting ───────────────────────────────────────────────────

export function fmt$(v) {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  if (v < 1) return '$' + v.toFixed(2);
  return '$' + Math.round(v);
}
