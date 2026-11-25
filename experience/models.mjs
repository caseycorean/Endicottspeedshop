import { fields, stock, vehicles } from './vehicles.mjs';
import { components, componentOverrides } from './components.mjs';

export const G = 32.174;
export const FT_PER_MILE = 5280;
export const MPH = FT_PER_MILE / 3600;
const G_IN = G * 12;
const AIR_DENSITY = .002377; // slugs/ft³ at standard sea-level conditions
const ROLL_RESISTANCE = .015;
const DRIVELINE = .85;
const SHIFT_SECONDS = .30;
export const choices = {drivetrain: ['RWD', 'FWD', 'AWD'], transmission: ['manual', 'automatic']};

export const limits = {
  weight: [1000, 9000], front: [0.25, 0.75], wheelbase: [75, 160],
  frontTrack: [42, 90], rearTrack: [42, 90], cg: [8, 34],
  hp: [35, 1500], torque: [35, 1350], hpRpm: [2000, 10000], torqueRpm: [1100, 9500],
  redline: [2600, 11500], finalDrive: [2, 6], diameter: [20, 35], grip: [.35, 1.4], cda: [3, 20],
  frontSpring: [40, 2000], rearSpring: [40, 2000], frontMotion: [.25, 1.5],
  rearMotion: [.25, 1.5], frontUnsprung: [0, 300], rearUnsprung: [0, 300], tireRate: [500, 4000],
};

export const presets = {
  seats: { label: 'Remove Firebird rear seats', firebird: true,
    note: '17.5 lb back + 5.5 lb bottom, measured by ESS. Location estimated at 76 in behind the front axle.',
    oldWeight: 23, oldX: 76, newWeight: 0, newX: 76 },
  radiator: { label: 'Fit Firebird aluminum radiator', firebird: true,
    note: '31 lb drained stock radiator → 11 lb dry aluminum. Center estimated 16 in ahead of the front axle.',
    oldWeight: 31, oldX: -16, newWeight: 11, newX: -16 },
  ballast: { label: 'Move 40 lb rearward',
    note: 'Illustrative component relocation from 18 in to 90 in behind the front axle.',
    oldWeight: 40, oldX: 18, newWeight: 40, newX: 90 },
  remove: { label: 'Remove 50 lb from rear cabin',
    note: 'Common hypothetical deletion for comparing platforms. Position is 70% of the wheelbase.',
    oldWeight: 50, oldX: 0, newWeight: 0, newX: 0 },
  driveline: { label: 'Model measured LS1/T5 package', firebird: true,
    note: 'ESS measured the dressed LS1/T5 at 558 lb, plus 50 lb for the GTO clutch and flywheel. Enter the removed package weight and its location. Engine output and gear overrides are entered separately.',
    oldWeight: 0, oldX: 18, newWeight: 608, newX: 18, requiresOld: true },
};

const between = (x, low, high) => Number.isFinite(x) && x >= low && x <= high;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);

export function validValue(key, value) {
  if (Object.hasOwn(choices, key)) return choices[key].includes(value);
  if (key === 'gears') {
    return Array.isArray(value) && between(value.length, 2, 10) &&
      value.every((n, i) => between(n, .3, 7) && (!i || n < value[i - 1]));
  }
  return Object.hasOwn(limits, key) && between(value, ...limits[key]);
}

export function cleanSetup(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || !Object.hasOwn(vehicles, raw.id) ||
      !isObject(raw.base) || !isObject(raw.tune) || !Array.isArray(raw.parts) || raw.parts.length > 8) return null;
  if (raw.name !== undefined && (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 36)) return null;
  const setup = { id: raw.id, base: {}, tune: {}, parts: [], ...(raw.name ? {name: raw.name.trim()} : {}) };
  if (raw.components !== undefined) {
    if (!isObject(raw.components)) return null;
    setup.components = {};
    for (const [kind, id] of Object.entries(raw.components)) {
      if (!Object.hasOwn(components, kind) || typeof id !== 'string' || !Object.hasOwn(components[kind], id)) return null;
      setup.components[kind] = id;
    }
  }
  for (const section of ['base', 'tune']) {
    for (const [key, value] of Object.entries(raw[section])) {
      if (!validValue(key, value)) return null;
      setup[section][key] = Array.isArray(value) ? [...value] : value;
    }
  }
  for (const part of raw.parts) {
    if (!isObject(part) || typeof part.label !== 'string' || !part.label.trim() || part.label.length > 60 ||
        !between(part.oldWeight, 0, 1800) || !between(part.newWeight, 0, 1800) ||
        !between(part.oldX, -75, 220) || !between(part.newX, -75, 220) ||
        (part.preset !== undefined && !Object.hasOwn(presets, part.preset))) return null;
    // Validate the stored numbers, even when the operation began as a preset.
    const { label, oldWeight, oldX, newWeight, newX, preset } = part;
    setup.parts.push({ label, oldWeight, oldX, newWeight, newX, ...(preset ? {preset} : {}) });
  }
  return setup;
}

export function newSetup(id) {
  return { id, base: {}, tune: {}, parts: [] };
}

export function resolve(setup, modified = true) {
  const original = { ...stock(setup.id), ...setup.base };
  if (!modified) return axleWeights(original);
  const tuned = { ...original, ...componentOverrides(setup), ...setup.tune };
  // An explicit tuned mass/balance is the starting condition before itemized modifications.
  const { weight, front, wheelbase } = tuned;
  if (![weight, front, wheelbase].every(Number.isFinite)) return axleWeights(tuned);
  const startMoment = weight * (1 - front) * wheelbase;
  let total = weight;
  let moment = startMoment;
  for (const p of setup.parts) {
    total += p.newWeight - p.oldWeight;
    moment += p.newWeight * p.newX - p.oldWeight * p.oldX;
  }
  const center = moment / total;
  return axleWeights({ ...tuned, weight: total, front: 1 - center / wheelbase });
}

function axleWeights(v) {
  if (![v.weight, v.front, v.wheelbase].every(Number.isFinite)) return {...v, frontLb: null, rearLb: null, cgX: null};
  const frontLb = v.weight * v.front;
  return { ...v, frontLb, rearLb: v.weight - frontLb, cgX: (1 - v.front) * v.wheelbase };
}

export function massIssue(v) {
  if (![v.weight, v.front, v.wheelbase].every(Number.isFinite))
    return 'Add weight, front share and wheelbase to calculate axle movement and balance.';
  if (!Number.isFinite(v.weight) || v.weight <= 0 || v.frontLb <= 0 || v.rearLb <= 0)
    return 'The calculated center of gravity falls outside the axles, or the vehicle has no remaining weight.';
  if (!between(v.weight, ...limits.weight) || !between(v.front, ...limits.front))
    return 'The calculated mass or axle split is outside the prototype model range.';
  return '';
}

export function usableSetup(setup) {
  const result = resolve(setup);
  if ([result.weight, result.front, result.wheelbase].some(x => x == null)) return setup.parts.length === 0;
  return !massIssue(result);
}

// Same longitudinal and elastic + geometric lateral terms as the ESS Load Transfer Calculator.
export function tireLoads(v, brake, lateral, { frontRoll = .6, frontCenter = 2, rearCenter = 12 } = {}) {
  if (massIssue(v)) return {tires: [null, null, null, null], invalid: true, missing: true};
  const longitudinal = v.weight * v.cg * brake / v.wheelbase;
  const rollAxis = frontCenter + (rearCenter - frontCenter) * (1 - v.front);
  const elastic = v.cg - rollAxis;
  const dF = lateral * (v.weight * elastic * frontRoll + v.frontLb * frontCenter) / v.frontTrack;
  const dR = lateral * (v.weight * elastic * (1 - frontRoll) + v.rearLb * rearCenter) / v.rearTrack;
  const f = (v.frontLb + longitudinal) / 2;
  const r = (v.rearLb - longitudinal) / 2;
  const tires = [f + dF, f - dF, r + dR, r - dR];
  return { tires, longitudinal, lateral: dF + dR, invalid: tires.some(x => x <= 0) || elastic <= 0 };
}

// Equivalent to the existing ESS Spring Rate & Ride Frequency calculator at zero spring angle.
export function ride(v, axle) {
  if (!Number.isFinite(v[axle + 'Lb'])) return {wheel: null, rate: null, sprung: null, hz: null};
  const sprung = v[axle + 'Lb'] / 2 - v[axle + 'Unsprung'];
  const wheel = v[axle + 'Spring'] * v[axle + 'Motion'] ** 2;
  const rate = wheel * v.tireRate / (wheel + v.tireRate);
  return { wheel, rate, sprung, hz: sprung > 0 ? Math.sqrt(rate * G_IN / sprung) / (2 * Math.PI) : null };
}

export function powerIssue(v) {
  const required = ['hp','hpRpm','torque','torqueRpm','redline','gears','finalDrive','diameter','drivetrain','transmission'];
  const absent = required.filter(key => !validValue(key, v[key]));
  if (absent.length) return 'Add or review these specifications in Build: ' + absent.map(key => fields[key]).join(', ') + '.';
  if (v.torqueRpm >= v.hpRpm || v.hpRpm >= v.redline ||
      v.hp * 5252 / v.hpRpm > v.torque * 1.015 || v.torque * v.torqueRpm / 5252 > v.hp * 1.015)
    return 'Check torque, horsepower and RPM. This model needs a torque peak below the power peak, with mutually consistent peak ratings and a higher shift RPM.';
  return '';
}

function torqueCurve(v, rpm) {
  const atPower = v.hp * 5252 / v.hpRpm;
  const anchors = [
    [1000, v.torque * .68], [v.torqueRpm, v.torque],
    [v.hpRpm, atPower], [v.redline, .88 * v.hp * 5252 / v.redline],
  ];
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

export function driveResistance(v, speed) {
  return ROLL_RESISTANCE * v.weight + .5 * AIR_DENSITY * v.cda * speed ** 2;
}

export function tractiveLimit(v, resistance) {
  // Nrear = static rear + (Fdrive − resistance) * h / L. Solve Fdrive ≤ μ Nrear.
  const ratio = v.cg / v.wheelbase;
  const frontLift = v.frontLb / ratio + resistance;
  if (v.drivetrain === 'FWD') {
    const frontGrip = v.grip * (v.frontLb + resistance * ratio) / (1 + v.grip * ratio);
    return Math.max(0, Math.min(frontGrip, frontLift));
  }
  if (v.drivetrain === 'AWD') return Math.max(0, Math.min(v.grip * v.weight, frontLift));
  const rearGrip = v.grip * (v.rearLb - resistance * ratio) / (1 - v.grip * ratio);
  return Math.max(0, Math.min(rearGrip, frontLift));
}

function wheelSpeedRpm(v, speed, gear) {
  return speed * 60 * v.gears[gear] * v.finalDrive / (Math.PI * v.diameter / 12);
}

export function driveForce(v, speed, gear, launch = false) {
  const coupled = wheelSpeedRpm(v, speed, gear);
  const automaticLaunch = launch && v.transmission === 'automatic';
  const rpm = Math.max(launch ? (automaticLaunch ? 2200 : 1800) : 1000, coupled);
  // Simplified launch converter: illustrative stall multiplication fades into coupling.
  const multiplication = automaticLaunch ? 1 + .65 * Math.max(0, 1 - coupled / 2400) : 1;
  const radius = v.diameter / 24;
  return torqueCurve(v, rpm) * v.gears[gear] * v.finalDrive * DRIVELINE * multiplication / radius;
}

export function straightLine(v, { dt = .02, distance = 1320, maxTime = 45 } = {}) {
  const issue = massIssue(v) || powerIssue(v);
  if (issue) return { issue };
  const initial = { t: 0, speed: 0, x: 0, gear: 1, g: 0, limited: false };
  const trace = [initial];
  let gear = 0;
  let shift = 0;
  let zeroTo60 = null;
  let finish = null;
  let prior = initial;
  for (let i = 1; i <= maxTime / dt; i++) {
    const speedRpm = wheelSpeedRpm(v, prior.speed, gear);
    if (shift <= 0 && gear < v.gears.length - 1 && speedRpm >= v.redline - 50) {
      gear++;
      shift = v.transmission === 'automatic' ? .18 : SHIFT_SECONDS;
    }
    const resistance = driveResistance(v, prior.speed);
    const cap = tractiveLimit(v, resistance);
    const available = shift > 0 ? 0 : driveForce(v, prior.speed, gear, gear === 0);
    const netG = (Math.min(available, cap) - resistance) / v.weight;
    const speed = Math.max(0, prior.speed + netG * G * dt);
    const sample = {
      t: i * dt, speed, x: prior.x + (prior.speed + speed) * dt / 2,
      gear: shift > 0 ? 0 : gear + 1, g: netG, limited: available > cap,
    };
    if (shift > 0) shift -= dt;
    if (zeroTo60 === null && speed >= 60 * MPH) {
      zeroTo60 = prior.t + dt * (60 * MPH - prior.speed) / (speed - prior.speed);
    }
    if (sample.x >= distance) {
      const fraction = (distance - prior.x) / (sample.x - prior.x);
      const trap = (prior.speed + fraction * (speed - prior.speed)) / MPH;
      finish = { t: prior.t + fraction * dt, trap };
      trace.push({ ...sample, t: finish.t, x: distance, speed: trap * MPH });
      break;
    }
    trace.push(sample);
    prior = sample;
  }
  return { trace, zeroTo60, finish, maxSpeed: Math.max(...trace.map(s => s.speed)) / MPH };
}

export function atTime(run, t) {
  const trace = run.trace;
  if (t <= 0) return trace[0];
  if (t >= trace.at(-1).t) return trace.at(-1);
  let low = 0;
  let high = trace.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (trace[middle].t <= t) low = middle;
    else high = middle;
  }
  const a = trace[low];
  const b = trace[high];
  const f = (t - a.t) / (b.t - a.t);
  return { ...a, t, speed: a.speed + f * (b.speed - a.speed), x: a.x + f * (b.x - a.x) };
}

// Front-view teaching model. The lower joint stays fixed as the top moves horizontally.
export function camberIllustration(offset, height = 10) {
  const x = Math.min(1, Math.max(-1, offset));
  return Math.atan2(x, height) * 180 / Math.PI;
}


export function tractionReadout(v) {
  if (massIssue(v) || powerIssue(v)) return null;
  const resistance = driveResistance(v, 0);
  const demand = driveForce(v, 0, 0, true);
  const limit = tractiveLimit(v, resistance);
  if (limit <= 0) return null;
  const utilization = demand / limit;
  const net = Math.min(demand, limit) - resistance;
  return {demand, limit, utilization, rear: v.rearLb + net * v.cg / v.wheelbase,
    mphInFirst: v.redline / wheelSpeedRpm(v, MPH, 0),
    cruiseRpm: wheelSpeedRpm(v, MPH * 70, v.gears.length - 1),
    color: utilization > 1 ? 'red' : utilization > .85 ? 'yellow' : 'green'};
}
