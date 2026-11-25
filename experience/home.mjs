import { getActive, example, shareFragment, useConfig } from './configuration.mjs';
import { newSetup } from './models.mjs';
import { vehicles } from './vehicles.mjs';
import { installCatalog } from './catalog.mjs';

const control = document.querySelector('[data-home-vehicle]');
if (control) {
  installCatalog();
  const active = getActive();
  if (active) {
    control.querySelector('[data-open-catalog]').textContent = active.setup.name || vehicles[active.setup.id].name;
  }

  control.addEventListener('ess:vehicle-selected', event => {
    const {id, template} = event.detail;
    const setup = newSetup(id);
    const carried = useConfig(setup, 'before');
    const root = new URL(control.dataset.labRoot, location.href);
    if (template) root.searchParams.set('edit', 'original');
    root.hash = carried ? 'build' : shareFragment({...example(), a: setup}, 'build').slice(1);
    location.assign(root);
  });
  // Existing Grip Lab share URLs at the old homepage keep opening the same experiment.
  if (location.hash.startsWith('#lab:')) location.replace('grip/' + location.hash);
}
