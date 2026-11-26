# ESS vehicle knowledge — data and engineering integration contract (v1)

Claude, 25 Nov 2026. Branch `engineering/vehicle-knowledge`. For ChatGPT's interface work and any later consumer.
**Consume these; do not copy numbers into pages or re-implement calculations.**

## One foundation, three inputs, no second database
| Input (unchanged owner) | What it contributes |
|---|---|
| Work's reviewed reference package (`_build/vehicle-reference-data.json`, `reference-reviewed.json`, `reference-oem.json`, `reference-editorial.json`, `reference-test-checkpoints.json`; from ess-knowledge 924669f + 47501c2) | What may be **published**: facts, sources, definitions, routes, holds |
| Shared engine (`engine/`, Claude) + Lab registry (`experience/vehicles.mjs`) | The **model inputs** each configuration runs on, with per-input provenance |
| Supercar X archive (`engine/data/supercarx.mjs`, PR #15) | Historical facts; extra archive facts appear only in the private review build until the owner approves archive publication scope |

`python3 -B _build/build.py` runs, in order:
1. `_build/knowledge/engine-data.mjs` → `engine/data/publication.mjs` (holds/withheld: one decision set for pages **and** Lab) and `engine/data/archive-corrections.mjs` (manufacturer-sourced hp, torque, dimensions, final drive replace archive values; peak rpm never replaced; archive value kept in the note).
2. `reference_pages.py` (Work's editorial logic, unchanged) collects each page's facts.
3. `_build/knowledge/knowledge.mjs` joins them → `_build/knowledge/vehicle-knowledge.json` (canonical) + public `vehicles/data/index.json` and `vehicles/data/<slug>.json`.
4. `spec_page.py` renders every published page from its record. `ESS_SPEC_TEMPLATE=reference` renders Work's 47501c2 template instead.

## Record `ess.vehicle-knowledge.v1` (`vehicles/data/<slug>.json`, and embedded in each page as `#ess-spec-data`)
```
id            canonical configuration id = Lab id (curated config_id, or 'sx-…' for archive configurations)
route, slug   /vehicles/<slug>/  (stable; Work's 116 routes preserved)
title, variant, kind
identity      {year, make, layout FR|MR|RR|FF|AWD, category, archive:{tier, competition, modified, capture}|null}
facts[]       {group, label, value, unit (source unit, never converted), note, evidence, key, quantity, basis?, standard?, source:{url,publisher,title}, publish}
                evidence: manufacturer | road test | published | archive | calculated | estimate
                basis (weights): curb | as tested | dry | shipping | regulation | published
                standard (power/torque): SAE net | gross | PS (DIN) | kW | bhp | as published | estimate
                publish: public | review (review = archive fact pending owner approval; never in a public build)
conflicts[]   {key, kind: 'different definitions'|'source disagreement', values[]}  — shown, never averaged
key           best value per quantity for headlines and comparison: {value (canonical US unit), sourceValue, sourceUnit, evidence, basis}
                weightPerHp is derived (lb/hp) and marked derived
tires         {tireFront|tireRear: {size, diameter in, width mm, aspect, rim}}  nominal geometry from engine/tires.mjs
model         {labId, engine, inputs:{key:{value, evidence, basis, url}}, readiness, competition, accelerationRuns, accelerationIssue}
links         {compare, lab:{build, performance, strip, tools, suspension} (fragments), defaultOpponent}
compareWith   [slug…] suggested comparisons (same make: later flagship, latest; then similar weight per hp)
related       [{slug,title,route}] internal links
```
`vehicles/data/index.json`: `{schema, count, vehicles:[{id, slug, route, title, variant, make, year, layout, labId, runs, key}]}` — enough for a library, filters and comparison tables without loading every record.

## Engineering functions a page or interface may call (browser ES modules, no build step)
| Need | Call |
|---|---|
| Configuration with visitor changes | `experience/models.mjs` `newSetup(id)`, `resolve(setup, modified)`; setup = `{id, base, tune:{key:value}, parts:[{label≤60, oldWeight, oldX, newWeight, newX}], conditions:{tire}}`; limits in `models.limits`, `validValue()` |
| Acceleration (0–60, ¼ mile, trap, time split by limiter) | `models.straightLine(v)` → `{magazine:{zeroTo60, et, trap}, time:{traction, engine, clutch, shifting}}` or `{issue}` |
| Axle loads after adding/moving mass | through `resolve()` with `parts` (engine `loads.applyItems`) |
| Ride | `models.ride(v, 'front'|'rear')` → `{wheel, hz}` |
| Torque curve shape | `engine/acceleration.mjs` `torqueAt(v, rpm)` (estimate through published peaks; label it) |
| Road-load power | `engine/acceleration.mjs` `resistanceAt(v, ft/s)` |
| Tire size geometry | `engine/tires.mjs` `parseTire(size)` |
| Tire classes / grip | `engine/traction.mjs` `tireClasses`, `pickerOrder`, `frictionFor()` |
| Units | `experience/units.mjs` `format`, `parse`, `unitsControl`, `bindUnitControls`, event `ess:units-changed`; models stay in canonical US units |
| Lab handoff | `experience/configuration.mjs` `shareFragment({a, b, aMode, bMode, focus, event?}, view)` → `experience/?via=reference#v2/…` |
| Save / share | `saveToGarage(setup, mode)`, `shareResult(url, title, summary)` |

The working reference implementation of every call is `experience/spec-page.mjs` (one shared experiment state, reversible change list, Lab links that carry every change). ChatGPT may restyle every `sp-` class (`assets/ess-spec.css`) and restructure the markup in `_build/spec_page.py`; keep `[data-sp-panel]`, `[data-sp-changes]`, `[data-sp-compare]`, `[data-sp-units]`, `[data-sp-status]`, `[data-q][data-v]` and `#ess-spec-data` or move the matching JS with them.

## Labeling rules (binding for any interface)
- Never present a model result, an ESS estimate or a derived value as a specification. Show evidence on every value.
- Weights always show their definition; power shows its rating standard when known. Do not compare a curb weight with an as-tested weight without saying so.
- Model times use magazine timing (1-ft rollout). The Lab replay times from a standstill (~0.3 s longer). Say which.
- Geometry (tire diameter, gear speed) is not fitment or traction. Tire *type* changes the model's grip coefficient.
- Numbers are text; bars only illustrate printed numbers.

## Publication gates (unchanged)
Public build = Work's 1,683 reviewed facts only. The 946 archive facts tagged `review` need the owner's approval of archive publication scope and rights. No production merge or deploy without owner approval.
