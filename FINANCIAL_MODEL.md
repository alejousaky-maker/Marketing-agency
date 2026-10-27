# Financial model

All arithmetic is deterministic TypeScript in `src/lib/finance.ts`. Rates are fractions internally; the UI accepts percentages. Calculations retain floating-point precision until display. No LLM performs financial arithmetic. These are planning calculations, not a billing ledger.

## Definitions and conventions

The model is per **original order** and first-order only. AOV is the basket value before modeled discounts and refunds. If your exported AOV is already net of either, use zero for the corresponding modeled adjustment to avoid double counting. Taxes, gift-card liabilities, repeat purchases, organic uplift and fixed overhead are excluded. Currency conversion is not performed.

Let `A` be AOV, `d` discount rate, `r` refund rate, `f` payment percentage fee, and `k` fixed payment fee.

| Output | Formula |
| --- | --- |
| Collected revenue | `A × (1 − d)` |
| Net revenue per order | `A × (1 − d) × (1 − r)` |
| Payment fees | `A × (1 − d) × f + k` |
| Variable costs | `COGS + outbound shipping + fulfillment + payment fees` |
| Contribution margin per order | `net revenue − variable costs` |
| Contribution margin % | `contribution margin / net revenue` |
| Break-even CPA | Positive contribution margin per order; otherwise not viable |
| Break-even ROAS | `net revenue / contribution margin`, only with positive margin |

COGS, shipping, fulfillment and payment fees remain incurred on refunded orders. This conservative convention does not assume recovered inventory or refunded processing fees. Return postage, support costs and other variable costs should be included in the client-entered per-order costs if material. The UI documents that forecasts are incomplete until all required costs are known.

**ROAS in AgencyOS uses refund-adjusted net revenue.** Many ad platforms use gross attributed revenue. Do not compare the two definitions without reconciliation. Platform gross break-even ROAS would use collected/gross revenue in the numerator instead.

## Actual performance formulas

| Output | Formula |
| --- | --- |
| CAC / cost per acquired order | `ad spend / orders` |
| New-customer CAC | `ad spend / new customers` |
| ROAS | `attributed net revenue / ad spend` |
| MER | `total net revenue / total marketing spend` |
| Profit ROAS | `(contribution before ads − ad spend) / ad spend` |
| Contribution after ads | `contribution before ads − ad spend` |
| First-order profitability | `(contribution before ads − ad spend) / orders` |

The general metrics function requires separate `netRevenue` (attributed revenue) and `totalNetRevenue` (total business revenue) inputs for ROAS and MER respectively. If total business revenue is unavailable, MER remains null. V1 experiment result forms do not invent agency-wide MER from experiment-attributed revenue. Repeat customers are not automatically treated as new customers. Zero denominators return null, not zero or Infinity. Count relationships are validated. Budgets, AOV and CPM must be at least 0.01 currency units to reject nonsensical or overflowing projections.

## Forecast chain

```text
impressions = budget / CPM × 1000
clicks = impressions × CTR
potential purchases = clicks × click-to-purchase CVR
purchases = min(potential purchases, stated order capacity), if capacity exists
CPC = budget / clicks
CPA = budget / purchases
net revenue = purchases × per-order net revenue
contribution before ads = purchases × contribution margin
contribution after ads = contribution before ads − budget
```

Expected purchases may be fractional; display rounding is not an assertion that fractional customers exist. Reaching capacity does not reduce budget automatically. This exposes the downside of continuing to spend after fulfillment is constrained.

Analysis proposes a 500-unit budget in the client's currency as an explicitly labeled learning cap. It is neither an approved budget nor a fabricated historical value. The interactive model allows a different budget and saves the supplied assumptions separately.

## Scenario assumptions

| Case | CPM | CTR | CVR |
| --- | --- | --- | --- |
| Downside | Base × 1.25 | Base × 0.75 | Base × 0.70 |
| Base | Supplied | Supplied | Supplied |
| Upside | Base × 0.85 | Base × 1.20, capped at 1 | Base × 1.25, capped at 1 |

These multipliers are transparent stress assumptions, **not fitted distributions or confidence intervals**. The reported range is downside-to-upside contribution profit. Historical sample size is unknown unless supplied, and simulated historical samples remain simulated. Forecast confidence is qualitative and conservative.

## Sensitivity

Each of CTR, CVR, CPM, AOV, refund rate and contribution margin changes ±20% **relative**, holding other inputs fixed. Probability rates cap at 100%. The contribution-margin perturbation is a direct economic stress, independent of its individual cost components. It is not a simultaneous price/cost change. The largest absolute change from the baseline is the reported economic leverage point. Correlations between inputs and business feasibility are not modeled.

## Decisions and experiments

- Missing economics/assumptions or insufficient creative evidence: REVISE BEFORE TEST.
- Nonpositive per-order contribution or a loss even in the upside scenario: DO NOT RUN.
- Limited evidence or only optimistic profitability: SMALL TEST, with caveats.
- Robust stressed economics, strong creative and at least 100 historical purchases: STRONG TEST CANDIDATE; still not a guarantee.
- SCALE EXISTING WINNER additionally requires supplied, verified profitable replicated results with at least 100 purchases and two replications. V1's user-entered results do not populate this verified-winner gate automatically.
- Simulated evidence can never qualify for scaling or a strong real-spend recommendation.

Sample sizing is a two-sided 5% alpha, 80% power normal approximation for two independent conversion proportions with a default 30% relative lift. It produces a required **click sample per arm**, not an impression count. Proposals additionally require at least 30 purchases per arm, seven complete days, and the complete refund observation window. The budget needed to reach the click sample is shown; a 500-unit test may only be a directional, inconclusive learning exercise.

Stopping at a budget or operational guardrail does not manufacture a winner. V1 records results and computes financial metrics; it does not implement sequential inference, multiple-comparison adjustment or profit-variance estimation. Even when sample thresholds are met, a human must review attribution and uncertainty before choosing a winner.

Every financial formula, null/zero behavior, capacity bound, scenario direction and decision gate is covered by executed unit tests.
