import { cleanSetup, newSetup, usableSetup } from './models.mjs';

const savedKey = 'ess.vehicle-build.v1';
export const views = ['home', 'build', 'compare', 'tools', 'learn'];
const maxFragment = 12000;

export const getSaved = () => {
  try {
    const setup = cleanSetup(JSON.parse(localStorage.getItem(savedKey)));
    return setup && usableSetup(setup) ? setup : null;
  } catch {
    return null;
  }
};

export function saveBuild(setup) {
  const valid = cleanSetup(setup);
  if (!valid || !usableSetup(valid)) return false;
  try {
    localStorage.setItem(savedKey, JSON.stringify(valid));
    return true;
  } catch {
    return false;
  }
}

export const example = () => ({
  a: newSetup('firebird'), b: newSetup('mustang'), aMode: 'before', bMode: 'before', focus: 'a',
});

export const modified = s => s.parts.length > 0 || Object.keys(s.tune).length > 0;
export const clone = s => cleanSetup(s);

export function shareFragment(state, view = 'compare') {
  return '#v1/' + view + '/' + encodeURIComponent(JSON.stringify({
    a: state.a, b: state.b, aMode: state.aMode, bMode: state.bMode, focus: state.focus,
    ...(state.event ? { event: state.event } : {}),
    ...(state.tool ? { tool: state.tool } : {}),
  }));
}

export function readFragment(hash) {
  if (hash.length > maxFragment) return { invalid: true, view: 'home' };
  // 'view' routes preserve the current temporary experiment during ordinary navigation.
  const view = hash.startsWith('#') ? hash.slice(1) : 'home';
  if (views.includes(view)) return { view };
  if (!hash.startsWith('#v')) return { view: 'home' };
  const matched = /^#v1\/([^/]+)\/(.+)$/.exec(hash);
  if (!matched || !views.includes(matched[1])) return { invalid: true, view: 'home' };
  try {
    const raw = JSON.parse(decodeURIComponent(matched[2]));
    const a = cleanSetup(raw.a);
    const b = cleanSetup(raw.b);
    const tool = raw.tool;
    if (tool !== undefined && (!tool || ![tool.brake, tool.lateral].every(n => Number.isFinite(n) && n >= 0 && n <= 1.2))) return { invalid: true, view: 'home' };
    if (!a || !b || !usableSetup(a) || !usableSetup(b) ||
        !['a', 'b'].includes(raw.focus) ||
        !['before', 'after'].includes(raw.aMode) || !['before', 'after'].includes(raw.bMode) ||
        (raw.event !== undefined && !['strip', 'oval'].includes(raw.event))) {
      return { invalid: true, view: 'home' };
    }
    return { view: matched[1], state: { a, b, aMode: raw.aMode, bMode: raw.bMode, focus: raw.focus,
      ...(raw.event ? { event: raw.event } : {}), ...(tool ? { tool: { brake: tool.brake, lateral: tool.lateral } } : {}) } };
  } catch {
    return { invalid: true, view: 'home' };
  }
}

export async function shareResult(url, title, summary, environment = navigator) {
  if (typeof environment.share === 'function') {
    try {
      await environment.share({ title, text: summary, url });
      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await environment.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'manual';
  }
}
