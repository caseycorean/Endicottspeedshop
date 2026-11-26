# ESS integrated candidate: integration contracts

Owner direction (25 Nov, `ess-knowledge/launch/2026-11-29/ESS-CONVERGENCE.md`):
- **Claude** owns functional convergence, engineering integration and engagement.
- **Work** owns the reusable brand and presentation package, plus independent QA.

This file is the contract between the two.

## Branches
| Branch | Role |
|---|---|
| `integration/ess-converged` | **The one integrated development branch.** Claude integrates here; Work's presentation package lands here through PRs or cherry-picks |
| `experiment/experience-refinement-claude` (ab41084) · `experiment/visual-identity-claude` (7e0fb90) · `experiment/performance-slice-claude` (8f91d59) | Claude's earlier submissions, frozen |
| `engineering/launch-validation` (6fe64f7) | Launch engine, merged into integration as a labelled preview |
| `experience/consolidated-review` (9d5d1e9) · `site/v12-growth` (56303cb) | Existing review candidate and fallback, untouched |

No production merge or publish without the owner's approval.

## Run it in any browser (no AI host)
```sh
python3 -m http.server 8000      # from the repo root; any static server works
# open http://localhost:8000/  ·  /experience/#performance  ·  /articles/traction-circle/
node --test engine/test/*.test.mjs _build/experience/*.test.mjs   # 120 checks, Node 22+
PYTHONDONTWRITEBYTECODE=1 python3 _build/build.py                 # regenerate pages after editing _build/
```
- **Plain static site:** ES modules, no build step, no runtime dependencies, no network calls, no host APIs.
- **State** lives in the browser's own storage (below).
- **file:// does not work:** browsers block ES modules there, so serve over HTTP.
- **Analytics:** the only third-party request is the site's existing Google Analytics tag. The private previews strip it.

## Source of truth for pages
- **Generated pages:** the homepage, articles, tools, plan, build, about, privacy and grip are generated from `_build/` (`build.py` shell, `home.py` homepage, `pages.py` routes, `content/*.html` bodies). Edit there, then rebuild.
- **Hand-made pages:** `weight-distribution-calculator/` and `experience/` are edited directly.
- **The shared shell (`build.py`) adds to every page:**
  - `assets/ess-identity.css`
  - the theme colour
  - the footer brand line
  - the journey band on articles, tools and plan

## Work's presentation package (applied)
- **Where it comes from:** Work's package "Speed you can explain." (ess-knowledge `presentation/ess` @ `bbe647d`) is applied by default.
  - Assets: `assets/ess-presentation/` (`ess-system.css`, `ess-claude-adapter.css`, mark, self-hosted Open Sans Condensed, Palouse illustration).
  - Template transforms: `_build/presentation.py`, a port of Work's `prepare-preview.py` (homepage messaging, article rail and experiment order, calculator layout).
  - The Lab and the weight-distribution calculator load the same CSS directly.
- **Update path:** copy Work's new assets into `assets/ess-presentation/`, replace the transforms in `presentation.py`, and rebuild. No functional code changes.
- **Switch:** `ESS_BRAND=none python3 _build/build.py` builds with Claude's base identity layer only. The Lab and the weight-distribution calculator are hand-edited, so remove their three presentation lines and the `data-ess-brand` attribute by hand.
- **Configuration conditions:** the configuration now carries `conditions {tire, surface, customMu}` (`models.cleanConditions`). They travel to Use, Garage, Compare, Build and links (Work QA finding, fixed in 29a5a4d).

## Presentation layer: what Work can replace freely
- `assets/ess-identity.css` holds the tokens (`--ig-*`, mapped onto the older `--ess-*`) and all component styling.
  - Replace or override the whole file. Loading a Work stylesheet after it is the intended path.
- Fonts live in `assets/fonts/` (OFL, self-hosted).
- Copy: page titles and ledes in `_build/`, `experience/performance-view.mjs` headings, and `experience/journey.mjs` `plans[*].title/copy`.
- Markup classes prefixed `ig-`, `gc-` and `perf-`: restyle freely. Renaming one needs the same rename in the renderer (pure string functions, listed below).

## Hooks JavaScript depends on (keep, or change the JS together)
| Hook | Meaning |
|---|---|
| `[data-open-catalog][data-vehicle-key]` | Opens the vehicle chooser; `ess:vehicle-selected` event `{id, template}` |
| `[data-ess-vehicle]`, `[data-lab-root]` | Vehicle panel on articles and calculators (`search-bridge.mjs`) |
| `[data-ess-journey="<key>"]` | Journey band mount; keys in `journey.mjs` `plans` |
| `[data-home-vehicle]`, `[data-home-live]`, `[data-home-circles]` | Homepage chooser, live gear chart, tire-circle figure |
| `[data-ig-circles]` | Article figure from the tire model |
| `[data-perf-gear]`, `[data-axle-ratio]`, `[data-perf-tire]`, `[data-perf-surface]`, `[data-perf-fd]`, `[data-perf-mu]`, `[data-perf-ref]`, `[data-perf-pick-tire]`, `[data-perf-apply-tire]`, `[data-perf-reset]`, `[data-perf-use]`, `[data-perf-share]`, `[data-component]` | Gearing-and-traction controls (`app.mjs`) |
| `#perf-summary`, `#perf-traction`, `#perf-tires`, `#perf-feedback`, `#perf-next`, `#perf-launch`, `.perf-sticky` | Live-update regions |
| `data-level="green\|yellow\|red\|missing"` | Status. Always shown with a word too: never colour alone |

## Renderers (pure functions returning HTML strings, safe to restyle)
- **`experience/identity.mjs`:**
  - `mark()`
  - `tree(status)`: starting lights
  - `lamp()`
  - `useBar()`
  - `slip()`
  - `gearChart(rows, {selected, interactive, compact})`: byGear share of grip, 0–200%, common 100% line
- **`experience/performance-view.mjs`:**
  - `perfModel(setup, perf)`: all page numbers. **Engineering, do not change**
  - section renderers
  - `nextSteps()`
  - `launchPanelHtml()`
  - `shareSummary()`
- **`experience/journey.mjs`:** `experiments(key, setup)` (model runs) and `journeyHtml()`
- **`experience/identity-figures.mjs`:** live card, tire circles, `finding()` sentence

## Engineering APIs consumed (shared `engine/`, owned by Claude engineering)
- `acceleration.mjs`: `straightLine`, `tractionLimit`, `torqueAt`, `launchSettings`, `wheelRpm`
- `traction.mjs` (PR #16): `tractionCheck`, `byGear`, `compareTires`, `frictionFor`, `tireClasses`, `surfaces`
- `launch.mjs` (launch-validation, **preview**): `runPreset`, `timeLost`, `presets`
- `loads.mjs`, `garage-adapter.mjs`, `resolve.mjs`, `archive.mjs`: through `experience/models.mjs` and `vehicles.mjs`

UI code never re-implements physics. New capabilities enter through `engine/` with tests, then a renderer.

## URL and share contract (reproducible, privacy-safe)
- **Views:** `experience/#home|build|compare|tools|garage|suspension|learn|performance|performance-why|performance-math`
- **Shared experiment:** `experience/#v2/<view>/<base64url JSON>` with:
  - lanes `a..d` plus `aMode..dMode`
  - `focus`
  - optional `event`
  - optional `tool`
  - optional **`perf`** `{tire, surface, customMu, gear}`, new: links now carry the tire and surface
- **Validation:** done on read (`configuration.readFragment`, `performance-view.cleanPerf`). An invalid link falls back with a notice.
- **Privacy:** opening a link never writes the recipient's active car or garage. Links hold only the configuration values a person chose; there is no account and no private build data.

## Browser storage (per browser, opt-in by action)
| Key | Holds |
|---|---|
| `ess.active-configuration.v1` (local) | The car carried across pages ("Use this configuration", vehicle panels) |
| `ess.garage.v1` (local) | Saved variants (Save to My Garage) |
| `ess.vehicle-build.v1` (local) | Legacy saved build |
| `ess.lab-session.v1` (session) | Open experiment in this tab |
| `ess.performance-page.v1` (session) | Tire, surface and gear on the gearing page (restored after visiting an article) |

## Adding a model-driven next experiment to a page
1. Add a key to `journey.mjs` `plans`: reference car, generators (`gearing`, `tire`, `weight`, `seats`, `cg`, `engine`), title and copy.
2. Mount it: the generator does this automatically for articles, tools and plan. For a hand-made page, add `<section class="ig-journey" data-ess-journey="key" data-lab-root="…/experience/">` and `journey.mjs`.
3. Each experiment is a model run. Its "Try it" link opens the Lab with the change applied, and the tests check that the link reproduces the advertised time.
