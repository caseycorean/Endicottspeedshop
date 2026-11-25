import { browseIds, vehicles, layoutNames } from './vehicles.mjs';
import { massIssue, powerIssue, resolve, newSetup } from './models.mjs';
import { escape, fmt } from './ui.mjs';

const normalize = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
export function findVehicles({query = '', category = '', layout = '', make = '', generation = ''} = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return browseIds.filter(id => {
    const car = vehicles[id];
    const text = normalize([car.name, car.make, car.generation, car.category, layoutNames[car.layout]].join(' '));
    return words.every(word => text.includes(word)) &&
      (!category || car.category === category) && (!layout || car.layout === layout) &&
      (!make || car.make === make) && (!generation || car.generation === generation);
  });
}

const groups = [
  ['category', 'Vehicle type'], ['layout', 'Architecture'], ['make', 'Manufacturer'], ['generation', 'Generation'],
];
const optionsFor = key => [...new Set(browseIds.map(id => vehicles[id][key]).filter(Boolean))].sort();
const strength = {
  manufacturer: 'Manufacturer', independent_test: 'Independent test', published: 'Published',
  measured: 'Measured', estimated: 'Estimate', calculated: 'Calculated', missing: 'Missing',
};
function fact(car, key, unit) {
  const [n, source] = car.data[key] ?? [];
  return `<span>${Number.isFinite(n) ? fmt(n) + ' ' + unit : unit + ' missing'}
    <small>${strength[source] ?? 'Missing'}</small></span>`;
}

function cards(ids) {
  return ids.map(id => {
    const car = vehicles[id];
    const setup = resolve(newSetup(id));
    const ready = !massIssue(setup) && !powerIssue(setup);
    return `<article class="catalog-result"><div>
      <h3>${escape(car.name)}</h3><p>${escape(car.generation)} · ${escape(layoutNames[car.layout])} · ${ready ? 'Can run a model' : 'More inputs needed to run'}</p>
      <div class="catalog-facts">${fact(car,'weight','lb')}${fact(car,'hp','hp')}</div>
      ${car.history?.length ? `<details><summary>Related Supercar X archive</summary>
        <ul>${car.history.map(([name,url,match]) => `<li><a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(name)}</a> · ${escape(match)}</li>`).join('')}</ul></details>` : ''}
      </div><div class="catalog-card-actions">
      <button type="button" data-catalog-choice="${escape(id)}">Choose</button>
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
      <p>Search the reference collection or enter a vehicle of your own.</p>
      <label><span>Search references</span><input type="search" data-catalog-query placeholder="e.g. Civic, Camaro, AWD"></label>
      <details class="catalog-filters"><summary>Filter references</summary><div><select aria-label="Vehicle type" name="category"><option value="">All vehicle types</option></select>
      ${groups.slice(1).map(([key,title]) => `<select aria-label="${title}" name="${key}"><option value="">All ${title.toLowerCase()}${key === 'layout' ? 's' : 's'}</option></select>`).join('')}</div></details>
      <div class="catalog-toolbar"><span data-catalog-count role="status"></span><button type="button" class="catalog-primary" data-catalog-choice="custom" data-template>Enter my own vehicle</button></div>
      <div data-catalog-results class="catalog-results"></div><button type="button" data-catalog-more>Show more references</button>`;
    for (const [key] of groups) {
      const select = el.querySelector(`[name="${key}"]`);
      select.insertAdjacentHTML('beforeend', optionsFor(key).map(value =>
        `<option value="${escape(value)}">${escape(key === 'layout' ? layoutNames[value] : value)}</option>`).join(''));
    }
    const refresh = () => {
      const picks = Object.fromEntries(groups.map(([key]) => [key, el.querySelector(`[name="${key}"]`).value]));
      const ids = findVehicles({...picks, query: el.querySelector('[data-catalog-query]').value});
      el.querySelector('[data-catalog-count]').textContent = ids.length + ' references';
      el.querySelector('[data-catalog-results]').innerHTML = ids.length ? cards(ids.slice(0, visible)) : '<p>No matches. Change a filter or enter your own vehicle.</p>';
      el.querySelector('[data-catalog-more]').hidden = visible >= ids.length;
    };
    el.addEventListener('input', () => {visible = 12; refresh();});
    el.addEventListener('change', () => {visible = 12; refresh();});
    el.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-catalog-close')) el.close();
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
