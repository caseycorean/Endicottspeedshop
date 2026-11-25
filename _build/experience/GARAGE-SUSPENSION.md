# ESS Vehicle Lab · Garage and rear suspension

Open [owner staging](https://ess-vehicle-lab-preview.rationaldace2.chatgpt.site/experience/) with the owner's ChatGPT account. For development, serve the checkout with `python3 -m http.server 8000` and open `/experience/`. No package install is required. Run `node --test _build/experience/*.test.mjs` and `PYTHONDONTWRITEBYTECODE=1 python3 _build/build.py` before integration. Export the private preview with `python3 _build/experience/stage.py /path/to/staging/dist`.

## Reuse and review

| Design reference | Implementation | Next check |
| --- | --- | --- |
| Open vehicle choice and continuity | `catalog.mjs` provides a shared search/filter dialog, with make, generation, vehicle type and drivetrain. `configuration.mjs` exposes the active setup, saved variants and versioned share state. `search-bridge.mjs` uses the same chooser and passes available fields into the existing calculators. | Add easier model-family browsing as the catalog grows. Safari touch and scrolling need an owner pass. Garage saves live in this browser and origin. |
| Discover, experiment, understand, engineer | The lab keeps the charcoal and amber identity, introduces a warmer serif and the illustrated Palouse strip, and puts the two entry actions alongside the visual. Compare shows results and quick tuning first. Animation, detail and assumptions expand in place. Search routes still lead directly to the articles and calculators. | Check the first screen and account-gated share flow on an iPhone. A signed-out sharing journey needs an approved public venue. |
| Build and compare | Start blank, start from a reference, duplicate a lane, or apply a saved variant. Edit the baseline and retain reversible modifications. Up to four competitors use the same solver and timeline. Independent engine and transmission presets and first-gear feedback are in `components.mjs` and `drivetrain-view.mjs`. | Broaden reusable part specifications with measured installation mass and fitment context. |
| Live engineering diagrams | `rear-links.mjs` is a pure solver, and `suspension-view.mjs` couples a side and top schematic to the mount, heave and roll controls. It can take wheelbase and CG height from the active vehicle. The existing camber, axle and tire-load teaching diagrams remain accessible. | Add measured hardpoints, persist and share geometry drafts, extend the frontend camber experiment to measured travel. |

## Catalog and performance data

The catalog contains all 50 structured references and two existing website models, the 1991 Camaro Z28 and 1988 Fiero GT. Five legacy URL identifiers still resolve. Eleven rows currently have the input set the performance solver requires. These still use documented assumptions where direct measurements are unavailable. The rest can be browsed and completed by entering the fields the selected study requires. Burn down missing fields by actual model need, especially gear ratios, tire dimensions, CG and test configuration.

The generated browser projection in `experience/catalog-data.mjs` retains each imported value's evidence, source and conditions. It includes 18 related stock or benchmark Supercar X archive links. Archive matches can be a different trim or configuration. They contribute leads only. The generator needs a JSON object with the knowledge sources and vehicle records as arrays and the Supercar X crosswalk CSV. Pass both files and the target as positional arguments to `build-catalog.py`. The CSV and private input bundle stay upstream.

The strip and synthetic test oval are comparative estimates. Launch demand, the grip limit and loaded axle are shown in the quick drivetrain disclosure. AWD uses ideal shared grip, while the automatic converter and shift are generic estimates. Presets supply specs, with installation mass, fitment and calibration handled separately. Compare predictions against documented tests of the same trim, tires and weight before drawing numerical conclusions. Advanced launch optimization stays a follow-on.

## Rear suspension scope

- Working layouts are three-link with Panhard, parallel four-link with Panhard, triangulated four-link, and torque arm with Panhard. The torque-arm guide constrains nose height while allowing fore/aft travel. Leaf spring is a conventional reference and needs a separate spring and shackle model.
- The rigid-axle solver prescribes heave and roll, then minimizes link-length residuals by solving fore/aft and lateral shifts, pitch and yaw. The plotted side-view instant center intersects the projected upper and lower control lines, with link pairs averaged for the side view. For straight-line rear drive and near-zero roll, anti-squat is the slope from the rear contact patch to the instant center divided by CG height over wheelbase. The view suppresses the straight-line value in roll.
- Max residual up to 0.02 in is green, up to 0.08 in is yellow, and greater is red. These indicate how closely the idealized links reach the requested pose in the solver. The numbers do not establish joint range, clearance, force capacity, component compliance or roadworthiness. The illustrative pickup locations require measurement for a real vehicle.
- Select **Parallel four-link** and **Try 8° roll** from zero heave. The example reports about 0.155 in mismatch. Select **Three-link** at the same roll and the example fits to the displayed precision. Independently check the nominal three-link instant center at 86.6 in forward of axle center and 21.825 in above ground.

## This iteration's checks

The Node suite passed 38 tests, including the recovered Claude regressions, catalog coverage, Garage and share serialization, different driven axles, and analytical and constraint checks for rear-link layouts. Chromium checks covered nominal 320, 390 and 430 px frames, choosing a reference, a live automatic swap, saving and reloading a custom build, its direct entry into load transfer, replay and reset, and reopening a shared experiment. The host sign-in flow and physical-device Safari should be included in the owner's staging review.
