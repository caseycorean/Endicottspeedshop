import { browseIds, vehicles, layoutNames } from './vehicles.mjs';
import { massIssue, powerIssue, resolve, newSetup } from './models.mjs';
import { escape, fmt } from './ui.mjs';

const normalize = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const familyNames = ['MX-5 Miata', 'Miata', 'Chevy II Nova', 'Silverado 1500', 'Lancer Evolution',
  '718 Cayman', 'GR Corolla', 'GR Supra'];
function identity(id) {
  const car = vehicles[id];
  const known = car.name.match(/^(\d{4}) (.+)$/);
  const name = known?.[2] ?? car.name;
  const model = name.startsWith(car.make + ' ') ? name.slice(car.make.length + 1) : name;
  const family = familyNames.find(prefix => model.startsWith(prefix + ' ') || model === prefix) ?? model.split(' ')[0];
  return {year: Number(known?.[1]), model: family === 'Miata' ? 'MX-5 Miata' : family};
}
const identities = Object.fromEntries(browseIds.map(id => [id, identity(id)]));

export function findVehicles({query = '', category = '', layout = '', make = '', generation = '', model = ''} = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return browseIds.filter(id => {
    const car = vehicles[id];
    const text = normalize([car.name, car.make, car.generation, car.category, identities[id].model, layoutNames[car.layout]].join(' '));
    return words.every(word => text.includes(word)) &&
      (!category || car.category === category) && (!layout || car.layout === layout) &&
      (!make || car.make === make) && (!generation || car.generation === generation) &&
      (!model || identities[id].model === model);
  });
}

export function matchVehicles(filters) {
  const query = filters.query ?? '';
  const yearWord = /\b(?:19|20)\d{2}\b/.exec(query);
  const year = Number(filters.year || yearWord?.[0]);
  const ids = findVehicles({...filters, query: yearWord ? query.replace(yearWord[0], '').trim() : query});
  if (!year) return {exact: ids, nearby: [], year: null};
  const exact = ids.filter(id => identities[id].year === year);
  const hasIdentity = filters.model || query.replace(yearWord?.[0] ?? '', '').trim();
  const nearby = hasIdentity ? ids.filter(id => identities[id].year !== year && Math.abs(identities[id].year - year) <= 5)
    .sort((a, b) => Math.abs(identities[a].year - year) - Math.abs(identities[b].year - year)) : [];
  return {exact, nearby, year};
}

const groups = [
  ['make', 'Make'], ['layout', 'Drivetrain'], ['generation', 'Generation'],
];
const optionsFor = key => [...new Set(browseIds.map(id => vehicles[id][key]).filter(Boolean))].sort();
const option = (value, text = value) => `<option value="${escape(value)}">${escape(text)}</option>`;
const strength = {
  manufacturer: 'Manufacturer', independent_test: 'Independent test', published: 'Published',
  measured: 'Measured', estimated: 'Estimate', calculated: 'Calculated', missing: 'Missing',
};
function fact(car, key, unit) {
  const [n, source] = car.data[key] ?? [];
  return `<span>${Number.isFinite(n) ? fmt(n) + ' ' + unit : unit + ' missing'}
    <small>${strength[source] ?? 'Missing'}</small></span>`;
}

function cards(ids, otherYear = null) {
  return ids.map(id => {
    const car = vehicles[id];
    const setup = resolve(newSetup(id));
    const ready = !massIssue(setup) && !powerIssue(setup);
    return `<article class="catalog-result"><div>
      <h3>${escape(car.name)}</h3><p>${escape(car.generation)} · ${escape(layoutNames[car.layout])} · ${ready ? 'Quarter-mile inputs available' : Number.isFinite(setup.weight) && Number.isFinite(setup.front) ? 'Weight data available' : 'Partial reference'}</p>
      ${otherYear ? `<p class="reference-difference"><strong>Different reference:</strong> ${identities[id].year} model year · ${escape(car.generation)}. Check generation, trim and drivetrain against your ${otherYear} car before using these specs.</p>` : ''}
      <div class="catalog-facts">${fact(car,'weight','lb')}${fact(car,'hp','hp')}</div>
      ${car.history?.length ? `<details><summary>Related Supercar X archive</summary>
        <ul>${car.history.map(([name,url,match]) => `<li><a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(name)}</a> · ${escape(match)}</li>`).join('')}</ul></details>` : ''}
      </div><div class="catalog-card-actions">
      ${otherYear ? '' : `<button type="button" data-catalog-choice="${escape(id)}">Choose</button>`}
      <button type="button" data-catalog-choice="${escape(id)}" data-template>Use as starting point</button>
      </div></article>`;
  }).join('');
}

export function installCatalog(root = document) {
  let origin;
  let dialog;
  let visible = 12;
  const makeDialog = () => {
    const el = document.createElement('dialog');
    el.className = 'catalog-dialog';
    el.setAttribute('aria-labelledby', 'ess-catalog-title');
    el.innerHTML = `<div class="catalog-top"><h2 id="ess-catalog-title">Choose your car</h2><button type="button" data-catalog-close aria-label="Close vehicle catalogue">×</button></div>
      <label><span>Search by make, model or year</span><input type="search" data-catalog-query placeholder="e.g. 2004 Mustang, Civic, AWD"></label>
      <div class="catalog-categories" role="group" aria-label="Browse vehicle types">
        ${['', ...optionsFor('category')].map(value => `<button type="button" data-catalog-category="${escape(value)}" aria-pressed="${!value}">${escape(value || 'All vehicles')}</button>`).join('')}
      </div>
      <div class="catalog-identity">
        <label><span>Make</span><select name="make">${option('', 'Any make')}${optionsFor('make').map(i => option(i)).join('')}</select></label>
        <label><span>Model</span><select name="model">${option('', 'Any model')}</select></label>
        <label><span>Year</span><input type="text" name="year" inputmode="numeric" maxlength="4" placeholder="Any year"></label>
      </div>
      <details class="catalog-filters"><summary>Drivetrain and generation</summary><div>
        ${groups.slice(1).map(([key,title]) => `<label><span>${title}</span><select name="${key}">${option('', 'Any ' + title.toLowerCase())}
          ${optionsFor(key).map(i => option(i, key === 'layout' ? layoutNames[i] : i)).join('')}</select></label>`).join('')}
      </div></details>
      <div class="catalog-toolbar"><span data-catalog-count role="status"></span></div>
      <div class="catalog-custom"><span>Have your own specs?</span><button type="button" data-catalog-choice="custom" data-template>Enter my own vehicle</button></div>
      <div data-catalog-results class="catalog-results"></div><button type="button" data-catalog-more>Show more references</button>`;
    const modelSelect = el.querySelector('[name="model"]');
    const yearInput = el.querySelector('[name="year"]');
    const query = el.querySelector('[data-catalog-query]');
    let category = '';
    const refresh = () => {
      const picks = Object.fromEntries(groups.map(([key]) => [key, el.querySelector(`[name="${key}"]`).value]));
      const model = modelSelect.value;
      const models = [...new Set(browseIds.filter(id => !picks.make || vehicles[id].make === picks.make)
        .map(id => identities[id].model))].sort();
      modelSelect.innerHTML = option('', 'Any model') + models.map(i => option(i)).join('');
      modelSelect.value = models.includes(model) ? model : '';
      const {exact, nearby, year} = matchVehicles({...picks, model: modelSelect.value, category,
        query: query.value, year: /^\d{4}$/.test(yearInput.value.trim()) ? yearInput.value.trim() : ''});
      const noMatch = '<p>No matches. Try removing a filter, or enter your own vehicle.</p>';
      const summary = year ? `${exact.length} exact year ${exact.length === 1 ? 'reference' : 'references'}` : `${exact.length} references`;
      el.querySelector('[data-catalog-count]').textContent = summary;
      const nearbyHtml = nearby.length ? `<details class="catalog-nearby" ${!exact.length ? 'open' : ''}>
        <summary>Nearby model years (${nearby.length})</summary>${cards(nearby.slice(0, visible), year)}</details>` : '';
      el.querySelector('[data-catalog-results]').innerHTML = (exact.length ? cards(exact.slice(0, visible)) :
        nearbyHtml ? `<p>No ${year} reference in these results. Review differences before using another year.</p>` : noMatch) + nearbyHtml;
      el.querySelector('[data-catalog-more]').hidden = visible >= Math.max(exact.length, nearby.length);
    };
    el.addEventListener('input', () => {visible = 12; refresh();});
    el.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-catalog-close')) el.close();
      if (button.hasAttribute('data-catalog-category')) {
        category = button.dataset.catalogCategory;
        for (const tab of el.querySelectorAll('[data-catalog-category]'))
          tab.setAttribute('aria-pressed', String(tab === button));
        visible = 12;
        refresh();
      }
      if (button.hasAttribute('data-catalog-more')) {
        visible += 12;
        refresh();
        return;
      }
      if (button.dataset.catalogChoice) {
        const detail = {id: button.dataset.catalogChoice, template: button.hasAttribute('data-template')};
        const opener = origin;
        el.close();
        opener?.dispatchEvent(new CustomEvent('ess:vehicle-selected', {bubbles: true, detail}));
      }
    });
    root.body.append(el);
    refresh();
    return el;
  };
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-open-catalog]');
    if (!button) return;
    origin = button;
    if (!dialog) dialog = makeDialog();
    dialog.showModal();
  });
}
