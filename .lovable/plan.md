

## Enhancement: Projections Tab + Credit Economics Table

### Current Structure

The Unit Economics dashboard (`src/pages/admin/UnitEconomics.tsx`) uses a 6-tab sidebar layout: Overview, Revenue, Costs, Users, Credits, Forecast. Each tab is a separate component receiving `data: UnitEconomicsData`. The existing Forecast tab has basic linear projections and scenario cards but no interactive modeling. The Credits tab shows consumption by action but not the full cost-per-tier margin analysis.

### Plan

**Single file change: `src/pages/admin/UnitEconomics.tsx`**

**1. Add two new tabs to `TABS` array (line 46-53):**
- `projections` — "Projections" with a TrendingUp icon
- `credit-economics` — "Credit Economics" with a Coins-variant icon

Update `TabKey` type, `TABS` array, and `renderTab()` switch.

**2. New `ProjectionsTab` component**

Interactive revenue projection model with:
- **Own conversion rate slider** (1-100%, default 5%) — independent from any global control
- **Revenue mix selector** — 4 presets (pessimistic, conservative, balanced, optimistic) defining what % of paid users buy each tier
- **Blended AOV display** — computed from mix × tier prices
- **Projection table** at 100 / 500 / 1K / 5K / 10K users showing: monthly users, paid users, monthly revenue, annual revenue, total cost, monthly profit, annual profit, margin %
- **Revenue mix breakdown cards** — for each tier: what % of users, price × credits, revenue contribution at 1K users
- **Key milestones** — break-even users, $1K MRR threshold, revenue at 1K and 10K users

Revenue mix presets (defined as a constant):
```
pessimistic:  80% flex_100, 10% flex_300, 5% flex_500, 3% voyager, 2% explorer, 0% adventurer
conservative: 40% flex_100, 25% flex_300, 15% flex_500, 10% voyager, 7% explorer, 3% adventurer
balanced:     20% flex_100, 20% flex_300, 20% flex_500, 15% voyager, 15% explorer, 10% adventurer
optimistic:   10% flex_100, 15% flex_300, 15% flex_500, 20% voyager, 25% explorer, 15% adventurer
```

Cost model per row: `freeCost = freeUsers × $0.024/mo`, `paidCost = paidUsers × $0.091`, `fixedCost = $49`, margin = `(revenue - totalCost) / revenue`.

**3. New `CreditEconomicsTab` component**

Comprehensive credit action table with every action:
- Columns: Action, Description, Credits, Free Cap, Our Cost, Cost/Credit, then **4 tier columns** (Flex 100 @ $0.090/cr, Flex 500 @ $0.078/cr, Explorer @ $0.056/cr, Adventurer @ $0.047/cr) each showing user-pays and margin %, plus a Best Margin column
- 12 rows covering: Unlock Day (60cr), Smart Finish (50cr), Hotel Search (40cr), Route Optimization (20cr), Mystery Getaway (15cr), Regenerate Day (10cr), Swap Activity (5cr), Add Activity (5cr), Restaurant Rec (5cr), AI Companion (5cr), Mystery Logistics (5cr), Transport Mode (5cr)

Below the table:
- **Summary cards**: Most Expensive Action, Cheapest Action, Highest Volume, Worst Margin
- **Credit Flow Overview**: 3-column layout showing Sources (sign-up bonus, monthly grant, referral, purchases), Sinks (unlock days, editing, smart finish, hotel search), Expiration Rules (free 2mo, purchased never, club bonus 6mo, FIFO)

### What stays the same
- All 6 existing tabs unchanged
- `useUnitEconomicsData` hook unchanged
- `unitEconomics.ts` config unchanged
- No database changes needed

