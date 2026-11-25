// Modified-versus-original explanation for one comparison lane (Claude integration, 25 Nov 2026).
// Pure function so the wording can be tested without a browser.
import { fmt } from './ui.mjs';

const runTime = (run, oval) => oval ? run?.lap : run?.finish?.t;

export function changeFromOriginal(name, original, changed, baseRun, run, oval) {
  const before = runTime(baseRun, oval);
  const after = runTime(run, oval);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  const delta = after - before;
  const event = oval ? 'flying lap' : 'quarter mile';
  const weightDelta = changed.weight - original.weight;
  const rearShareDelta = changed.rearLb / changed.weight - original.rearLb / original.weight;
  let headline;
  if (Math.abs(delta) < .005) headline = `${name}: the modification changes the ${event} by less than 0.01 s.`;
  else headline = `${name}: modified is ${fmt(Math.abs(delta), 2)} s ${delta < 0 ? 'quicker' : 'slower'} than original over the ${event} (${fmt(before, 2)} → ${fmt(after, 2)} s).`;
  let why = '';
  const launchLimited = !oval && changed.drivetrain === 'RWD' && run.trace?.some(s => s.limited && s.gear === 1);
  if (delta > .005 && weightDelta < 0 && rearShareDelta < 0 && launchLimited) {
    why = `Why slower when lighter: the launch is limited by rear-tire grip, and grip-limited acceleration follows the share of weight on the rear tires. This change lowers that share from ${fmt(original.rearLb / original.weight * 100, 1)}% to ${fmt(changed.rearLb / changed.weight * 100, 1)}%.`;
  } else if (oval && weightDelta !== 0) {
    why = 'Turn speed does not change: in this point-mass model it depends only on the grip coefficient. Weight changes the lap through acceleration out of the turns. Real tires usually grip slightly better per pound when lightly loaded; the model leaves that out.';
  }
  return { delta, headline, why };
}
