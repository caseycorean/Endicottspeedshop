# ESS Vehicle Lab · Phase 2 interface and integration

Start a local static server from the website checkout and open `/experience/`.
The [private staging preview](https://ess-vehicle-lab-preview.rationaldace2.chatgpt.site/experience/) uses the same file layout. It opens with the owner’s ChatGPT account.
Export only the public candidate files with `python3 _build/experience/stage.py PATH/TO/staging/dist`. The exporter strips analytics tags and adds search exclusion. The staging site's owner-only permissions control access. Shared links restore a lineup for any recipient with access to the corresponding site.

## Reuse the components

| Component | Source and contract |
| --- | --- |
| Color and type | `experience/tokens.css` is shared by the lab and search styles. Use charcoal for the page, subtle lines for panels, amber for primary actions and changed values, and mint for focus or original references. Cars carry both a letter and a stable color. |
| Active configuration | `configuration.mjs` exports `useConfig` and `getActive`. A user explicitly applies the active configuration. Saved builds and incoming share links have independent state. |
| Search control | Use `data-ess-vehicle` and `data-lab-root` with `search-bridge.mjs`. The site generator inserts it on every article and calculator. The original weight-distribution calculator includes it directly. Mapping is deliberately field-specific. The corner-scale tool fills geometry with room for the user's measurements. |
| Competitor and replay | `matchup.mjs` accepts the shared configurations and runs the original strip or oval solver. `replay.mjs` paints a time sample, straight-line position, speed, gear and physical distance gap. Reset/scrub/speed controls address the same time trace. |
| Diagrams and results | `diagrams.mjs` exports the embeddable camber demonstration. `views.mjs` and `ui.mjs` export the metric, axle and tire-load patterns. Keep the quick prediction or warning next to the control, and tuck equations, model limits and detailed before/after values into accessible disclosures. |

The lineup has two to four explicit lane keys and each uses Original or Modified. Duplicate a lane to change a single variable while retaining the reference. URL fragments use short URL-safe UTF-8 encoding in v2 and still reopen v1 links. Local state is per browser and origin. Saving an experiment does not modify the active setup until explicitly applied.

## Comparison to the shared interface reference

| Reference | Implemented behavior | Remaining gap |
| --- | --- | --- |
| 1 · Camber | Direct upper-joint slider, coordinated front-view schematic, baseline, signed result and practical language. | Fixed-height illustration. Real hardpoints and camber-through-travel solver are a later vehicle-specific experiment. |
| 2, 7 · Build and mass | Preserved stock vehicle selection, measured case-study presets, reversible modifications, axle loads, front share, CG and percentage table. | Full polar inertia requires a measured baseline. The legacy CG Builder provides an estimated change, and the lab education illustrates the point-mass relationship. |
| 3 · Vehicle continuity | Optional selection on every existing calculator and article, editable named setups from stock references, active selection across navigation, separate saved state. | A visitor needs their original dimensions and measurements to fully specify a custom vehicle. No cross-device sync of local setups. |
| 4, 5 · Comparison and replay | Up to four independently tunable cars, including identical reference cars, chassis-based setup changes, animated models, speed, gear, gap, scrub, and share. | The test oval is synthetic. Speed and elapsed time remain model estimates until calibrated against measured tests. |
| 6 · Load transfer | Front-labelled four-wheel diagram, braking and cornering controls, parked deltas, original/modified tables and adjacent warnings. | Shared tire-load model still relies on estimated roll references. Legacy Grip Lab keeps its own illustrative defaults. |
| 8 · Entry and education | Main site search routes remain available. The social entrance runs the staged strip. Article selection opens the matching configuration in the same lab tools. | The account-private staging recipient needs the owner account. A signed-out public recipient journey awaits an approved public venue. |

The prior Phase 1 phone montage and scene were recovered from the screenshots you reviewed. The conversation search recovered the original interactive camber example's description. The original inline source and exact camber visual were unavailable, so the front-view demonstration reconstructs its interaction. The Phase 1 numerical models and existing source records remain the foundation of this candidate.

## Checks

Run `node --test _build/experience/models.test.mjs` and regenerate search pages with `PYTHONDONTWRITEBYTECODE=1 python3 _build/build.py`. Exercise four-car comparison, add/duplicate, change separate lanes, both event types, pause and scrub, share-reopen, a named active setup from the build page into the outside calculators and articles, and the camber slider. Compare mobile rendering at 320, 390 and 430 px.

The final 23 desktop-browser checks included the three phone widths, independently edited lanes, a fresh-tab share recipient, and active setup transfer through all five calculators. The live staging URL exposed the ChatGPT sign-in gate. Hardware Safari and its native share sheet still need a user pass.

[Actual phone-width review](review/phase2-mobile.webp).
