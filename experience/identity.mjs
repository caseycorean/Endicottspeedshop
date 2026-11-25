// ESS "Proving Ground" identity: shared renderers for the mark, starting-light status, timeslip and bars.
// Pure string builders: every value passed in comes from the shared engine (perfModel / engine/traction.mjs).
import { escape, fmt } from './ui.mjs';

/** Traction-circle mark: grip limit circle, axes, and the demand dot sitting on the limit. */
export const mark = (size = 24, label = '') => `<svg class="ig-mark" width="${size}" height="${size}" viewBox="0 0 24 24" ${label ? `role="img" aria-label="${escape(label)}"` : 'aria-hidden="true"'}>
  <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4.5v15M4.5 12h15" stroke="currentColor" stroke-width="1" opacity=".5"/>
  <circle cx="18.7" cy="5.3" r="2.7" fill="var(--ig-amber)"/></svg>`;

/** Status vocabulary, shared by every page. Colour is never the only signal: each light has a word. */
export const lights = {
  green: { word: 'Grip to spare', short: 'Hooks' },
  yellow: { word: 'On the edge', short: 'Edge' },
  red: { word: 'Wheelspin likely', short: 'Spins' },
  missing: { word: 'Needs data', short: '—' },
};

/** A starting-light "tree": three lamps, the one for this status lit. */
export function tree(status, { label = true } = {}) {
  const lit = { red: 0, yellow: 1, green: 2 }[status];
  return `<span class="ig-tree" data-level="${status}" role="img" aria-label="${escape(lights[status]?.word ?? '')}">
    ${['red', 'yellow', 'green'].map((c, i) => `<i class="ig-lamp ig-${c}${i === lit ? ' on' : ''}"></i>`).join('')}
    </span>${label ? `<span class="ig-light-word" data-level="${status}">${escape(lights[status]?.word ?? '')}</span>` : ''}`;
}

/** One lamp (for tables and lists). */
export const lamp = status => `<i class="ig-dot" data-level="${status}" aria-hidden="true"></i>`;

/**
 * Bar showing drive force as a share of typical grip. 100% (all the grip) sits at the midline; the bar stops at 200%.
 * `band` [low%, high%] shows the grip uncertainty as the range of utilisation.
 */
export function useBar(utilization, status, band) {
  const pos = u => Math.max(0, Math.min(100, u * 50)).toFixed(1) + '%';
  return `<span class="ig-use" data-level="${status}">
    ${band ? `<span class="ig-use-band" style="left:${pos(band[0])};right:calc(100% - ${pos(band[1])})"></span>` : ''}
    <span class="ig-use-fill" style="width:${pos(utilization)}"></span><span class="ig-use-limit"></span></span>`;
}

/** Timeslip: rows of [label, value], optional footer line. */
export function slip(title, rows, footer = '') {
  return `<div class="ig-slip"><div class="ig-slip-head">${title}</div>
    <dl>${rows.filter(Boolean).map(([k, v, cls = '']) => `<div class="${cls}"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${footer ? `<div class="ig-slip-foot">${footer}</div>` : ''}</div>`;
}

export const ordinal = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
export const secs = (n, p = 2) => Number.isFinite(n) ? fmt(n, p) + '<small> s</small>' : '—';
