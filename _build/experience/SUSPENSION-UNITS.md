# Suspension, direct manipulation and site-wide units (Claude, 25 Nov 2026)

Branch `feature/suspension-units`, from `integration/ess-converged` 9f4a292 (the candidate the owner reviews tonight is untouched).

## 1. Units (`experience/units.mjs`)

**Canonical model units (never change these; convert at the edges):**

| Quantity | Canonical | Metric display |
|---|---|---|
| length (geometry, track, wheelbase, CG, travel, tire) | in | mm |
| distance (acceleration traces) | ft | m |
| weight / force | lb (lbf) | kg / N |
| spring, wheel, ride, tire rate | lb/in | N/mm |
| torque | lb-ft | N·m |
| power | hp | kW |
| speed | mph | km/h |
| roll stiffness | lb-ft/deg | N·m/deg |
| angle, frequency, acceleration, motion ratio | deg, Hz, g, — | same |

**Rules**
- Preference `us` | `metric` | `dual` in `localStorage['ess.units.v1']`; every page footer has the selector; changes sync across tabs (`storage` event) and fire `ess:units-changed`.
- `format(q, value)` for every displayed number; `parse(q, text)` for every typed number. `parse` accepts either system ("648 mm", "25.5 in", "79 N/mm") whatever the preference; a bare number is read in the preferred system (Both = US).
- State is never rewritten from a displayed number, so switching cannot drift. Shared links and saved configurations carry canonical values only; a recipient with other units reproduces the same physics (tested).
- Source records keep their original value, unit and provenance; `fromSource(q, value, unit)` converts on read (e.g. the F-body study's millimetre hardpoints).

## 2. Direct manipulation (`experience/manipulate.mjs`)

`attachHandles(layer, {handles, toScreen, toModel, clamp, onMove, onReset, announce})` puts real `<button>` handles over any SVG or canvas diagram.
- Mouse, trackpad, pen and touch through pointer events with capture; only handles set `touch-action: none`, so swiping elsewhere on a diagram still scrolls a phone.
- 44 px targets, labelled, visible focus. Arrows = one displayed step (0.1 in or 2 mm), Shift ×10, Alt fine, Home resets the point, Escape cancels a drag. Nothing depends on hover.
- Handles hold no state: they call `onMove(id, point)` in model units and the page updates its one state, which also feeds the sliders and typed fields.
- Reuse next: ballast/CG placement on the Build side view, traction-circle demand point, aero (wing height/angle), rear-axle side view (done), anti-dive geometry.

## 3. Suspension page (`#suspension`, `experience/suspension-lab.mjs` + retained `suspension-view.mjs`)

- **Front:** SLA or strut corner, draggable pivots and wheel travel; camber now/gain, roll centre and migration, swing arm, track change; camber and RC curves through ±3 in. Physics is `engine/suspension.mjs` (`slaAt`, `strutAt`) directly.
- **Rear:** retained link lab, now with side-view drag handles for the selected link, state that survives re-render and shares, and its ride-height roll centre feeding load transfer. Fixed: the "Try 8° roll" / "Reset pose" buttons threw and did nothing.
- **Springs, ride and roll:** spring rate and motion ratio write `setup.tune` (so Use, Garage, Compare and shares keep them); wheel/ride rate, frequency, static deflection, ride-height change vs stock springs, roll stiffness (springs + optional bar), front/rear frequency ratio, tire loads, front share of roll stiffness and of lateral load transfer using both roll centres, roll gradient. Physics: `engine/loads.mjs` `ride` and `tireLoads`.
- **Provenance:** car data (from the configuration, with per-value source in Build), ESS estimates, and generic educational geometry are labelled. No F-body hardpoints are invented: ESS has published reference dimensions only, not verified pickup coordinates.
- **Next experiments** are model runs (front/rear springs +20%, front bar, lower upper-inner pivot); their stated changes are tested to equal the model after applying.

## 4. Migration still to do (units)

| Area | Status |
|---|---|
| Suspension page | done (all readouts and inputs) |
| Footer preference on every generated page and the Lab | done (contact page regenerates only with `ESS_CONTACT_EMAIL`) |
| Gearing & traction page (mph, ft, lb, lb-ft, hp) | not migrated: readouts still US |
| Build inputs (weight, wheelbase, track, CG, springs) | not migrated |
| Compare / replay (ft, mph, s) | not migrated |
| Garage cards and catalog specs | not migrated; catalog records need source unit fields kept |
| Standalone calculators (`tools/*`, weight-distribution) | not migrated; they have their own inline scripts |
| Articles | prose stays as written; consider dual for key figures |
| Shared links | carry canonical values already; no change needed |
