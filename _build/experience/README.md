# ESS Vehicle Lab · implementation and integration

Review prototype on `experience/vehicle-lab`, draft website PR #10. It is designed for Casey’s Nov 25 experience-first sprint. The existing search routes, generated articles, calculator URLs, and Grip Lab are preserved. The prototype entry has `noindex` and sits outside the production sitemap. The draft branch adds a discovery link on the existing home page. Public launch selection remains with Casey.

## Run and review

From the website checkout:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/experience/`. The browser needs HTTP or HTTPS to load JavaScript modules. The prototype has no runtime dependencies, backend, external assets or analytics tag.

- **Build** → 1977 Firebird → remove the ESS-measured 23 lb rear seat assembly → compare with the original or edit the other lane. The starting 3,830 lb belongs to a period W72 Trans Am test car. The modified balance result assumes an estimated original axle split and component location.
- **Compare** → run and scrub the quarter mile. Switch to **Test oval** to see straight-line speed, braking, turn speed and exit acceleration update on a closed 2-D path. Add the same 50 lb cabin removal to both cars. A share link restores both setups, event, and Original/Modified selections in another tab.
- **Tools** → try combined braking and turning, or change spring rates. Open the full calculator and check that its fields reflect the same experiment. The standalone load-transfer and spring-rate pages and traction-circle article also expose a compact vehicle chooser.
- **Apply to my build** saves one setup locally. Try another change, then reopen your saved build to verify it is unchanged. Clearing site browser data clears the saved setup.
- **Learn** → trace measured parts and load states, or vary the lever arm and inertia radius.

Run `node --test _build/experience/models.test.mjs` for 13 computational/configuration checks. Run `PYTHONDONTWRITEBYTECODE=1 python3 _build/build.py` after editing legacy templates. Static `experience/` pages are served directly, independent of the generator.

## Integration seams

| Files | Contract |
| --- | --- |
| `reference.mjs`, `vehicles.mjs` | Public projections of the ESS Vehicle Reference, supplemental Camaro/Fiero records, field evidence and scenario defaults. Explicit estimates fill incomplete source fields. The Fox chassis uses a civilian LX reference with SSP-era 5.0 engine ratings. |
| `configuration.mjs` | Versioned setup with reference ID, original field overrides, experiment overrides and component changes. The `v1` fragment carries both lanes. Storage is opt-in through a single versioned key. Preserve the v1 reference constants or migrate explicitly if later data changes, so existing links remain reproducible. |
| `models.mjs`, `oval.mjs` | Pure mass model, tire loads, ride frequency, acceleration trace and synthetic oval trace. Use resolved configurations as inputs. Distances are feet on driving traces and inches in the garage. |
| `ui.mjs`, `views.mjs`, `app.mjs` | Reusable selector, evidence and expandable explanations, view templates, browser state and replay. Users can step through replay with the keyboard even when animation is disabled by reduced-motion preference. |
| `search-bridge.mjs` | Opt-in integration on existing pages. Loads the same setup and fills existing fields as a batch before triggering the existing calculation. Old direct links and pre-existing calculator examples keep their paths. |

The load-transfer and ride-frequency formulas were reproduced from the existing ESS calculators. The prototype and legacy load-transfer tool agree with matching original geometry and roll parameters. Ride comparisons hold spring angle at zero and hand off wheel motion ratio, sprung weight inputs and tire stiffness to the full calculator. Track, CG, springs and motion ratios without source evidence are visibly estimated. Full calculator suspension inputs remain available.

Share links encode values and part labels in the URL fragment. Opening a shared experiment leaves the local saved build alone. The text passed to a phone’s share sheet includes the modeled comparison. There is no same-origin public page for a preview-only URL. Anyone who receives a link at the common hosted origin will be able to inspect its embedded configuration. Social preview metadata is generic for now.

## Computational scope and evidence

- **Mass and balance.** With positive distance behind the front axle, `Mrear = Σ(weight × x)` and `Wrear = Mrear / wheelbase`. Compute net weight and moment for each add, remove, relocate or replace operation. No vertical or lateral part coordinates are inferred. The Firebird example records distinguish the historical Formula, incomplete LS1/T5 scale state and finished dry projection. The LS1/T5 preset uses 558 lb dressed plus 50 lb clutch/flywheel. Removed driveline mass and installation location depend on the owner’s inputs. GTO donor ratings are an optional scenario and installed power is unmeasured.
- **Straight line.** Point mass at 0.02 s steps. Estimated torque curve from published peaks and assumed endpoint shape, 85% drivetrain efficiency, 0.30 s shifts, illustrative 1,800 rpm minimum launch, level road, 0.015 rolling resistance, standard air density, approximate drag. Use available wheel force or a rear-axle grip cap with longitudinal load transfer, whichever is lower. Finish speed is instantaneous. A complete launch/driveline model would need slip, rotating inertia, torque interruption data, loaded rolling radius, surface conditions and test protocols. Only RWD reference cars are represented.
- **Synthetic oval.** 520 ft straights, 200 ft radius turns. A periodic speed envelope makes repeated backward braking and forward acceleration passes. A friction circle budgets remaining acceleration in a turn, with a 96% lateral-speed ceiling. Flying start and idealized gear changes. No banking, real track geometry, corner transient, dynamics of individual tires, aero balance, yaw or suspension response. Use it for comparative sensitivity only.
- **Existing Performance Lab.** Reviewed Study 8 architecture and the v0.9.1 inventory at `archive/kb-v1.0.2/software/ess_lab_v0.9.zip` in the knowledge repo. Its signed-curvature track and evidence/capability design are compatible with this browser model. The binary archive was unavailable through the connector. This implementation independently reuses the point-mass and forward/backward principles. Numerical Python parity and migration of its custom circuit are still open.
- **Validation leads.** The 1977 W72 Trans Am, 1991 Camaro Z28, 2002 Corvette Z06 and 2004 GTO expose matched source checkpoints for review. The results are deliberately uncalibrated. Differences include driver, rollout, road, drivetrain and tire assumptions. The green Firebird’s existing scale states establish weight and build history, with no equivalent paired 0–60 or quarter-mile test available in the reviewed records. RGV8 Fiero remains a lead. The recovered archive tree, available crosswalk and repository search did not establish a traceable paired stock and modified result. The stock 1988 Fiero record is a separate vehicle.
- **Art.** The strip illustration is AI-generated scene-setting imagery. Vehicle identity and dimensions used by the models come from the reference inputs.

### Stock checkpoint comparison

These classroom estimates use the same illustrative 0.90 launch grip, with the sourced parameters and default gaps exposed in each vehicle's evidence panel. The values below are model versus published road tests in seconds. They show why acceleration remains a prototype.

| Reference | 0–60 estimate / test | Quarter-mile estimate / test |
| --- | ---: | ---: |
| 1977 W72 Trans Am | 7.8 / 9.3 | 16.2 / 16.9 |
| 1991 Camaro Z28 | 6.6 / 6.4 | 15.1 / 14.9 |
| 2002 Corvette Z06 | 6.0 / 4.07 | 13.8 / 12.48 |
| 2004 Pontiac GTO | 6.3 / 5.3 | 14.6 / 14.0 |

## Priorities after handoff

1. Independent device review at the intended hosted origin. Exercise phone share sheets, a clean recipient browser, keyboard navigation and search-page round trips. Verify calculator analytics sends no user-entered values before exposing links widely.
2. Measure the completed green Firebird on all four scales with documented fuel, occupants and equipment. Recover exact axle/loading, curves and test conditions for the unmodified checkpoints. Pair before/after acceleration or speed data at a controlled venue.
3. Decide the first promotion with Casey. A narrowly scoped, independently checked vehicle chooser and before/after Grip Lab are closer to launch readiness than the acceleration and oval models.
4. Compare browser traces to the Python Performance Lab, improve validation coverage, and then decide which braking/corner segments to expand. Confirm rights and geometry before using a named track. Extend the source coverage selectively for missing fields.
