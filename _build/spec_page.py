"""ESS specification pages built from the consolidated vehicle knowledge record.

The record (`_build/knowledge/knowledge.mjs`, contract `_build/knowledge/CONTRACT.md`) joins Work's publication facts
with the shared engineering resolver. This module renders the static, indexable page: a search visitor gets the
answer (key specifications and every published fact, with source and definition) in plain HTML. The interactive
experiments (`experience/spec-page.mjs`) hydrate from the same record embedded in the page and run the shared
engine; they never re-implement a calculation.

ESS_SPEC_TEMPLATE=reference renders Work's 47501c2 reference template instead (historical checkpoint).
"""
from html import escape
import json
import os
from pathlib import Path
import subprocess
import tempfile

HERE = Path(__file__).parent

SECTIONS = [  # (id, heading, fact groups, experiment panel)
    ('engine', 'Engine', ('engine',), 'engine'),
    ('gearing', 'Transmission & gearing', ('transmission',), 'gearing'),
    ('tires', 'Wheels & tires', ('tires',), 'tires'),
    ('weight', 'Weight & balance', ('weight',), 'weight'),
    ('dimensions', 'Dimensions', ('dimensions',), None),
    ('suspension', 'Suspension & steering', ('suspension',), 'suspension'),
    ('brakes', 'Brakes', ('brakes',), None),
    ('aero', 'Aerodynamics', ('aero',), 'aero'),
    ('performance', 'Performance', ('performance',), 'performance'),
    ('chassis', 'Chassis & structure', ('chassis',), None),
    ('capacities', 'Capacities', ('capacities',), None),
]
PANEL_INTRO = {
    'engine': ('Power and weight', 'Change engine output and see weight per horsepower and the modeled run respond.'),
    'gearing': ('Speed in every gear', 'See road speed at the shift point in each gear, then try another final drive ratio.'),
    'tires': ('Tire size and gearing', 'Compare front and rear diameters, try another size and see the effective gearing change.'),
    'weight': ('Add, remove or move weight', 'Move mass along the car and watch axle loads, balance and the modeled run change.'),
    'suspension': ('Springs and ride frequency', 'See how spring rate and motion ratio set wheel rate and ride frequency.'),
    'aero': ('Drag and power', 'See the power needed to push through the air at speed.'),
    'performance': ('Road tests and the ESS model', 'Compare published road-test results with the ESS model and see what limits the run.'),
}
EVIDENCE_TEXT = {'manufacturer': 'Manufacturer', 'road test': 'Road test', 'published': 'Published', 'archive': 'Supercar X archive',
                 'calculated': 'Calculated', 'estimate': 'ESS estimate'}
QUANTITY_UNITS = {'hp': 'power', 'bhp': 'power', 'kW': 'power', 'PS': 'power', 'lb-ft': 'torque', 'lbs-ft': 'torque', 'N·m': 'torque',
                  'lb': 'weight', 'kg': 'weight', 'in': 'length', 'mm': 'length', 'mph': 'speed', 'km/h': 'speed', 'lb/in': 'rate', 'N/mm': 'rate',
                  'ft': 'distance', 'm': 'distance'}
US = {'power': (1, 'hp'), 'torque': (1, 'lb-ft'), 'weight': (1, 'lb'), 'length': (1, 'in'), 'speed': (1, 'mph'), 'rate': (1, 'lb/in'), 'distance': (1, 'ft')}
TO_US = {'kW': 1 / 0.745699872, 'PS': 0.98632, 'bhp': 1, 'hp': 1, 'N·m': 0.737562149, 'lbs-ft': 1, 'lb-ft': 1, 'kg': 2.20462262, 'lb': 1,
         'mm': 1 / 25.4, 'in': 1, 'mph': 1, 'km/h': 1 / 1.609344, 'lb/in': 1, 'N/mm': 5.71014715, 'ft': 1, 'm': 3.2808399}


def h(value):
    return escape(str(value), quote=True)


def num(v, digits=None):
    if isinstance(v, float):
        if digits is None:
            digits = 0 if abs(v) >= 100 else 1 if abs(v) >= 10 else 2
        return f'{v:,.{digits}f}'
    return f'{v:,}' if isinstance(v, int) else str(v)


def qty(value, unit, digits=None, canonical_digits=0):
    """Static display: US customary first (the default), the source value kept when it was in other units.
    data-q / data-v carry the canonical US value so experience/spec-page.mjs can switch to metric or both."""
    q = QUANTITY_UNITS.get(unit)
    if not isinstance(value, (int, float)) or not q:
        if isinstance(value, list):
            return h(' · '.join(f'{i + 1}: {v}' for i, v in enumerate(value)) if all(isinstance(v, (int, float)) for v in value) else ' · '.join(map(str, value)))
        if unit in ('fraction', 'ratio') and isinstance(value, float) and value < 1 and unit == 'fraction':
            return f'{value * 100:.1f}%'
        shown = num(value, digits) if isinstance(value, (int, float)) else str(value)
        u = '' if unit in ('', 'label', 'ratio', 'text', 'size', 'dimensionless', None) else ' ' + unit
        return h(shown + u)
    us = value * TO_US[unit]
    label = US[q][1]
    main = f'<span data-q="{q}" data-v="{us:.6g}">{h(num(round(us, canonical_digits) if canonical_digits == 0 else round(us, canonical_digits), None if canonical_digits else 0))} {label}</span>'
    if label != unit and unit not in ('bhp', 'lbs-ft'):
        main += f' <small class="sp-source-unit">source {h(num(value))} {h(unit)}</small>'
    elif unit in ('bhp', 'PS', 'kW'):
        main += f' <small class="sp-source-unit">{h(unit)} rating</small>'
    return main


def fact_value(f):
    unit, value = f.get('unit') or '', f['value']
    digits = 1 if f.get('quantity') == 'length' else 0
    if f.get('key') == 'front' and isinstance(value, (int, float)):
        pct = value * 100 if value <= 1 else value
        return f'{pct:.1f}% front'
    if unit in ('s',) and isinstance(value, (int, float)):
        return f'{value:.2f} s' if value < 10 else f'{value:.1f} s'
    if unit == 'rpm':
        return h(f'{value:,} rpm')
    return qty(value, unit, canonical_digits=digits)


def badge(f):
    cls = f['evidence'].replace(' ', '-')
    extra = ' · '.join(filter(None, [f.get('basis'), f.get('standard') if f.get('standard') not in (None, 'as published') else None]))
    review = ' <span class="sp-review" title="Archive fact pending owner approval for publication">review</span>' if f.get('publish') == 'review' else ''
    return f'<span class="sp-ev sp-ev-{h(cls)}">{h(EVIDENCE_TEXT.get(f["evidence"], "Source"))}</span>' + (f' <span class="sp-basis">{h(extra)}</span>' if extra else '') + review


def facts_list(facts, numbers):
    out = []
    for f in facts:
        n = numbers.get(f['source'].get('url'))
        ref = f' <a class="sp-ref" href="#source-{n}" aria-label="Source {n} for {h(f["label"])}">[{n}]</a>' if n else ''
        note = f'<small class="sp-note">{h(f["note"])}</small>' if f.get('note') else ''
        out.append(f'<div><dt>{h(f["label"])}</dt><dd><span class="sp-value">{fact_value(f)}</span> {badge(f)}{ref}{note}</dd></div>')
    return '<dl class="sp-facts">' + ''.join(out) + '</dl>'


def intro(r):
    k, ident = r['key'], r['identity']
    layout = {'MR': 'mid-engine, rear-drive', 'FR': 'front-engine, rear-drive', 'RR': 'rear-engine, rear-drive', 'FF': 'front-wheel-drive',
              'AWD': 'all-wheel-drive'}.get(ident.get('layout'), '')
    parts = [f'The {h(r["title"])} is a {layout} car' if layout else f'The {h(r["title"])}']
    if 'power' in k:
        p = k['power']
        std = f' ({p["basis"]})' if p.get('basis') and p['basis'] not in ('as published',) else ''
        parts[0] += f' rated at {num(round(p["value"]))} hp{h(std)}'
        if 'torque' in k:
            parts[0] += f' and {num(round(k["torque"]["value"]))} lb-ft'
    if 'transmission' in k:
        parts[0] += f', with a {h(str(k["transmission"]["value"]).lower())}'
    text = parts[0] + '.'
    if 'weight' in k:
        w = k['weight']
        src = {'archive': 'Supercar X lists', 'road test': 'The cited road test weighed', 'manufacturer': 'The manufacturer lists'}.get(w['evidence'], 'Published figures give')
        basis = f' {w["basis"]}' if w.get('basis') in ('curb', 'as tested', 'dry', 'shipping') else ''
        text += f' {src} {num(round(w["value"]))} lb{h(basis)} weight'
        if 'front' in k:
            text += f' with {k["front"]["value"] * 100:.0f}% on the front axle'
        if 'weightPerHp' in k:
            text += f' — about {k["weightPerHp"]["value"]:.1f} lb per horsepower'
        text += '.'
    return text


def key_tiles(r):
    k = r['key']
    tiles = []
    def tile(label, value_html, note=''):
        tiles.append(f'<div class="sp-tile"><dt>{h(label)}</dt><dd>{value_html}{f"<small>{h(note)}</small>" if note else ""}</dd></div>')
    if 'power' in k:
        tile('Power', qty(k['power']['sourceValue'], k['power']['sourceUnit']), k['power'].get('basis') if k['power'].get('basis') not in (None, 'as published') else EVIDENCE_TEXT[k['power']['evidence']])
    if 'torque' in k:
        tile('Torque', qty(k['torque']['sourceValue'], k['torque']['sourceUnit']))
    if 'weight' in k:
        tile('Weight', qty(k['weight']['sourceValue'], k['weight']['sourceUnit']), (k['weight'].get('basis') or '') + ' · ' + EVIDENCE_TEXT[k['weight']['evidence']])
    if 'weightPerHp' in k:
        tile('Weight per hp', f'<span data-q="ppw" data-v="{k["weightPerHp"]["value"]:.4f}">{k["weightPerHp"]["value"]:.1f} lb/hp</span>', 'calculated from the two figures above')
    if 't60' in k:
        tile('0–60 mph', f'{k["t60"]["value"]:.1f} s', EVIDENCE_TEXT[k['t60']['evidence']])
    if 'et' in k:
        tile('Quarter mile', f'{k["et"]["value"]:.1f} s' + (f' @ {qty(k["trap"]["sourceValue"], k["trap"]["sourceUnit"])}' if 'trap' in k else ''), EVIDENCE_TEXT[k['et']['evidence']])
    return '<dl class="sp-key">' + ''.join(tiles) + '</dl>'


def panel(pid, r):
    title, text = PANEL_INTRO[pid]
    return (f'<div class="sp-try" data-sp-panel="{pid}"><button type="button" class="sp-try-open" aria-expanded="false" aria-controls="sp-{pid}-body">'
            f'<span>Try it · {h(title)}</span></button><p class="sp-try-lede">{h(text)}</p>'
            f'<div class="sp-try-body" id="sp-{pid}-body" hidden></div></div>')


def model_table(r):
    m = r.get('model')
    if not m:
        return ''
    labels = {'weight': 'Vehicle weight', 'front': 'Front share', 'wheelbase': 'Wheelbase', 'frontTrack': 'Front track', 'rearTrack': 'Rear track',
              'cg': 'CG height', 'hp': 'Peak power', 'hpRpm': 'Power peak', 'torque': 'Peak torque', 'torqueRpm': 'Torque peak',
              'redline': 'Shift rpm', 'gears': 'Gear ratios', 'finalDrive': 'Final drive', 'diameter': 'Driven tire diameter',
              'grip': 'Launch grip coefficient', 'cda': 'Drag area', 'frontSpring': 'Front spring', 'rearSpring': 'Rear spring',
              'frontMotion': 'Front motion ratio', 'rearMotion': 'Rear motion ratio', 'frontUnsprung': 'Front unsprung', 'rearUnsprung': 'Rear unsprung',
              'tireRate': 'Tire vertical rate', 'archFront': 'Front suspension', 'archRear': 'Rear suspension', 'drivetrain': 'Driven wheels', 'transmission': 'Transmission type'}
    units = {'weight': ('weight', 0), 'wheelbase': ('length', 1), 'frontTrack': ('length', 1), 'rearTrack': ('length', 1), 'cg': ('length', 1),
             'diameter': ('length', 2), 'hp': ('power', 0), 'torque': ('torque', 0), 'frontSpring': ('rate', 0), 'rearSpring': ('rate', 0),
             'frontUnsprung': ('weight', 0), 'rearUnsprung': ('weight', 0), 'tireRate': ('rate', 0)}
    rows = []
    for key, label in labels.items():
        inp = m['inputs'].get(key)
        if not inp:
            continue
        v = inp['value']
        if key in units:
            q, d = units[key]
            shown = f'<span data-q="{q}" data-v="{v}">{num(float(v), d)} {US[q][1]}</span>'
        elif key == 'front':
            shown = f'{v * 100:.1f}%'
        elif key == 'cda':
            shown = f'{v} ft²'
        elif isinstance(v, list):
            shown = h(' · '.join(map(str, v)))
        else:
            shown = h(f'{v:,}' if isinstance(v, (int, float)) and key.endswith('pm') or key == 'redline' else v)
        rows.append(f'<tr><th scope="row">{h(label)}</th><td>{shown}</td><td><span class="sp-ev sp-ev-{h(inp["evidence"].replace(" ", "-"))}">'
                    f'{h(EVIDENCE_TEXT.get(inp["evidence"], inp["evidence"]))}</span></td><td>{h(inp.get("basis") or "")}</td></tr>')
    estimated = sum(1 for i in m['inputs'].values() if i['evidence'] == 'estimate')
    return (f'<details class="sp-model" id="model-inputs"><summary>What the ESS model assumes for this car ({estimated} of {len(m["inputs"])} inputs are ESS estimates)</summary>'
            '<p>The experiments on this page and in the Vehicle Lab use exactly these inputs. Estimates are typical values for the vehicle type, '
            'not measurements of this car; edit them in the Lab if you know better. A model result that lands near a road test does not make an estimate a verified specification.</p>'
            '<div class="sp-table-wrap"><table><thead><tr><th scope="col">Input</th><th scope="col">Value</th><th scope="col">Evidence</th><th scope="col">Basis</th></tr></thead><tbody>'
            + ''.join(rows) + '</tbody></table></div></details>')


def spec_page(page, r, private):
    facts = r['facts']
    urls = list(dict.fromkeys(f['source']['url'] for f in facts if f['source'].get('url')))
    numbers = {u: i for i, u in enumerate(urls, 1)}
    publishers = {}
    for f in facts:
        publishers.setdefault(f['source'].get('url'), f['source'].get('publisher') or f['source'].get('title') or 'Source')
    runs = bool(r.get('model') and r['links'].get('lab') and not r['model'].get('competition'))
    sections, jumps = [], []
    for sid, heading, groups, pid in SECTIONS:
        group_facts = [f for f in facts if f['group'] in groups]
        show_panel = pid and runs and (pid != 'aero' or r['model']['inputs'].get('cda'))
        if not group_facts and not show_panel:
            continue
        jumps.append(f'<a href="#{sid}">{h(heading)}</a>')
        body = facts_list(group_facts, numbers) if group_facts else '<p class="sp-empty">No published value for this exact configuration yet. The experiment uses the labeled model inputs below.</p>'
        sections.append(f'<section class="sp-section" id="{sid}" aria-labelledby="{sid}-h"><h2 id="{sid}-h">{h(heading)}</h2>{body}'
                        + (panel(pid, r) if show_panel else '') + '</section>')
    refs = ''.join(f'<li id="source-{i}"><a href="{h(u)}" rel="noreferrer">{h(publishers.get(u))}</a></li>' for u, i in numbers.items())
    conflicts = ''
    if r['conflicts']:
        items = ''.join('<li><strong>' + h({'power': 'Power', 'torque': 'Torque', 'weight': 'Weight', 'wheelbase': 'Wheelbase', 'frontTrack': 'Front track',
                        'rearTrack': 'Rear track', 'finalDrive': 'Final drive', 'redline': 'Redline', 't60': '0–60 mph', 'et': 'Quarter mile', 'trap': 'Trap speed'}.get(c['key'], c['key']))
                        + '</strong> — ' + h(c['kind']) + ': ' + '; '.join(h(f'{v["label"]} {v["value"]}{(" " + v["unit"]) if v["unit"] and v["unit"] not in ("ratio",) else ""} ({v["publisher"] or v["evidence"]}{", " + v["basis"] if v.get("basis") and v["basis"] != "as published" else ""})') for v in c['values']) + '</li>'
                        for c in r['conflicts'])
        conflicts = f'<details class="sp-conflicts" open><summary>Where sources differ ({len(r["conflicts"])})</summary><p>Each value is shown with its own source and definition. ESS does not average or silently pick between them.</p><ul>{items}</ul></details>'
    related = ''
    if r.get('related'):
        related = '<section class="sp-related" aria-labelledby="related-h"><h2 id="related-h">Related specifications</h2><ul>' + ''.join(
            f'<li><a href="../{h(o["slug"])}/">{h(o["title"])}</a></li>' for o in r['related']) + '</ul><p><a href="../">All vehicle specifications</a></p></section>'
    compare = ('<section class="sp-section sp-compare" id="compare" aria-labelledby="compare-h"><h2 id="compare-h">Compare</h2>'
               '<p>Compare this configuration with up to two others from the ESS library. Values keep their sources; ESS model results are labeled separately.</p>'
               f'<div data-sp-compare><p><a href="../compare/?a={h(r["slug"])}">Open the specification comparison</a></p></div></section>')
    lab_link = ''
    if runs:
        lab_link = f'<a class="sp-button" data-sp-lab="build" href="../../experience/?via=reference{h(r["links"]["lab"]["build"])}">Open in the Vehicle Lab</a>'
    review_note = ''
    if private and r['review']['archiveFactsPending']:
        review_note = (f'<p class="sp-review-note">Private review: {r["review"]["archiveFactsPending"]} Supercar X archive facts marked <span class="sp-review">review</span> '
                       'appear only in this preview. They publish only if the owner approves archive publication scope.</p>')
    archive_note = ''
    arch = r['identity'].get('archive')
    if arch:
        archive_note = f'<p class="sp-heritage">Historical discovery source: <a href="{h(arch["capture"])}" rel="noreferrer">original Supercar X specification page</a> (Wayback Machine).</p>'
    data = json.dumps({k: r[k] for k in ('schema', 'id', 'slug', 'title', 'variant', 'identity', 'key', 'tires', 'model', 'links', 'compareWith')}, ensure_ascii=False, separators=(',', ':'))
    data = data.replace('</', '<\\/')
    desc = f'{r["title"]} specifications: ' + ', '.join(x.lower() for _, x, g, _ in SECTIONS if any(f['group'] in g for f in facts))[:120] + '. Sources, definitions and interactive gearing, tire and weight experiments.'
    body = f'''<main id="main" class="page sp-page" data-ess-page="specification">
<nav class="vr-breadcrumb" aria-label="Breadcrumb"><a href="../../">Home</a> <span aria-hidden="true">/</span> <a href="../">Vehicle specifications</a></nav>
<header class="sp-hero"><p class="sp-eyebrow">{h(r["kind"])}</p><h1>{h(r["title"])}</h1><p class="sp-variant">{h(r["variant"])}</p>
<p class="sp-intro">{intro(r)}</p>{key_tiles(r)}
<div class="sp-actions">{('<a class="sp-button primary" href="#explore">Explore this car</a>' if runs else '')}<a class="sp-button" href="#compare">Compare</a>{lab_link}<span class="sp-units" data-sp-units></span></div>
{review_note}</header>
<div class="sp-status" role="status" aria-live="polite" data-sp-status></div>
<div class="sp-change-bar" data-sp-changes hidden></div>
<nav class="sp-jumps" aria-label="Specification sections" id="explore">{''.join(jumps)}<a href="#compare">Compare</a><a href="#sources">Sources</a></nav>
<div class="sp-body">{''.join(sections)}{compare}
{model_table(r)}{conflicts}
<section class="sp-sources" id="sources" aria-labelledby="sources-h"><h2 id="sources-h">Sources and definitions</h2>{archive_note}<ol>{refs}</ol>
<p class="sp-legend"><span class="sp-ev sp-ev-manufacturer">Manufacturer</span> factory specification · <span class="sp-ev sp-ev-road-test">Road test</span> measured on the cited test car · <span class="sp-ev sp-ev-published">Published</span> reported by the cited publication · <span class="sp-ev sp-ev-archive">Supercar X archive</span> historical figure, not re-verified · <span class="sp-ev sp-ev-estimate">ESS estimate</span> modeling assumption. Weights state their definition (curb, as tested, dry); power states its rating standard where known.</p>
<p><a href="../../contact/?from=/vehicles/{h(r["slug"])}/&amp;type=correction">Suggest a correction</a></p></section>
{related}</div>
<script type="application/json" id="ess-spec-data">{data}</script>
</main>'''
    page(f'vehicles/{r["slug"]}/index.html', f'{r["title"]} specifications | Endicott Speed Shop', desc, body, 'Vehicles',
         '<link rel="stylesheet" href="../../assets/ess-spec.css"><script type="module" src="../../experience/spec-page.mjs"></script>', indexable=True)


def render_all(page, pending, data, runtime, private, reference_page):
    """Build the knowledge record set from Work's collected publication facts, then render every page."""
    published = []
    for p in pending:
        groups = {g: [dict(f) for f in rows] for g, rows in p['groups'].items()}
        sources = {k: {'url': v.get('url'), 'publisher': v.get('publisher'), 'title': v.get('title')} for k, v in p['sources'].items()}
        published.append(dict(rid=p['rid'], path=p['path'], title=p['title'], variant=p['variant'], kind=p['kind'], indexable=p['indexable'],
                              groups=groups, sources=sources, fixture=p['fixture']))
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as tmp:
        json.dump(published, tmp)
    cmd = ['node', str(HERE / 'knowledge' / 'knowledge.mjs'), tmp.name] + (['--private'] if private else [])
    summary = subprocess.check_output(cmd, text=True)
    os.unlink(tmp.name)
    print('knowledge', summary.strip())
    records = {r['id']: r for r in json.loads((HERE / 'knowledge' / 'vehicle-knowledge.json').read_text())['records']}
    template = os.environ.get('ESS_SPEC_TEMPLATE', 'spec')
    from spec_discovery import DISCOVERY_SLUGS, render as discovery_page
    for p in pending:
        r = records.get(p['rid'])
        if template == 'reference' or not p['indexable'] or r is None:
            reference_page(page, p['path'], p['title'], p['variant'], p['kind'], p['groups'], p['sources'], p['fixture'], p['rid'],
                           p['indexable'], p['note_html'])
        elif os.environ.get('ESS_SPEC_DISCOVERY') == '1' and r['slug'] in DISCOVERY_SLUGS:
            discovery_page(page, r, private)  # owner-review demonstration only (F40); off in the public build
        else:
            spec_page(page, r, private)
