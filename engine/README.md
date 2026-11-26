# ESS engineering library (`engine/`)

One copy of the vehicle math, shared by the calculators, the Vehicle Lab and future experiments.
Pure ES modules: no DOM, no network, browser and Node alike. Tests: `node --test engine/test/*.test.mjs`.

| Module | What it does | Status |
|---|---|---|
| `loads.mjs` | axle weights, add/remove/move items, longitudinal and lateral load transfer, four-tire loads, ride rate and frequency, spring for a target frequency | **Shared by the full load-transfer and spring-rate calculators, the tire-load entrance and Vehicle Lab.** Tests check the page input and output mapping on all seven fixture cars |
| `acceleration.mjs` | straight-line run (0–60, quarter mile, trap), traction limit with load transfer, tire-type grip defaults, rotating inertia, clutch-slip launch, magazine-style rollout timing, time split by what limited the car | **Private review v2.** Standstill replay with separate 1-ft rollout checkpoints. Disabling the new effects reproduces the independent V3 physics fixtures |
| `suspension.mjs` | front view: short/long-arm and MacPherson camber change, instant centre, roll-centre height, swing-arm length, track change through travel; side view: anti-squat for four-link, three-link, torque arm, leaf (range), independent; anti-dive, anti-lift; live-axle roll centre for Panhard, Watts, leaf | **Connected to the front-travel and rear-link studies.** SLA agrees with the ESS 3-D solver (`ess-knowledge/archive/2026-11-24_fbody-front-suspension/kinematics.py`) to 0.001° and 0.001 in on a planar test corner |
| `traction.mjs` | tire grip classes (all-season, max summer, extreme summer, 200TW track, drag radial, slick, period classes) with low/typical/high friction, lateral ratio, surface (dry, concrete, prepped strip, wet, gravel) and cold-temperature factors, each tied to a source; drive force vs available traction (RWD/FWD/AWD, front-lift cap) with green/yellow/red text, class comparison and gear-by-gear view | **New 25 Nov (Claude sprint).** Typical values equal the calibrated `tireGrip`, so no existing result changes. Functions only; Work owns any UI |
| `launch.mjs` | launch dynamics: clutch engagement, engine rpm (bog), wheelspin with sliding friction, shift timing as explicit states; typical / performance / maximum-effort / clutch-dump presets; best launch rpm sweep; time lost to shifts, traction and launch rpm; one tire/surface setting for the run and the traction check with a low–high friction range | **New 25 Nov (Claude sprint).** Separate module: `straightLine` and every existing result are unchanged. Functions only; Work owns any UI |

Units: lb, in, ft (distance in the acceleration model), s, mph, g, degrees.

## Browser consumers

- Use `loads.mjs` for load transfer, ride and Vehicle Lab balance. The advanced scale-delta and legacy mass pages still have their own presentations and legacy balance paths.
- `experience/models.mjs` validates a resolved vehicle and adapts the acceleration trace for replay. The test oval shares force and resistance functions and retains its own periodic speed solver.
- The front suspension study calls `slaAt` or `strutAt`. The rear articulation study retains its 3-D fixed-length solver and calls `rearGeometry` for the side projection.

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

Current residuals, candidate v2 (magazine timing): ET mean |error| 0.17 s over six cars (shipped: 0.51 s);
Corvette ET +0.19 s (shipped +1.32 s). Fiero (+0.7 s, test is a different trim) and Firebird are flagged.

## Suspension: assumptions shown to visitors
Rigid links and bushings, no compliance; 2-D front or side view only; no steering, caster or kingpin effects;
heave (both wheels together) for roll centres; tire contact moves with the wheel centre. MacPherson: upright
follows the ball-joint-to-top-mount line (strut offset ignored). Leaf springs: reported as a range because a
leaf winds up rather than pivots. Results describe *trends* (which way and roughly how much), not a specific
car's measured curve, unless measured hardpoints are entered.

## Shared components in the private review

`garage-adapter.mjs` combines the reference catalog with the source-tagged component records and
estimation rules. The chooser keeps each year and configuration explicit. The lab shows the evidence
and optional estimated values for the loaded choice. The UI uses component IDs in Garage and share
state. Previously issued IDs remain readable. Power ratings, gear ratios and an optional tire-class
grip estimate are applied through the same resolved vehicle used by the comparison and relevant
tools. Published component mass is shown with its basis. Use itemized weights and mounting
positions for an actual installation. The existing measured and published inputs for the original
lab fixtures are preserved for regression and benchmark comparisons.

## Supercar X archive as selectable vehicles (`archive.mjs`, Claude 25 Nov)

All 75 recovered Supercar X specification pages are catalog-shaped records with ids `sx-<slug>`. `labVehicle('sx-…')`,
`labRun('sx-…')`, `searchVehicles(query)` and `vehicleCoverage()` in `garage-adapter.mjs` work for them exactly as for
curated ids. Every value keeps evidence `historical` with its Wayback capture as the source (UI label "Supercar X archive").

- **Deduplication:** the five crosswalk exact matches carry `mergedInto` (the curated record already uses their values), so 70 are listed.
- **Tiers:** 56 `simulation-ready` (acceleration + tire loads run), 8 `partial` (the missing facts are listed per tool),
  6 `historical-reference` (competition cars: racing tires/aero are outside the street models). Search puts curated first, then archive by tier.
- **Suspension:** the published front/rear suspension text (`data/supercarx-suspension.mjs`) maps to architecture codes;
  `codeFromText` now reads the archive's link-count wording. "Rigid axle; coil springs" is not guessed (4-link and torque-arm cars both used it).
- **Data fixes:** pages with no gear table had left one ratio (e.g. `[1]`, `[0.74]`) in the parsed data. Those cars now show "missing: gears".
  Implausible test values are dropped (C55 AMG 0–60 "54.7"), see VERIFY-BACKLOG.
- **Hold-out validation (59 road tests):** quarter-mile mean error +0.17 s, MAE 0.30 s; 0–60 MAE 0.30 s.
  With the extreme-tire default (47 cars) the ET MAE is 0.26 s. The model is slow on 1960s–70s cars (+0.7 s, 4 cars).
  Trap speed MAE is 2.4 mph.
- **Tire rule change:** 1990–99 ZR tires at 40-series or 300 mm+ are now `uhp`, not `perf80s`. Before the change, the F40, McLaren F1 and Viper ACR
  were 0.4–0.6 s slow, and the all-car ET MAE was 0.33 s (now 0.30 s). No curated vehicle changes class.

## Launch dynamics (`launch.mjs`, Claude 25 Nov)

Owner directions: validation experiments for the C5 Z06 gap, and launch presets with the time each limit costs.
- **Model:** car speed, driven-wheel speed and engine speed are separate. The clutch slips while the engine is faster than
  the driveline; the tires spin while the wheels are faster than the car, and then give sliding friction (Wong: ≈0.88 of peak,
  estimate). Same inertia basis as v2 (Gillespie). At the grip limit the car accelerates at (grip − resistance)/mass; v2 divides
  this by 1.04. With unlimited grip and an instant clutch it reproduces `straightLine` to 0.001 s (test).
- **Presets** (labelled estimates, closed-course comparison, not advice): typical (2,000 rpm, 0.7 s clutch, 0.5 s shifts at 90%
  of redline), performance (model launch rpm, 0.35 s clutch, 0.25 s shifts), maximum effort (best launch rpm found for the car,
  0.15 s clutch, 0.2 s shifts, tires held at the limit), clutch dump (full throttle, no correction for wheelspin).
  Automatics keep the converter model.
- **Z06 diagnosis:** the 5.96 s 0–60 is the shipped model (μ 0.90, no rollout, 1,800 rpm launch). Rollout clock −0.35 s,
  tire class μ 1.10 −1.25 s, launch rpm 0, shift time −0.05 s, rotating inertia +0.17 s → v2 4.48 s. Launch dynamics, maximum
  effort: 4.35 s and ET 12.56 s vs the 4.07 s / 12.48 s test. Traction still costs 0.94 s of the 0–60; the remaining 0.28 s
  closes at μ ≈ 1.18, inside the extreme-summer range (1.03–1.22). Not adopted (one car).
- **Hold-out (59 archive road tests, no constant changed):** maximum effort ET MAE 0.26 s, bias +0.08 s (v2: 0.30 s, +0.17 s);
  0–60 MAE 0.26 s (v2: 0.30 s). Magazine figures are best runs, so maximum effort is the fair comparison.
