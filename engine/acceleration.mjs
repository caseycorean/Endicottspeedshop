// ESS engineering library — straight-line acceleration, version 2 (candidate; not yet used by the Vehicle Lab).
// Same vehicle fields as experience/models.mjs (weight, front, wheelbase, cg, hp, hpRpm, torque, torqueRpm,
// redline, gears[], finalDrive, diameter, grip, cda). Differences from the shipped model, each switchable:
//   1. rotating inertia (engine, flywheel, driveline, wheels) — the shipped model treats the car as a sliding block
//   2. clutch-slip launch at a realistic RPM; while the clutch slips the engine's own inertia is not being accelerated
//   3. tire grip defaults by tire type instead of one 0.90 for every car
//   4. results reported both from standstill and with the 1-ft rollout US magazines use
// Units: lb, in, ft, s, mph. Limitations: flat torque-curve shape from four anchor points, constant shift time,
// no tire growth, no wheel hop, no traction control, no torque converter (automatics are approximated as manuals).

const G = 32.174;
const MPH = 5280 / 3600;
const AIR = .002377;

/** Longitudinal grip defaults by tire type: labelled estimates, calibrated on four road tests and checked on three others. */
export const tireGrip = {
  bias: { mu: .75, label: 'Bias-ply street tire (pre-1975)' },
  radial70s: { mu: .85, label: '1970s street radial' },
  perf80s: { mu: .95, label: '1980s–90s performance radial' },
  uhp: { mu: 1.05, label: '2000s ultra-high-performance summer tire' },
  extreme: { mu: 1.10, label: 'Extreme-performance summer tire (C5 Z06 class)' },
  track200: { mu: 1.15, label: '200-treadwear track tire' },
  dragRadial: { mu: 1.4, label: 'Drag radial on a prepped surface' },
};

export const defaults = { driveline: .85, shiftSeconds: .25, rollResistance: .015, inertia: true, rolloutFt: 1, dt: .002 };

export function torqueAt(v, rpm) {
  const atPower = v.hp * 5252 / v.hpRpm;
  const anchors = [[1000, v.torque * .68], [v.torqueRpm, v.torque], [v.hpRpm, atPower],
    [v.redline, .88 * v.hp * 5252 / v.redline]];
  for (let i = 1; i < anchors.length; i++) {
    const [end, high] = anchors[i];
    if (rpm <= end) {
      const [start, low] = anchors[i - 1];
      const t = Math.max(0, (rpm - start) / (end - start));
      return Math.min(low + (high - low) * t, v.hp * 5252 / rpm);
    }
  }
  return 0;
}

/** Gillespie's rule-of-thumb mass factor for an overall ratio N (gear × final drive). */
export const massFactor = overall => 1.04 + .0025 * overall * overall;

/** Rear-drive traction limit (lb) including load transfer: F ≤ μ(Wr + (F − R)h/L), also front-lift capped. */
export function tractionLimit(v, resistance, mu = v.grip) {
  const frontLb = v.weight * v.front;
  const rearLb = v.weight - frontLb;
  const ratio = v.cg / v.wheelbase;
  const rearGrip = mu * (rearLb - resistance * ratio) / (1 - mu * ratio);
  return Math.max(0, Math.min(rearGrip, frontLb / ratio + resistance));
}

export function straightLine(v, options = {}) {
  const o = { ...defaults, launchRpm: Math.min(Math.max(3000, v.torqueRpm), v.redline - 500), distanceFt: 1320,
    maxTime: 45, mu: v.grip, ...options };
  const circumference = Math.PI * v.diameter / 12;
  const radius = v.diameter / 24;
  const engineRpm = (speed, gear) => speed * 60 * v.gears[gear] * v.finalDrive / circumference;
  let gear = 0, shift = 0, speed = 0, x = 0, t = 0;
  let t60 = null, tRollout = null, finish = null, stripFinish = null;
  const time = { traction: 0, engine: 0, clutch: 0, shifting: 0 };
  const trace = [{ t: 0, speed: 0, x: 0, gear: 1, g: 0, limit: 'traction' }];
  let nextSample = .02;
  while (t < o.maxTime) {
    const wheelRpm = engineRpm(speed, gear);
    if (shift <= 0 && gear < v.gears.length - 1 && wheelRpm >= v.redline - 50) { gear++; shift = o.shiftSeconds; }
    const resistance = o.rollResistance * v.weight + .5 * AIR * v.cda * speed * speed;
    const cap = tractionLimit(v, resistance, o.mu);
    const slipping = gear === 0 && wheelRpm < o.launchRpm;
    const rpm = slipping ? o.launchRpm : Math.max(1000, wheelRpm);
    const available = shift > 0 ? 0 : torqueAt(v, rpm) * v.gears[gear] * v.finalDrive * o.driveline / radius;
    let limit = shift > 0 ? 'shifting' : available > cap ? 'traction' : slipping ? 'clutch' : 'engine';
    const force = Math.min(available, cap);
    // Engine and driveline inertia only load the tires when the engine is coupled and below the grip limit.
    const factor = !o.inertia ? 1 : (limit === 'engine' ? massFactor(v.gears[gear] * v.finalDrive) : 1.04);
    const accel = (force - resistance) / v.weight * G / factor;
    const nextSpeed = Math.max(0, speed + accel * o.dt);
    const nextX = x + (speed + nextSpeed) / 2 * o.dt;
    time[limit] += o.dt;
    if (tRollout === null && nextX >= o.rolloutFt) tRollout = t + o.dt * (o.rolloutFt - x) / (nextX - x);
    if (t60 === null && nextSpeed >= 60 * MPH) t60 = t + o.dt * (60 * MPH - speed) / (nextSpeed - speed);
    if (shift > 0) shift -= o.dt;
    t += o.dt;
    if (t >= nextSample) { trace.push({ t, speed: nextSpeed, x: nextX, gear: shift > 0 ? 0 : gear + 1, g: accel / G, limit }); nextSample += .02; }
    // Standstill quarter mile (as the shipped model) and the drag-strip version: timer starts after rollout,
    // then runs a full quarter mile from that point.
    if (!finish && nextX >= o.distanceFt) {
      const f = (o.distanceFt - x) / (nextX - x);
      finish = { t: t - o.dt + f * o.dt, trap: (speed + f * (nextSpeed - speed)) / MPH };
    }
    if (nextX >= o.distanceFt + o.rolloutFt) {
      const f = (o.distanceFt + o.rolloutFt - x) / (nextX - x);
      stripFinish = { t: t - o.dt + f * o.dt, trap: (speed + f * (nextSpeed - speed)) / MPH };
      break;
    }
    speed = nextSpeed; x = nextX;
  }
  const r = tRollout ?? 0;
  return {
    trace, zeroTo60: t60, finish,
    magazine: { zeroTo60: t60 === null ? null : t60 - r, et: stripFinish ? stripFinish.t - r : null,
      trap: stripFinish?.trap ?? null, note: 'Timed after 1 ft of rollout, as US magazines and drag strips report.' },
    time, assumptions: { ...o, mu: o.mu },
  };
}
