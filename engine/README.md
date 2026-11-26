# ESS engineering library (`engine/`)

One copy of the vehicle math, shared by the calculators, the Vehicle Lab and future experiments.
Pure ES modules: no DOM, no network, browser and Node alike. Tests: `node --test engine/test/*.test.mjs`.

| Module | What it does | Status |
|---|---|---|
| `loads.mjs` | axle weights, add/remove/move items, longitudinal and lateral load transfer, four-tire loads, ride rate and frequency, spring for a target frequency | **Equivalent to the live calculators and the Vehicle Lab**: tests read the formulas straight out of `tools/load-transfer` and `tools/spring-rate` and compare all 7 Vehicle Lab cars |
| `acceleration.mjs` | straight-line run (0–60, quarter mile, trap), traction limit with load transfer, tire-type grip defaults, rotating inertia, clutch-slip launch, magazine-style rollout timing, time split by what limited the car | **Candidate v2**, not wired into the Vehicle Lab yet. With the new effects switched off it reproduces the shipped model (test) |
| `suspension.mjs` | front view: short/long-arm and MacPherson camber change, instant centre, roll-centre height, swing-arm length, track change through travel; side view: anti-squat for four-link, three-link, torque arm, leaf (range), independent; anti-dive, anti-lift; live-axle roll centre for Panhard, Watts, leaf | **New.** SLA agrees with the ESS 3-D solver (`ess-knowledge/archive/2026-11-24_fbody-front-suspension/kinematics.py`) to 0.001° and 0.001 in on a planar test corner |

| `resolve.mjs` | **one resolver**: vehicle record + selected components + owner entries → simulator-ready vehicle, per-field provenance, readiness per simulator | New (25 Nov). Precedence owner > component > record > Supercar X exact match > library mapping > estimate |
| `garage-adapter.mjs` | `labVehicle(configId, components, owner)`, `labRun(…)`, `garageComponents()`, `evidenceLabel` — the entry point for Work's Garage UI | New. Engine swap also moves mass (estimated position) so every tool sees the same car |
| `data/transmissions.mjs` | 31 gear sets (Muncie, Super T-10, T5 family, TKX, T56/TR6060, MT82, Powerglide/TH350/TH400/200-4R/4L60E/4L80E/6L80/8L90/10-speed, TorqueFlite, C4/C6/AOD/4R70W), each with sources; weights where published; per-vehicle mapping | Every entry sourced (tested) |
| `data/engines.mjs` | engine families with installed weights, swap engines (ratings from donor records), gross→net rule, ESS-measured parts (LS1 teardown log) | |
| `data/axles.mjs` | axle assembly weights, documented final-drive choices | |
| `data/architectures.mjs` | suspension architecture codes (owner-approved), text→code mapping, per-architecture motion-ratio and unsprung ranges, codes for records with missing text | |
| `data/supercarx.mjs` | 75 parsed Supercar X spec sheets (historical tier): calibration + 49 hold-out road tests | |
| `data/recovered.mjs` | specs recovered for records that lacked them (1965 GTO, 1993 Mustang, 1969 Z/28) — to promote into the records after QA | |
| `tires.mjs` | tire-size parser (metric, LT, flotation, letter series) and tire-type grip defaults | |
| `estimates.mjs` | estimation rules with ranges and stated basis: front share by layout class, redline, track, CG height, drag area, ride defaults | |

Evidence tiers everywhere: manufacturer · independent_test · published · calculated · **historical** (Supercar X) · **estimated** (rule, with low/high/basis) · **owner**.

Units: lb, in, ft (distance in the acceleration model), s, mph, g, degrees.

## Where the same math currently lives (duplication map, 25 Nov)
| Formula | Copies today | Agree? |
|---|---|---|
| Four-tire load transfer | `tools/load-transfer` (inline), `assets/grip-lab.js` (fixed suspension defaults), `experience/models.mjs` `tireLoads` | Yes, to 1e-9 lb (tested) |
| Ride frequency | `tools/spring-rate` (with spring angle), `experience/models.mjs` `ride` (no spring angle) | Yes at 0°; the Vehicle Lab copy cannot represent an angled spring |
| Mass / balance / item moves | `tools/cg-builder`, `weight-distribution-calculator`, `tools/scale-delta`, `experience/models.mjs` `resolve` | Same moment balance (Vehicle Lab tested) |
| Straight-line acceleration | `experience/models.mjs` only | n/a |
| Camber illustration | `experience/models.mjs` `camberIllustration` (teaching sketch: lower joint fixed) | Superseded by `suspension.mjs` for real geometry |

Recommended path (no behaviour change for visitors): pages and the Vehicle Lab import from `engine/` one at a
time, each step guarded by the equivalence tests above. Calculators are classic scripts but every page already
loads a module (`experience/search-bridge.mjs`), so a small module bridge can expose `engine` functions to them.

## Acceleration model: what was wrong and the validation strategy
Findings (25 Nov, details in ess-knowledge `inbox/2026-11-25_claude_engineering-foundation.md`):
1. **One grip value (0.90) for every tire** was the main error. The C5 Z06 on extreme-performance summer tires
   spent 6.7 s wheelspin-limited in the shipped model; the 1991 Camaro on 1980s radials only 4.2 s.
2. **No rotating inertia.** Engine, flywheel and wheels add ~30% effective mass in first gear. Its absence was
   hiding behind other conservative assumptions, so totals looked plausible while *changes* (axle ratio, gearing)
   were overstated.
3. **Launch.** The shipped model launches at 1,800 rpm; a real manual launch slips the clutch at a higher rpm.
4. **Timing convention.** US magazines and drag strips start the clock after ~1 ft of rollout (≈0.3 s).

Validation approach, designed to improve over time without validating every car first:
- One shared physics set for all cars. **No per-car tuning** to match a test.
- Only tire grip varies, by *tire type* (labelled estimates in `tireGrip`), set from four calibration cars.
- Every new published test is a **hold-out** first: run it before touching any constant. Record the residual.
  Change a shared constant only when the hold-out residuals show a pattern across several cars.
- A car that misses badly while the rest agree is treated as a **specification or test-condition problem**
  (example: 1977 Trans Am — trap speed implies ~170 hp delivered vs 200 rated; test car configuration unconfirmed),
  logged in `data/vehicle-reference/VERIFY-BACKLOG.md`, not fixed by tuning.
- Results show the evidence level: "matches a road test within x", "same physics, not checked against a test".

Update 25 Nov (component package): drive layout (front / rear / all-wheel traction) and a generic torque converter
for automatics added. Whole pipeline (resolver + estimates + v2) against 67 road tests: median |ET error| 0.31 s,
80% within 0.51 s; Supercar X manual hold-outs (33 cars never used for tuning) median 0.28 s. Known bias: classic
(pre-1972) cars run 0.3–1.7 s slower than their period tests even at gross = net — read classic results as comparisons.

Earlier residuals, candidate v2 (magazine timing): ET mean |error| 0.17 s over six cars (shipped: 0.51 s);
Corvette ET +0.19 s (shipped +1.32 s). Fiero (+0.7 s, test is a different trim) and Firebird are flagged.

## Suspension: assumptions shown to visitors
Rigid links and bushings, no compliance; 2-D front or side view only; no steering, caster or kingpin effects;
heave (both wheels together) for roll centres; tire contact moves with the wheel centre. MacPherson: upright
follows the ball-joint-to-top-mount line (strut offset ignored). Leaf springs: reported as a range because a
leaf winds up rather than pivots. Results describe *trends* (which way and roughly how much), not a specific
car's measured curve, unless measured hardpoints are entered.
