"""ESS specification page, guided-discovery demonstration (Claude, 25 Nov 2026 night).

Owner-directed experiment: one representative page (Ferrari F40) that keeps every published fact, source and definition
of the standard specification page (`spec_page.py`) and adds a question-led way into the shared engineering model.
Only the slugs in DISCOVERY_SLUGS use this template, and only when ESS_SPEC_DISCOVERY=1; every other page, and the
public build, keep `spec_page.py` unchanged.

Static HTML answers search intent without JavaScript (title, quick answers, every fact, sources). The questions,
workbench and live readout hydrate from the same embedded record in `experience/spec-discovery.mjs`, which calls the
shared engine and never re-implements a calculation.
"""
import json

from spec_page import SECTIONS, h, facts_list, intro, key_tiles, model_table

DISCOVERY_SLUGS = {'1991-ferrari-f40'}

# (id, question, what the answer covers). Order is the suggested path; the first opens by default.
QUESTIONS = [
    ('launch', 'Why does it launch the way it does?', 'Drive force against tire grip, gear by gear.'),
    ('gearing', 'How does the gearing shape the run?', 'Speed in every gear, and what another final drive does.'),
    ('power', 'What would more power buy?', 'Weight per horsepower, the torque curve and where the time goes.'),
    ('balance', 'Why put the engine behind the driver?', 'Weight on the driven wheels, and what moving mass changes.'),
    ('tires', 'What would different tires do?', 'Diameter, effective gearing and a different tire type.'),
    ('speed', 'Where does the power go at speed?', 'Drag, road-load power and the power-limited top speed.'),
    ('ride', 'How firmly is it sprung?', 'Spring rate, wheel rate and ride frequency.'),
    ('compare', 'How does it compare?', 'Side by side with related cars from the library.'),
]
# Specification group -> the question that puts those numbers to work.
SECTION_QUESTION = {'engine': 'power', 'gearing': 'gearing', 'tires': 'tires', 'weight': 'balance', 'suspension': 'ride',
                    'aero': 'speed', 'performance': 'launch'}
LAYOUT = {'MR': 'Mid-engine · rear drive', 'FR': 'Front-engine · rear drive', 'RR': 'Rear-engine · rear drive',
          'FF': 'Front-wheel drive', 'AWD': 'All-wheel drive'}


def render(page, r, private):
    facts = r['facts']
    urls = list(dict.fromkeys(f['source']['url'] for f in facts if f['source'].get('url')))
    numbers = {u: i for i, u in enumerate(urls, 1)}
    publishers = {}
    for f in facts:
        publishers.setdefault(f['source'].get('url'), f['source'].get('publisher') or f['source'].get('title') or 'Source')
    runs = bool(r.get('model') and r['links'].get('lab') and not r['model'].get('competition'))
    ident = r['identity']
    year = ident.get('year')
    name = r['title'][len(str(year)) + 1:] if year and r['title'].startswith(str(year)) else r['title']

    cards = []
    for qid, question, covers in QUESTIONS:
        cards.append(f'<li><a class="sd-card" href="#q-{qid}" data-sd-q="{qid}" aria-controls="sd-bench">'
                     f'<span class="sd-card-fig" data-sd-fig="{qid}" aria-hidden="true"></span>'
                     f'<span class="sd-card-q">{h(question)}</span>'
                     f'<span class="sd-card-t" data-sd-teaser="{qid}">{h(covers)}</span></a></li>')

    sheet = []
    for sid, heading, groups, _pid in SECTIONS:
        group_facts = [f for f in facts if f['group'] in groups]
        if not group_facts:
            continue
        q = SECTION_QUESTION.get(sid) if runs else None
        explore = (f'<a class="sd-explore" href="#q-{q}" data-sd-q="{q}">See these numbers at work</a>' if q else '')
        sheet.append(f'<section class="sd-group" id="{sid}" aria-labelledby="{sid}-h"><div class="sd-group-head">'
                     f'<h3 id="{sid}-h">{h(heading)}</h3>{explore}</div>{facts_list(group_facts, numbers)}</section>')

    refs = ''.join(f'<li id="source-{i}"><a href="{h(u)}" rel="noreferrer">{h(publishers.get(u))}</a></li>' for u, i in numbers.items())
    conflicts = ''
    if r['conflicts']:
        items = ''.join(f'<li><strong>{h(c["key"])}</strong> — {h(c["kind"])}: ' + '; '.join(
            h(f'{v["label"]} {v["value"]} {v.get("unit") or ""} ({v.get("publisher") or v["evidence"]})') for v in c['values']) + '</li>' for c in r['conflicts'])
        conflicts = f'<details class="sp-conflicts" open><summary>Where sources differ ({len(r["conflicts"])})</summary><p>Each value keeps its own source and definition; ESS does not average them.</p><ul>{items}</ul></details>'
    review_note = ''
    if private and r['review']['archiveFactsPending']:
        review_note = (f'<p class="sd-review-note">Private review: {r["review"]["archiveFactsPending"]} Supercar X archive facts marked '
                       '<span class="sp-review">review</span> appear only in this preview, pending your decision on archive publication.</p>')
    arch = ident.get('archive')
    archive_note = (f'<p class="sp-heritage">Historical discovery source: <a href="{h(arch["capture"])}" rel="noreferrer">original Supercar X '
                    'specification page</a> (Wayback Machine).</p>') if arch else ''
    related = ''
    if r.get('related'):
        related = ('<section class="sd-related" aria-labelledby="related-h"><h2 id="related-h">Nearby in the library</h2><ul>'
                   + ''.join(f'<li><a href="../{h(o["slug"])}/">{h(o["title"])}</a></li>' for o in r['related'])
                   + '</ul><p><a href="../">All vehicle specifications</a></p></section>')
    lab = (f'<a class="sd-btn" data-sp-lab="build" href="../../experience/?via=reference{h(r["links"]["lab"]["build"])}">Open in the Vehicle Lab</a>'
           if runs else '')
    data = json.dumps({k: r[k] for k in ('schema', 'id', 'slug', 'title', 'variant', 'identity', 'key', 'tires', 'model', 'links', 'compareWith')},
                      ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

    discover = ''
    if runs:
        discover = f'''<section class="sd-discover" id="explore" aria-labelledby="discover-h">
<div class="sd-shell"><div class="sd-discover-head"><h2 id="discover-h">Questions this car raises</h2>
<p>Pick one. Each answer is worked out from this car’s own numbers, and anything you change carries through every question, the readout and the Vehicle Lab.</p></div>
<ol class="sd-cards" aria-label="Questions to explore">{''.join(cards)}</ol>
<div class="sd-work"><section class="sd-bench" id="sd-bench" data-sd-bench aria-live="polite" tabindex="-1"><p class="sd-loading">Loading the experiment…</p></section>
<details class="sd-readout" data-sd-readout open><summary data-sd-dock></summary><div data-sd-readout-body></div></details></div>
</div></section>'''

    body = f'''<main id="main" class="page sd-page" data-ess-page="specification" data-variant="discovery">
<section class="sd-hero" aria-labelledby="sd-title"><div class="sd-shell">
<nav class="sd-crumbs" aria-label="Breadcrumb"><a href="../../">Home</a> <span aria-hidden="true">/</span> <a href="../">Vehicle specifications</a></nav>
<div class="sd-hero-grid"><div class="sd-hero-copy">
<p class="sd-eyebrow">{h(LAYOUT.get(ident.get('layout'), ident.get('category') or ''))}</p>
<h1 id="sd-title"><span class="sd-make">{h(r['title'][:len(r['title']) - len(r['title'].split(' ')[-1])].strip())}</span> <span class="sd-model">{h(r['title'].split(' ')[-1])}</span></h1>
<p class="sd-variant">{h(r['variant'])}</p>
<p class="sd-lede">{intro(r)}</p>
{key_tiles(r)}
<div class="sd-actions">{('<a class="sd-btn sd-btn-hot" href="#explore">Explore what makes it fast</a>' if runs else '')}<a class="sd-btn" href="#specifications">Full specifications</a>{lab}<span class="sd-units" data-sp-units></span></div>
{review_note}</div>
<figure class="sd-hero-fig" data-sd-hero-fig><figcaption>Layout schematic drawn to this car’s wheelbase, tire sizes and weight split. Not a styling drawing.</figcaption></figure>
</div></div></section>
<div class="sp-status sd-status" role="status" aria-live="polite" data-sp-status></div>
{discover}
<section class="sd-sheet" id="specifications" aria-labelledby="sheet-h"><div class="sd-shell">
<div class="sd-sheet-head"><h2 id="sheet-h">The full specification</h2><p>Every published value with its source and definition. Archive figures and ESS estimates are labeled; model results never appear here as specifications.</p></div>
<div class="sd-groups">{''.join(sheet)}</div>
{model_table(r) if r.get('model') else ''}{conflicts}
<section class="sp-sources" id="sources" aria-labelledby="sources-h"><h2 id="sources-h">Sources and definitions</h2>{archive_note}<ol>{refs}</ol>
<p class="sp-legend"><span class="sp-ev sp-ev-manufacturer">Manufacturer</span> factory specification · <span class="sp-ev sp-ev-road-test">Road test</span> measured on the cited test car · <span class="sp-ev sp-ev-published">Published</span> reported by the cited publication · <span class="sp-ev sp-ev-archive">Supercar X archive</span> historical figure, not re-verified · <span class="sp-ev sp-ev-estimate">ESS estimate</span> modeling assumption.</p>
<p><a href="../../contact/?from=/vehicles/{h(r["slug"])}/&amp;type=correction">Suggest a correction</a></p></section>
{related}</div></section>
<script type="application/json" id="ess-spec-data">{data}</script>
</main>'''
    desc = (f'{r["title"]} specifications with sources, plus guided experiments: launch grip by gear, gearing, power, weight balance, '
            'tires, drag and comparisons, all from the car’s own numbers.')
    page(f'vehicles/{r["slug"]}/index.html', f'{r["title"]} specifications | Endicott Speed Shop', desc, body, 'Vehicles',
         '<link rel="stylesheet" href="../../assets/ess-spec.css"><link rel="stylesheet" href="../../assets/ess-discovery.css">'
         '<script type="module" src="../../experience/spec-discovery.mjs"></script>', indexable=True)
