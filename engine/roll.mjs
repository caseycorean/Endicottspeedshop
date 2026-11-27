// ESS engineering library — roll stiffness, roll-stiffness split and roll-centre heights. Claude sprint, 26 Nov 2026.
// Pure functions, no DOM. Units: lb, in, deg, g.
//
// Why: the Load Transfer calculator's fixed defaults (60 % front roll stiffness, roll centres 2 in front / 12 in rear)
// describe a live-axle muscle car. Applied to every car, they put 12 in of rear roll centre under independent rears
// and 60 % front roll stiffness under rear-heavy cars, so the steady-state cornering limit (engine/cornering.mjs)
// named the REAR axle as the limit for all 19 skidpad cars — production cars are set up to push. This module gives
// callers a per-car setup to pass to corneringLimit / tireLoads, in order of evidence:
//   1. spring + anti-roll-bar (+ tire) roll stiffness, when the car's springs are real data or the caller asks;
//   2. otherwise the architecture estimate: roll centres by suspension type, front share = weight share + 5 %.
// Defaults elsewhere are unchanged: this is opt-in (corneringLimit(v, rollSetup(v))).
//
// Roll stiffness of one axle (lb·in/rad), springs at the wheels (wheel rate k_w, lb/in per side) and track t (in):
//   K_springs = k_w · t² / 2.  An anti-roll bar given as its wheel rate in roll k_b (lb/in at each wheel, opposite
//   wheel moving the other way) adds k_b · t² / 2. The tire acts in series: K_tire = k_t · t² / 2,
//   K_axle = K_susp · K_tire / (K_susp + K_tire). (Milliken & Milliken, RCVD ch. 16; Gillespie, Fundamentals of
//   Vehicle Dynamics ch. 9.) Roll gradient (deg/g) = W · (h − h_roll axis) / (K_f + K_r), K in lb·in/deg.

export const ROLL_CENTER_IN = {
  // Typical static roll-centre heights above ground (in). Textbook ranges (Milliken RCVD ch. 17; Gillespie ch. 9):
  // short/long arm 0.5–4, strut 1–5, live axle at about the axle/locator height (10–14), independent rears 2–6.
  // ESS ESTIMATES; a measured or geometry-derived value replaces them.
  front: { sla: 2, strut: 3, multilink: 2.5, twinIBeam: 4, solidAxle: 13 },
  rear: { leaf: 11, truckArm: 12, threeLink: 12, fourLinkParallel: 12, fourLinkTriangulated: 12, fiveLink: 12, torqueArm: 12,
    irsControlArm: 4, irsMultilink: 4, semiTrailing: 5, irsStrut: 4 },
};
/** The Load Transfer calculator's fixed defaults (what corneringLimit uses when no setup is passed). */
export const CALCULATOR_DEFAULTS = { frontRoll: .6, frontCenter: 2, rearCenter: 12 };

const RAD = 180 / Math.PI;
const fin = Number.isFinite;
const series = (a, b) => (fin(b) && b > 0 ? a * b / (a + b) : a);

/**
 * Roll stiffness from springs, bars and tires.
 * Inputs (per axle): frontTrack/rearTrack (in); frontSpring/rearSpring (lb/in at the spring) with
 * frontMotion/rearMotion (spring travel ÷ wheel travel), or frontWheelRate/rearWheelRate (lb/in) directly;
 * optional frontBar/rearBar = anti-roll bar wheel rate in roll (lb/in at each wheel); optional tireRate (lb/in).
 * Returns {front, rear} in lb·ft/deg, frontRoll share, and gradient (deg/g) when weight, cg and centres are given.
 */
export function rollStiffness(v, { frontCenter, rearCenter } = {}) {
  const wheel = axle => fin(v[`${axle}WheelRate`]) ? v[`${axle}WheelRate`]
    : fin(v[`${axle}Spring`]) && fin(v[`${axle}Motion`]) ? v[`${axle}Spring`] * v[`${axle}Motion`] ** 2 : NaN;
  const axle = name => {
    const t = v[`${name}Track`], kw = wheel(name), kb = fin(v[`${name}Bar`]) ? v[`${name}Bar`] : 0;
    if (!fin(t) || !fin(kw)) return NaN;
    const susp = (kw + kb) * t * t / 2, tire = fin(v.tireRate) ? v.tireRate * t * t / 2 : NaN;
    return series(susp, tire) / RAD; // lb·in/deg
  };
  const f = axle('front'), r = axle('rear');
  if (!fin(f) || !fin(r) || f + r <= 0) return null;
  const out = { front: f / 12, rear: r / 12, frontRoll: f / (f + r), bars: fin(v.frontBar) || fin(v.rearBar) };
  if (fin(v.weight) && fin(v.cg) && fin(frontCenter) && fin(rearCenter)) {
    const rearShare = (v.rearLb ?? v.weight * (1 - v.front)) / v.weight;
    const axis = frontCenter + (rearCenter - frontCenter) * rearShare;
    out.gradient = v.weight * (v.cg - axis) / (f + r); // deg per g
  }
  return out;
}

/** Architecture estimate: roll centres by suspension type; front roll share = front weight share + 0.05 (0.45–0.75). */
export function rollEstimate(v) {
  const front = v.frontLb ? v.frontLb / v.weight : v.front;
  return {
    frontRoll: Math.min(.75, Math.max(.45, front + .05)),
    frontCenter: ROLL_CENTER_IN.front[v.archFront] ?? 2,
    rearCenter: ROLL_CENTER_IN.rear[v.archRear] ?? (v.drivetrain === 'FWD' ? 5 : 8),
    estimated: true,
  };
}

/**
 * The best roll setup ESS has for a car, ready to pass to corneringLimit / tireLoads.
 * Springs are used for the split only when they are data (evidence !== 'estimate' / 'estimated') or options.fromSprings,
 * or when bar rates are given — ESS's archive springs are mostly ride-frequency estimates, and springs without bars
 * understate front roll stiffness on almost every production car.
 * options.frontRoll / frontCenter / rearCenter override (measured values).
 * Returns {frontRoll, frontCenter, rearCenter, basis: {split, centers}, gradient?, stiffness?}.
 */
export function rollSetup(v, options = {}) {
  const est = rollEstimate(v);
  const centers = { frontCenter: fin(options.frontCenter) ? options.frontCenter : est.frontCenter,
    rearCenter: fin(options.rearCenter) ? options.rearCenter : est.rearCenter };
  const centerBasis = fin(options.frontCenter) && fin(options.rearCenter) ? 'given'
    : (ROLL_CENTER_IN.front[v.archFront] != null && ROLL_CENTER_IN.rear[v.archRear] != null) ? 'architecture estimate' : 'generic estimate';
  const estimatedSprings = ['frontSpring', 'rearSpring'].some(k => /^estimate/.test(v.evidence?.[k] ?? ''));
  const useSprings = options.fromSprings || fin(v.frontBar) || fin(v.rearBar) || (v.evidence && !estimatedSprings && options.fromSprings !== false);
  const stiff = rollStiffness(v, centers);
  if (fin(options.frontRoll)) return { frontRoll: options.frontRoll, ...centers, basis: { split: 'given', centers: centerBasis }, ...(stiff ? { stiffness: stiff } : {}) };
  if (useSprings && stiff) return { frontRoll: stiff.frontRoll, ...centers, basis: { split: stiff.bars ? 'springs, bars and tires' : 'springs and tires only (no bar data)', centers: centerBasis }, gradient: stiff.gradient, stiffness: stiff };
  return { frontRoll: est.frontRoll, ...centers, basis: { split: 'estimate: front weight share + 5 %', centers: centerBasis } };
}

/**
 * Anti-roll-bar wheel rate in roll (lb/in at each wheel) for a solid round or tubular bar: k = G·J / (L_t · a²) at
 * the arm end, then × (motion ratio)² to the wheel. G = 11.5e6 psi (steel); J = π(D⁴ − d⁴)/32; armIn = lever arm
 * length (in); lengthIn = active torsional length (in); motion = bar-end travel ÷ wheel travel. Ignores bushing and
 * arm bending compliance (real bars are typically 10–30 % softer). Illustrative; a measured rate replaces it.
 */
export function barWheelRate({ diameterIn, wallIn = null, lengthIn, armIn, motion = 1 }) {
  const D = diameterIn, d = wallIn ? Math.max(0, D - 2 * wallIn) : 0;
  const J = Math.PI * (D ** 4 - d ** 4) / 32;
  const torsional = 11.5e6 * J / lengthIn; // lb·in/rad
  // In roll the wheels move ±z, the arm ends ±z·m, so the bar twists θ = 2zm/a and pushes each arm end with
  // F = K_t·θ/a; at the wheel that is F·m = 2·K_t·m²·z/a². Per-wheel rate in roll k_b = 2·K_t·m²/a², which gives
  // K_bar = k_b·t²/2, the same convention as the springs in rollStiffness.
  return 2 * torsional * motion * motion / (armIn * armIn);
}
