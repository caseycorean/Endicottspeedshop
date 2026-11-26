"""Build the comparison index using only published reference configurations."""
import json
from pathlib import Path

HERE = Path(__file__).parent

def build_comparison(page, entries, groups):
    payload = {}
    for entry in entries:
        title, variant, path, facts, sources = entry
        # Match the stable field key where possible, retaining evidence and original units.
        payload[path.rstrip('/')] = {
            'title': title, 'variant': variant, 'href': '../' + path,
            'groups': {
                group: [{**{key: f[key] for key in ('label', 'value', 'unit', 'evidence', 'note', 'key')},
                         'source': sources[f['source']]['url']} for f in rows] for group, rows in facts.items()
            },
        }
    dest = HERE.parent/'vehicles'/'comparison-data.json'
    dest.write_text(json.dumps({'groups':groups, 'cars':payload}, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    page('vehicles/compare/index.html','Compare vehicle specifications | Endicott Speed Shop',
         'Compare sourcing and specifications for two distinct vehicles from the ESS reference library.',
         """<main class="page vr-page" id="main">
<nav class="vr-breadcrumb" aria-label="Breadcrumb"><a href="../">Vehicle specifications</a></nav>
<section class="vr-hero"><h1>Compare vehicle specifications</h1>
<p class="vr-variant">Compare two configurations from the library. Values retain their source units and reported test conditions.</p></section>
<p id="comparison-state" role="status"></p>
<form id="comparison-select" class="vr-compare-select" hidden>
  <label>First vehicle <select name="a" required></select></label>
  <label>Second vehicle <select name="b" required></select></label>
  <button class="vr-button primary">Compare specifications</button>
</form>
<div id="comparison-results"></div>
<noscript><p>The interactive comparison requires JavaScript. <a href="../">Read the individual vehicle specifications</a>.</p></noscript>
</main>""", 'Vehicles', '<script type="module" src="../../experience/reference-compare.mjs"></script>', indexable=False)
