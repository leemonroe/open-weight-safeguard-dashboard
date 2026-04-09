# Safeguard Value Dashboard — Handoff for Claude Code

## What this is

An interactive dashboard modeling **when AI model safeguards buy meaningful time against adversaries**. It answers: across reasonable uncertainty about algorithmic progress, tamper resistance, and attacker resources, how many years do software safeguards delay misuse?

The core argument this supports: **software-layer safeguards are fragile** relative to hardware-level or pre-training interventions, and this can be shown quantitatively.

## Project structure

```
safeguard-dashboard/
├── package.json          # Vite + React + Chart.js
├── vite.config.js
├── index.html
├── HANDOFF.md            # This file
└── src/
    ├── main.jsx          # React entry
    ├── model.js          # Core math (pure functions, no UI)
    └── App.jsx           # Dashboard UI
```

## Deploy to Vercel

```bash
npm install
npm run build
# Then either:
npx vercel --prod
# Or connect the repo to Vercel dashboard
```

## The model

### Core equations

All costs are in **absolute dollars** and decline over time with progress P(t).

```
P(t) = cumulative progress = ∏(y=0..t) A₁ × decel^y
R(t) = R₀ × r^t                            # tamper resistance over time

cost_retrain(t)  = C₀ / P(t)               # train dangerous model from scratch
cost_break(t)    = F₀ × R(t) / P(t)        # break safeguards via fine-tuning
cost_naive(t)    = F₀ / P(t)               # fine-tune WITHOUT safeguards

attacker_cost(t) = min(cost_break, cost_retrain)   # attacker picks cheapest path
baseline_cost(t) = cost_naive(t)                    # world without safeguards

years_bought = t_with_SG − t_without_SG
  where t_x = first time the relevant cost ≤ attacker budget B
```

### Key insight

Safeguards buy time = period where `min(F₀×R(t), C₀) / P(t) > B` but `F₀/P(t) ≤ B`.

Both paths get cheaper at the same rate P(t) (algorithmic progress helps attackers regardless of path). The **binding condition** for safeguards to matter at all is `F₀ × R₀ > B` (break cost exceeds budget today). If not, safeguards are already irrelevant.

### Parameters and calibration

| Parameter | Symbol | Range | Default | Calibration source |
|-----------|--------|-------|---------|-------------------|
| Train-from-scratch cost | C₀ | $100K–$300M | $2M (7B) | Public estimates of Llama-class training |
| Naive fine-tune cost | F₀ | $3–$10K | $50 (LoRA on 7B) | Empirical LoRA costs |
| Tamper resistance | R₀ | 1×–10,000× | 2× (RLHF) | See calibration notes below |
| TR improvement rate | r | 1×–5×/yr | 1× (no improvement) | No empirical basis for >1 yet |
| Progress Y1 multiplier | A₁ | 1.5×–5× | 3× | Epoch AI ~8-month halving time |
| Progress deceleration | decel | 0.8–1.0 | 0.85 | See discussion below |

### Tamper resistance calibration

| Method | R₀ estimate | Basis |
|--------|------------|-------|
| RLHF refusals | 1–3× | Broken with $50 LoRA, ~10 steps |
| RMU / Circuit Breaking | 10–50× | Broken in ~100–500 steps |
| Deep Ignorance | 200–1000× (lower bound) | Survived 10K steps / 305M tokens on 6.9B. Attack cost ~$5–50, but FAILED. True break cost unknown. |
| Theoretical ceiling | C₀/F₀ ≈ 40,000× (for 7B) | Breaking = retraining |

Deep Ignorance reference: O'Brien, Casper, et al. (2025). "Deep Ignorance: Filtering Pretraining Data Builds Tamper-Resistant Safeguards into Open-Weight LLMs." arXiv:2508.06601.

### Algorithmic progress schedule (central estimate)

| Year | Multiplier | Cumulative | Source |
|------|-----------|------------|--------|
| 1 | 3.0× | 3× | Epoch AI |
| 2 | 2.55× | 7.7× | 3 × 0.85 |
| 3 | 2.17× | 16.6× | declining |
| 4 | 1.84× | 30.6× | declining |
| 5 | 1.56× | 47.8× | declining |

At decel=0.85, cumulative ~48× over 5 years. Range: 15× (pessimistic) to 243× (optimistic).

### Sweep methodology

Parameters are sampled from **beta distributions** (not uniform) centered on slider values. The beta shape params are derived from the slider position within its range:

```
p = (mode - lo) / (hi - lo)     # normalize to [0,1]
α = 1 + concentration × p       # concentration = 6
β = 1 + concentration × (1 - p)
sample = lo + Beta(α, β) × (hi - lo)
```

Log-scale parameters (C₀, F₀, R₀) are sampled in log-space then exponentiated.

## Key findings at default parameters

1. **Current safeguards (R₀ ≈ 2) buy 0 years for all actors.** Break cost = $100, which is below every budget.
2. **Deep Ignorance (R₀ ≈ 500) buys ~0 years for $1M+ actors** but meaningful time for $10K actors. Break cost = $25K.
3. **Safeguards primarily defend against hobbyists, not funded actors**, unless R₀ reaches extreme values OR C₀ is frontier-scale.
4. **The binding constraint is almost always `F₀ × R₀ > B`**, not algorithmic progress. The first-order question is whether break cost exceeds budget TODAY.
5. **Progress rate matters through the retrain channel**: it determines when train-from-scratch becomes affordable, setting the ceiling on how long safeguards can matter even at infinite R₀.

## Planned improvements / open questions

### Model extensions needed
- [ ] **Minimum dangerous capability**: Currently assumes attacker needs a specific model scale. Should parameterize "how capable does the model need to be for the threat scenario?" — a $50K model might suffice for many biosecurity threats.
- [ ] **Distillation path**: Attacker could distill from API access rather than fine-tuning weights. This is a third path with different cost structure.
- [ ] **Time-varying C₀**: As new models are released, the cost to train a "dangerous" model drops in discrete steps (new architectures, recipes), not just the smooth P(t) curve.
- [ ] **In-context learning bypass**: Deep Ignorance is vulnerable to retrieval-augmented prompting. Should model the "prompt injection" path that bypasses weight-level TR entirely.
- [ ] **Frontier cost slider**: Currently C₀ is the dangerous-model cost. Could add separate frontier tracking to show how the "interesting model" size shifts over time.

### UI improvements
- [ ] Permalink / shareable URL encoding slider state
- [ ] Export charts as PNG/SVG
- [ ] Scenario presets (e.g., "current reality", "Deep Ignorance deployed", "hardware governance")
- [ ] Sensitivity analysis: which parameter has highest marginal effect on years_bought?
- [ ] Monte Carlo confidence intervals on the sweep charts instead of point estimates
- [ ] Responsive layout for mobile

### Analysis extensions
- [ ] Add a "hardware governance" parameter: if hardware constraints increase C₀ over time (countering algorithmic progress), how does that change the picture?
- [ ] Compare safeguard value at different model scales (7B vs 70B vs frontier) side by side
- [ ] Break out "algorithmic progress on training" vs "algorithmic progress on attacking safeguards" as separate rates
- [ ] Add discrete events: "new unlearning technique published" as step-function R₀ increases

## Context

This dashboard supports a broader research argument about **hardware-level enforcement** as the only safeguard robustly surviving red-teaming. The quantitative finding — that software tamper resistance is within 1–2 OOM of irrelevance for funded actors — motivates the case for building safety into hardware (TEE attestation, compute rate limiters, democratic inference throttling) rather than relying on weight-level interventions alone.

Related work by the author: SGTM experiments on ESM protein language models, VCI (Verifiable Cooperative Infrastructure), hardware governance mechanisms, and the "normative hardware design" research agenda.
