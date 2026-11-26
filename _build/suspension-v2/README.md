# Suspension V2 (private preview, not linked from the site)

Page: `suspension-v2/` (noindex, no analytics, not in the sitemap). Branch `experience/suspension-v2`, based on the
preserved integrated site `integration/ess-candidate-a` e4e02f8 (checkpoint branch `checkpoint/ess-candidate-a-2026-11-26`).
**No existing file is changed**: the current Lab suspension, `engine/suspension.mjs` and the rear link lab are untouched.

## Files
- `engine/linkage.mjs` — planar corner solver (SLA, strut; front view and independent-rear view). Continuation from ride
  height on the original assembly branch, verified link lengths, classified results, ride-height change.
- `engine/axle-links.mjs` — live-axle 3-D rigid-link solver with continuation; distinguishes exact layouts (fit / lock-up /
  solver failure) from over-constrained ones (bind amount, i.e. bushing deflection needed).
- `experience/suspension-v2/` — `model.mjs` (architectures, generic presets, state, share links), `draw.mjs` (all
  drawings and charts), `app.mjs` (behaviour), `suspension-v2.css`, generated `vehicle-architectures.mjs`.
- Tests: `engine/test/linkage.test.mjs`, `engine/test/axle-links.test.mjs`, `_build/suspension-v2/model.test.mjs`.

## The front defect (owner, 26 Nov)
`slaAt` scans lower-arm angle for any sign change of (wheel-centre height − target), bump side first, and picks the
upper ball joint as the circle solution nearest the *static* joint. With an edited upper ball joint the scan crosses onto
the other assembly branch, the height jumps across the target and bisection lands on the jump. Reproduced: upper ball
joint (28, 19), −0.1 in → −18.9 in track change, 175° camber, 68.6 in roll center. V2: +0.01 in, −0.39°, 5.4 in.
Also corrected in V2: with parallel arms the roll center follows the arm slope (old code returned 0).

## Result classes
Valid · Valid, worth checking (explained notes: steep roll-center movement, positive camber gain, scrub, ball-joint
angle, near a limit, roll center extremely sensitive) · Mechanical limit (links cannot assemble, toggle, end of arc,
arms collide, upright inverts, ball joint > 45°) · Not a buildable layout (editing stays open) · Solver failure (answer
fails re-measurement; withheld). Travel controls clamp to the reachable range; charts hatch what cannot be reached.

## Known limits
Planar views only for independent corners (no toe, caster, steering; front top view is orientation-only). Leaf, truck
arm, semi-trailing, Twin I-Beam and solid front axle are illustrations only. Multilink is an equivalent SLA (stated).
Tire at constant loaded radius. Live-axle bushings rigid except the reported bind. All hardpoints are generic examples.
