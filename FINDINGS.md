# Safeguard Value Model — Key Findings

## Evo2 case study (40B protein language model, ~$10M training cost)

### Break cost estimates with Deep Ignorance

Deep Ignorance at 7B costs approximately $100 to break (full fine-tuning, over-optimistic for safeguard value since LoRA is cheaper). Scaling to 40B:

| Scaling model | Break cost at 40B | Basis |
|---|---|---|
| **Linear**: B₀ × (N/7) | **$571** | Break cost grows proportionally with param count |
| **Exponential**: B₀ × e^((N-7)/7) | **$11K** | Break cost grows exponentially with param count |

With linear scaling, even a 40B model with state-of-the-art safeguards can be broken for under $600.

### Training cost in 5 years (Evo2-equivalent at 40B)

How much will it cost to train a 40B model from scratch in 5 years, given algorithmic progress?

| Progress assumption | Cumulative 5yr progress | Training cost in 2031 |
|---|---|---|
| 4×/yr, no slowdown (Epoch AI upper) | 1,024× | **$10K** |
| 4×/yr, 0.85 deceleration | 202× | **$50K** |
| 3×/yr, 0.85 deceleration (dashboard default) | 48× | **$209K** |
| 2.5×/yr, no slowdown (conservative) | 98× | **$102K** |

**Within 5 years, training an Evo2-equivalent from scratch will cost $10K–$209K.** This sets an absolute ceiling on how long any safeguard can matter — once retraining is affordable, software safeguards are irrelevant regardless of tamper resistance.

### Years bought by safeguards (Evo2, C₀ = $10M actual)

Using dashboard defaults (A₁=3, decel=0.85, r=1):

| Safeguard | Scaling | $10K budget | $100K budget | $1M budget |
|---|---|---|---|---|
| Deep Ignorance (B₀=$100) | Linear | 0 yr | 0 yr | 0 yr |
| Deep Ignorance (B₀=$100) | Exponential | 0.1 yr | 0 yr | 0 yr |
| 100× DI (B₀=$10K) | Linear | 1.7 yr | 0 yr | 0 yr |
| 100× DI (B₀=$10K) | Exponential | 5+ yr | 2.5 yr | 0.1 yr |

### Key conclusions

1. **Current safeguards (Deep Ignorance) buy zero meaningful time at any model size with linear scaling.** The break cost at 40B is $571 — below even a hobbyist budget.

2. **A hypothetical 100× improvement over Deep Ignorance** (break cost $10K at 7B) buys 1.7 years against hobbyists at 40B with linear scaling — and still zero time against any funded actor.

3. **Exponential scaling is the only scenario where safeguards matter**, and it is empirically unverified. Whether tamper resistance scales linearly or exponentially with model size is the load-bearing question for the entire safeguard research agenda.

4. **The retraining ceiling is binding.** Within 5 years, training a 40B model from scratch will cost $50K–$209K. No software safeguard can buy time beyond this point — the attacker simply retrains without safeguards.

5. **Safeguards primarily defend against hobbyists**, unless break cost scaling is exponential AND the model is large (70B+). Funded actors ($1M+) are almost never meaningfully delayed.

## Model calibration note

The dashboard's training cost formula C₀ = 800K × (N/7)² overshoots by ~2.6× for Evo2 (predicts $26M vs actual $10M). Real training costs scale closer to N^1.3–1.5 than N². This means the model is slightly *over-optimistic* about the retraining ceiling, making safeguards look better than they are.
