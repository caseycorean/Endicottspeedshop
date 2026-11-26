"""ESS specification page, second demonstration: "showroom brochure + shop manual" (Claude, 25 Nov 2026 night).

Owner-directed experiment, 1977 Pontiac Firebird Formula W72 four-speed only. Compared with the F40 discovery
demonstration (`spec_discovery.py`, preserved unchanged), this one tries a stronger period visual identity (Candidate A's
ESS badge as the hero art, condensed display type, editorial serif, warm paper and ink), keeps the specifications
visually prominent with provenance available on demand, and leads the visitor through questions particular to this car.

Enabled only with ESS_SPEC_STORY=1 for slugs in STORY_SLUGS. Static HTML still answers search intent without
JavaScript; `experience/spec-story.mjs` hydrates from the embedded record and calls only the shared engine.
"""
import json

from spec_page import SECTIONS, h, fact_value, model_table, EVIDENCE_TEXT, QUANTITY_UNITS, TO_US, US

STORY_SLUGS = {'1977-pontiac-firebird-formula-w72-four-speed'}

QUESTIONS = [
    ('torque', 'Why does a 400 cubic inch V8 make only 200 horsepower?', 'Torque, rpm and what horsepower actually measures.'),
    ('launch', 'What happens when you floor it?', 'Drive force against tire grip, gear by gear.'),
    ('tires', 'What would modern tires do?', 'Every tire class through the same model.'),
    ('balance', 'Why so nose-heavy, and does it matter?', 'Weight on the driven wheels, and what moving mass changes.'),
    ('gearing', 'How tall is the gearing?', 'Speed in every gear, cruising rpm, another axle ratio.'),
    ('chassis', 'What did Pontiac specify for the chassis?', 'Factory alignment and suspension travel, explained.'),
    ('decades', 'How far did the Firebird come?', 'Side by side with the Trans Am and a Firebird 25 years newer.'),
]
GROUP_TITLES = {'engine': 'Engine', 'transmission': 'Transmission & axle', 'tires': 'Wheels & tires', 'weight': 'Weight',
                'dimensions': 'Dimensions', 'suspension': 'Chassis & suspension', 'brakes': 'Brakes', 'aero': 'Aerodynamics',
                'performance': 'Performance (road test)', 'chassis': 'Structure', 'capacities': 'Capacities'}
GROUP_QUESTION = {'engine': 'torque', 'transmission': 'gearing', 'tires': 'tires', 'weight': 'balance', 'suspension': 'chassis',
                  'performance': 'launch', 'dimensions': 'balance'}
LAYOUT = {'MR': 'Mid-engine · rear drive', 'FR': 'Front engine · rear drive', 'RR': 'Rear engine · rear drive', 'FF': 'Front-wheel drive', 'AWD': 'All-wheel drive'}


def value(f):
    """Published precision: never round a source figure below the precision it was published with."""
    v, unit = f['value'], f.get('unit') or ''
    if isinstance(v, float) and unit in QUANTITY_UNITS and TO_US.get(unit) == 1:
        q = QUANTITY_UNITS[unit]
        return f'<span data-q="{q}" data-v="{v}" data-p="{len(repr(v).split(".")[1]) if "." in repr(v) else 0}">{v:g} {US[q][1]}</span>'
    if isinstance(v, (int, float)) and unit not in QUANTITY_UNITS and unit not in ('fraction', 's', 'rpm', 'ratio', '', None):
        return h(f'{v:g}{unit if unit in ("°",) else " " + unit}')
    return fact_value(f)


def plate(group, facts, numbers):
    rows = []
    for f in facts:
        n = numbers.get(f['source'].get('url'))
        ev = f['evidence']
        est = ' <span class="st-est">est.</span>' if ev == 'estimate' else ''
        basis = f' <span class="st-basis">{h(f["basis"])}</span>' if f.get('basis') in ('curb', 'as tested', 'dry', 'shipping') else ''
        review = ' <span class="st-review" title="Archive figure pending your decision on archive publication">review</span>' if f.get('publish') == 'review' else ''
        meta = (f'<span class="st-src"><span class="sp-ev sp-ev-{h(ev.replace(" ", "-"))}">{h(EVIDENCE_TEXT.get(ev, "Source"))}</span>'
                + (f' <a href="#source-{n}">[{n}]</a>' if n else '') + (f' <small>{h(f["note"])}</small>' if f.get('note') else '') + '</span>')
        rows.append(f'<div class="st-row"><dt>{h(f["label"])}</dt><dd><span class="st-v">{value(f)}</span>{basis}{est}{review}{meta}</dd></div>')
    q = GROUP_QUESTION.get(group)
    link = f'<a class="st-plate-q" href="#q-{q}" data-st-q="{q}">Explore</a>' if q else ''
    return (f'<section class="st-plate" id="spec-{group}" aria-labelledby="spec-{group}-h"><header><h3 id="spec-{group}-h">{h(GROUP_TITLES.get(group, group))}</h3>{link}</header>'
            f'<dl>{"".join(rows)}</dl></section>')


def render(page, r, private):
    facts = r['facts']
    urls = list(dict.fromkeys(f['source']['url'] for f in facts if f['source'].get('url')))
    numbers = {u: i for i, u in enumerate(urls, 1)}
    publishers = {}
    for f in facts:
        publishers.setdefault(f['source'].get('url'), f['source'].get('publisher') or f['source'].get('title') or 'Source')
    ident, k = r['identity'], r['key']
    runs = bool(r.get('model') and r['links'].get('lab') and not r['model'].get('competition'))

    order = ['engine', 'transmission', 'weight', 'tires', 'dimensions', 'suspension', 'performance', 'brakes', 'aero', 'chassis', 'capacities']
    plates = ''.join(plate(g, [f for f in facts if f['group'] == g], numbers) for g in order if any(f['group'] == g for f in facts))

    def big(label, value, unit, note=''):
        return f'<div class="st-num"><dt>{h(label)}</dt><dd><strong>{value}</strong><span>{h(unit)}</span>{f"<small>{h(note)}</small>" if note else ""}</dd></div>'
    nums = []
    if 'power' in k: nums.append(big('Power', f'<span data-q="power" data-v="{k["power"]["value"]}" data-bare>{round(k["power"]["value"])}</span>', 'hp', 'SAE net' if (r['model']['inputs'].get('hp') or {}).get('basis', '').find('SAE') >= 0 else ''))
    if 'torque' in k: nums.append(big('Torque', f'<span data-q="torque" data-v="{k["torque"]["value"]}" data-bare>{round(k["torque"]["value"])}</span>', 'lb-ft', f'at {r["model"]["inputs"]["torqueRpm"]["value"]:,} rpm' if r['model']['inputs'].get('torqueRpm') else ''))
    if 'weight' in k: nums.append(big('Weight', f'<span data-q="weight" data-v="{k["weight"]["value"]}" data-bare>{round(k["weight"]["value"]):,}</span>', 'lb', k['weight'].get('basis') or ''))
    if 'front' in k: nums.append(big('On the front axle', f'{k["front"]["value"] * 100:.0f}', '%', 'static'))
    if 't60' in k: nums.append(big('0–60 mph', f'{k["t60"]["value"]:.1f}', 's', 'road test, archive'))
    if 'et' in k: nums.append(big('Quarter mile', f'{k["et"]["value"]:.1f}', 's', f'at {k["trap"]["value"]:.0f} mph' if 'trap' in k else ''))

    title = r['title']
    variant_name = title.split(' · ')[1] if ' · ' in title else ''
    base = title.split(' · ')[0]
    year, make = ident.get('year'), ident.get('make') or ''
    model_name = base[len(f'{year} {make} '):] if base.startswith(f'{year} {make} ') else base
    first, _, rest = model_name.partition(' ')

    toc = ''.join(f'<li><a class="st-q" href="#q-{qid}" data-st-q="{qid}"><span class="st-q-fig" data-st-fig="{qid}" aria-hidden="true"></span>'
                  f'<span class="st-q-text"><strong>{h(q)}</strong><span data-st-teaser="{qid}">{h(c)}</span></span></a></li>' for qid, q, c in QUESTIONS)
    refs = ''.join(f'<li id="source-{i}"><a href="{h(u)}" rel="noreferrer">{h(publishers.get(u))}</a></li>' for u, i in numbers.items())
    arch = ident.get('archive')
    archive_note = (f'<p class="sp-heritage">Historical discovery source: <a href="{h(arch["capture"])}" rel="noreferrer">original Supercar X page</a> (Wayback Machine).</p>') if arch else ''
    review_note = (f'<p class="st-private">Private review: {r["review"]["archiveFactsPending"]} archive figures marked <span class="st-review">review</span> appear only in this preview, pending your decision on archive publication.</p>'
                   if private and r['review']['archiveFactsPending'] else '')
    lab = f'../../experience/?via=reference{h(r["links"]["lab"]["build"])}' if runs else ''
    data = json.dumps({x: r[x] for x in ('schema', 'id', 'slug', 'title', 'variant', 'identity', 'key', 'tires', 'model', 'links', 'compareWith', 'facts')},
                      ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    explore = ''
    if runs:
        explore = f'''<section class="st-explore" id="explore" aria-labelledby="explore-h">
<div class="st-shell"><div class="st-explore-head"><p class="st-kicker">Seven questions this car raises</p><h2 id="explore-h">Open the hood on the numbers.</h2>
<p>Each answer is worked out from this car’s own specifications through the ESS model. Change something and it carries through every answer and into the Vehicle Lab.</p></div></div>
<div class="st-cluster" data-st-cluster aria-label="Your Formula, live from the model"></div>
<div class="st-shell st-explore-grid"><nav class="st-toc" aria-label="Questions"><ol>{toc}</ol></nav>
<section class="st-answer" data-st-answer tabindex="-1" aria-live="polite"><p class="st-loading">Loading the experiment…</p></section></div>
</section>'''

    body = f'''<main id="main" class="page st-page" data-ess-page="specification" data-variant="story">
<section class="st-hero" aria-labelledby="st-title"><div class="st-shell">
<nav class="st-crumbs" aria-label="Breadcrumb"><a href="../../">Home</a> <span aria-hidden="true">/</span> <a href="../">Vehicle specifications</a></nav>
<div class="st-hero-grid"><div class="st-hero-copy">
<p class="st-kicker">{h(LAYOUT.get(ident.get('layout'), ''))} · factory specification</p>
<h1 id="st-title"><span class="st-make">{h(year)} {h(make)}</span> <span class="st-name">{h(first)}</span> <span class="st-trim">{h(rest)}{(' · ' + h(variant_name)) if variant_name else ''}</span></h1>
<p class="st-dek" data-st-dek>A big V8 that makes its torque low, a car that carries most of its weight over the front wheels, and the street radials of its day. Each of those shapes how it drives.</p>
<div class="st-actions">{('<a class="st-btn st-btn-hot" href="#explore">Start with the engine</a>' if runs else '')}<a class="st-btn" href="#specifications">Specifications</a>{(f'<a class="st-btn" data-sp-lab="build" href="{lab}">Open in the Vehicle Lab</a>' if runs else '')}</div>
</div>
<figure class="st-badge"><img src="../../assets/story/ess-badge.webp" width="880" height="760" alt="The Endicott Speed Shop badge: a pencil drawing of a second-generation Pontiac Firebird">
<figcaption>The ESS mark, drawn on a second-generation Firebird, the shop’s own test platform. It shows a modified car, not this factory configuration.</figcaption></figure></div>
<dl class="st-sticker" aria-label="Key specifications">{"".join(nums)}</dl>
<p class="st-variant">{h(r['variant'])}</p>{review_note}
</div></section>
<div class="sp-status st-status" role="status" aria-live="polite" data-sp-status></div>
{explore}
<section class="st-specs" id="specifications" aria-labelledby="specs-h"><div class="st-shell">
<div class="st-specs-head"><div><p class="st-kicker">The full specification</p><h2 id="specs-h">As the factory and the record show it.</h2></div>
<div class="st-specs-tools"><label class="st-toggle"><input type="checkbox" data-st-sources> Show sources and definitions</label><span class="st-units" data-sp-units></span></div></div>
<p class="st-legend">Values are as published. <span class="st-basis">curb</span> marks a weight definition, <span class="st-est">est.</span> an ESS estimate, and model results never appear here as specifications. Turn on sources to see where every figure comes from.</p>
<div class="st-plates" data-st-plates>{plates}</div>
{model_table(r) if r.get('model') else ''}
<section class="sp-sources st-sources" id="sources" aria-labelledby="sources-h"><h2 id="sources-h">Sources</h2>{archive_note}<ol>{refs}</ol>
<p><a href="../../contact/?from=/vehicles/{h(r["slug"])}/&amp;type=correction">Suggest a correction</a></p></section>
</div></section>
<script type="application/json" id="ess-spec-data">{data}</script>
</main>'''
    desc = (f'{base} specifications with sources, and guided experiments: torque and horsepower, launch grip, modern tires, '
            'weight balance, gearing, factory chassis settings and a comparison with later Firebirds.')
    page(f'vehicles/{r["slug"]}/index.html', f'{title} specifications | Endicott Speed Shop', desc, body, 'Vehicles',
         '<link rel="stylesheet" href="../../assets/ess-spec.css"><link rel="stylesheet" href="../../assets/ess-story.css">'
         '<script type="module" src="../../experience/spec-story.mjs"></script>', indexable=True)
