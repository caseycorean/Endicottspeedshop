# ESS identity proposal: "Proving Ground"

Claude, visual-identity slice, 25 Nov 2026. This is a proposal on branch `experiment/visual-identity-claude`, not an approved brand.
It is applied on three pages: the homepage, the Vehicle Lab (including Gearing and traction), and the traction-circle article.

## Idea
ESS is a speed shop that measures. The site behaves like a drag-strip timing system and an engineer's test sheet.
- **Results print as timeslips.**
- **Traction status shows as the starting-light tree.** Green means grip to spare, amber means on the edge, red means wheelspin likely.
- **The mark is the traction circle.** It is the grip limit with axes, and an amber dot (the demand) sitting on the limit.

## Words
| Role | Text | Note |
|---|---|---|
| Brand line | **Measure. Test. Improve.** | Kept (owner-approved). Eyebrow, footer sign, slip |
| Visitor invitation | **Your car. Your experiment.** | Kept (owner-approved) |
| Hero promise (proposed) | **Run it before you buy it.** | Replaces "Build it. Then prove it." (owner disliked). Names the concrete value: try a gear, tire or part in the model before paying for it. Reversible: one string |
| Status words | Grip to spare · On the edge · Wheelspin likely · Needs data | Colour is never the only signal |

## Palette
| Token | Hex | Use |
|---|---|---|
| Asphalt | `#1b1e1a` | Header, hero and run bands, footer (dominant dark; evolves the approved olive-charcoal) |
| Paper | `#f3eee3` | Page ground (approved ivory) |
| Card / Slip | `#fffcf4` / `#fbf8ef` | Panels / timeslip stock |
| Staging amber | `#f2a81d` | The one accent: mark dot, primary button, header rule, focus on dark (evolves the muted gold) |
| Amber ink | `#8a5400` | Amber text on paper (≥ 4.5:1) |
| Tree green / amber / red | `#2fae5b` · `#f2a81d` · `#e0452b` | Status only. Ink variants `#1b7339` · `#8a5400` · `#b02e1a` for text |

## Type (self-hosted, OFL, subset WOFF, ~160 KB total, no third-party requests)
- **Anton**: headlines, uppercase, like a timing board or poster. h1 clamp 2.5–6 rem, line-height ≈ 1.
- **Fira Sans**: all reading and UI text, 17 px base, 400/600/700.
- **Anonymous Pro**: printed slip figures only, with tabular figures.

## Components (`assets/ess-identity.css`, `experience/identity.mjs`)
- **Header:** asphalt with a 3 px amber rule; mark plus ENDICOTT / SPEED SHOP. The site and Vehicle Lab now share one look.
- **Timeslip (`slip()`):** perforated paper, label and value rows, a large first row, and a footer naming the conditions (tire, surface).
- **Tree (`tree()`), lamp (`lamp()`):** status lights with a word beside them.
- **Use bar (`useBar()`):** drive force as a share of grip. The black line is 100% (all the grip). There is a grey band for the uncertainty range, and the bar is capped at 200%.
- **Force rows:** "Drivetrain sends" bar vs "Tires can take" band with a typical tick, plus pound values.
- **Run band:** an asphalt grid band holding the slip, the tree and one sentence that reads the result.
- **Feedback line:** under the controls, it states the result of the last change.
- **Next experiment:** up to three one-step changes. Each is a real model run, ranked by modelled time change, and applies with one tap.
- **Path card:** icon, condensed title and one line, with a 6 px asphalt edge that turns amber on hover.

## Article pattern
- Amber-ruled lede.
- Asphalt "key idea" callouts carrying the mark.
- Figures drawn from engine data, with honest captions.
- Interactive lab in a card.
- A closing "Try it on a car" band that shows a live slip and a finding for the visitor's active car, then leads to the tool.

## Rules
- Every number shown comes from the shared engine. Figures say what they are (class estimates, ranges).
- Colour plus a word for status. Touch targets ≥ 44 px. No sideways scroll at 320 px.
- Dark bands are for things that are running (results, live data); paper is for reading and controls.
