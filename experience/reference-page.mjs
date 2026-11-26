import { newSetup } from './models.mjs';
import { saveToGarage, shareResult } from './configuration.mjs';
import { track } from './measurement.mjs';

const input = document.querySelector('[data-reference-filter]');
if (input) {
  const entries = [...document.querySelectorAll('[data-reference-entry]')];
  const count = document.querySelector('[data-reference-count]');
  input.closest('label').hidden = false;
  const search = () => {
    const tokens = input.value.toLowerCase().trim().split(/\s+/);
    let visible = 0;
    for (const item of entries) {
      item.hidden = !tokens.every(token => item.dataset.referenceSearch.includes(token));
      if (!item.hidden) visible++;
    }
    count.textContent = visible === 0 ? 'No matching vehicles. Try a make, model or year.' :
      visible + (visible === 1 ? ' configuration' : ' configurations');
  };
  input.addEventListener('input', search);
  search();
}

const status = document.querySelector('[data-reference-status]');
const save = document.querySelector('[data-save-reference]');
if (save) {
  save.hidden = false;
  save.addEventListener('click', () => {
    const result = saveToGarage(newSetup(save.dataset.saveReference), 'before');
    track('configuration_save', {capability:'reference', outcome:result ? 'saved' : 'unavailable'});
    status.textContent = result ? 'Stock configuration saved in My Garage on this browser.' :
      'Could not save the configuration. Check browser storage or available space in My Garage.';
  });
}
const share = document.querySelector('[data-share-reference]');
if (share) {
  share.hidden = false;
  share.addEventListener('click', async () => {
    const url = new URL(share.dataset.shareReference, location.href);
    url.searchParams.set('via', 'share');
    track('share_attempt', {capability:'reference'});
    const outcome = await shareResult(url.href, document.querySelector('h1').textContent, 'Stock setup in Endicott Speed Shop Vehicle Lab.');
    track('share_outcome', {capability:'reference', outcome});
    const messages = {shared:'Share sheet completed.', copied:'Stock setup link copied.',
      cancelled:'Sharing cancelled.', manual:'Copy the stock setup link below.'};
    status.replaceChildren(messages[outcome]);
    if (outcome === 'manual') {
      const input = document.createElement('input');
      input.setAttribute('aria-label', 'Stock setup link');
      input.value = url.href;
      input.readOnly = true;
      status.append(input);
      input.select();
    }
  });
}

const control = document.querySelector('[data-reference-units]');
if (control) {
  // This file belongs to Claude's separate units branch. Integrators may land the pages first.
  const module = new URL('./units.mjs', import.meta.url);
  import(module.href).then(units => {
    control.innerHTML = units.unitsControl('reference-units');
    units.bindUnitControls(control);
    const originals = [...document.querySelectorAll('[data-spec-quantity]')];
    const render = () => {
      const system = units.getUnits();
      for (const el of originals) {
        const {specQuantity:quantity, specValue:value, specUnit:unit} = el.dataset;
        const canonical = units.fromSource(quantity, Number(value), unit);
        const display = el.nextElementSibling;
        const target = system === 'dual' ? (units.quantities[quantity].us === unit ? 'metric' : 'us') : system;
        display.hidden = canonical == null || units.unitLabel(quantity, target) === unit;
        if (!display.hidden) display.textContent = units.format(quantity, canonical, {system:target}) + ' converted';
      }
    };
    document.addEventListener('ess:units-changed', render);
    render();
  }).catch(() => { /* Original source values are fully available without units.mjs. */ });
}
