"""ESS specification page, third demonstration: Candidate A identity + guided experience (Claude, 25 Nov 2026 night).

Owner direction: return to Candidate A (site/v12-growth 56303cb, PR #9) as the visual foundation: its own stylesheet
(copied unchanged to assets/candidate-a/site.css), logo, header, navigation, sidebar and footer markup, and carry the
guided engagement of the F40 and Firebird demonstrations into it. Color is added only where it carries meaning
(assets/ess-guided.css): Candidate A's own before/after pair for stock vs your change, green/red for engineering limits,
Candidate A's category colors for related articles, calculators and Lab experiments.

The page is written as a complete document (not through the current site shell) so nothing from later identities leaks in.
The questions are not authored per car: experience/spec-guided.mjs holds a registry of reusable engineering experiences,
each with data requirements, a relevance score and a data-driven title, and selects and orders them from the vehicle's own
record. Enabled only with ESS_SPEC_GUIDED=1 for slugs in GUIDED_SLUGS.
"""
import json
from pathlib import Path

from spec_page import h, fact_value, model_table, EVIDENCE_TEXT, intro

GUIDED_SLUGS = None  # every specification page (overnight convergence, 26 Nov); was the Fox Mustang only
ROOT = Path(__file__).resolve().parent.parent
GROUPS = [('engine', 'Engine'), ('transmission', 'Transmission & axle'), ('weight', 'Weight'), ('dimensions', 'Dimensions'),
          ('tires', 'Wheels & tires'), ('suspension', 'Suspension'), ('brakes', 'Brakes'), ('performance', 'Performance'),
          ('aero', 'Aerodynamics'), ('chassis', 'Structure'), ('capacities', 'Capacities')]
# Model inputs that answer a specification question when the reviewed publication set has no fact for it.
INPUT_ROWS = [('weight', 'Weight', 'weight', 'Vehicle weight'), ('dimensions', 'wheelbase', 'length', 'Wheelbase'),
              ('dimensions', 'frontTrack', 'length', 'Front track'), ('dimensions', 'rearTrack', 'length', 'Rear track'),
              ('transmission', 'gears', None, 'Gear ratios'), ('transmission', 'finalDrive', None, 'Axle ratio'),
              ('weight', 'front', None, 'Weight on the front axle'), ('engine', 'redline', None, 'Shift rpm')]
EXPLORE = {'engine': 'power', 'transmission': 'gearing', 'weight': 'balance', 'tires': 'tires', 'performance': 'launch'}


def short(text, n=64):
    """A basis note short enough for a key-figure tile (the full basis is in the model-inputs table)."""
    text = (text or '').strip()
    return text if len(text) <= n else ''


def row(label, value_html, ev, note='', review=False):
    tag = ' <span class="sg-est">estimate</span>' if ev == 'estimate' else ''
    src = f'<span class="sg-src"><span class="sp-ev sp-ev-{h(ev.replace(" ", "-"))}">{h(EVIDENCE_TEXT.get(ev, ev))}</span>{(" " + h(note)) if note else ""}</span>'
    return f'<div class="sg-row"><dt>{h(label)}</dt><dd><span class="sg-v">{value_html}</span>{tag}{src}</dd></div>'


def input_value(key, inp):
    v = inp['value']
    if key in ('weight',):
        return f'<span data-q="weight" data-v="{v}">{v:,} lb</span>'
    if key in ('wheelbase', 'frontTrack', 'rearTrack'):
        return f'<span data-q="length" data-v="{v}">{v:g} in</span>'
    if key == 'gears':
        return h(' · '.join(f'{i + 1}: {g:g}' for i, g in enumerate(v)))
    if key == 'front':
        return f'{v * 100:.0f}%'
    if key == 'redline':
        return f'{v:,} rpm'
    return h(f'{v:g}' if isinstance(v, float) else v)


def render(page, r, private):
    # Same destinations, analytics switch, link-preview tags and sitemap as every other generated page (_build/build.py).
    shell = page.__globals__
    nav = ''.join(f'<a href="../../{u}"{" class=on" if n == "Vehicles" else ""}>{n}</a>' for n, u, _ in shell['NAV'])
    side = ''.join(f'<a href="../../{u}">{n}<small>{d}</small></a>' for n, u, d in shell['NAV'])
    if not private:
        shell['URLS'].append(f'vehicles/{r["slug"]}/')
    facts, ident, model = r['facts'], r['identity'], r.get('model') or {}
    inputs = model.get('inputs', {})
    runs = bool(model and r['links'].get('lab') and not model.get('competition'))
    urls = list(dict.fromkeys(f['source']['url'] for f in facts if f['source'].get('url')))
    numbers = {u: i for i, u in enumerate(urls, 1)}
    pubs = {}
    for f in facts:
        pubs.setdefault(f['source'].get('url'), f['source'].get('publisher') or f['source'].get('title') or 'Source')

    groups_html = []
    for g, title in GROUPS:
        rows = [row(f['label'], fact_value(f), f['evidence'], f.get('note') or '') for f in facts if f['group'] == g]
        have = {f['label'].lower() for f in facts if f['group'] == g}
        for grp, key, q, label in INPUT_ROWS:
            if grp == g and key in inputs and label.lower() not in have:
                inp = inputs[key]
                rows.append(row(label, input_value(key, inp), inp['evidence'], inp.get('basis') or ''))
        if not rows:
            continue
        q = EXPLORE.get(g)
        link = f'<a class="sg-seeit" href="#explore" data-sg-q="{q}">See it at work</a>' if q and runs else ''
        groups_html.append(f'<section class="sg-group" aria-labelledby="g-{g}"><div class="sg-group-head"><h3 id="g-{g}">{h(title)}</h3>{link}</div><dl>{"".join(rows)}</dl></section>')
    missing = []
    if not (r.get('tires') or {}).get('tireRear'):
        missing.append('Tire size (the model uses an estimated diameter)')
    if inputs.get('finalDrive', {}).get('evidence') == 'estimate':
        missing.append('Axle ratio for this exact car')
    if inputs.get('front', {}).get('evidence') == 'estimate':
        missing.append('Front/rear weight split')
    if inputs.get('redline', {}).get('evidence') == 'estimate':
        missing.append('Shift rpm / rev limit')
    missing_html = ''
    if missing:
        missing_html = ('<section class="sg-missing panel" aria-labelledby="missing-h"><h3 id="missing-h">Not on record yet</h3>'
                        '<p>These figures are not in the reviewed sources for this configuration, so the model uses labeled estimates. If you have the car, you can measure some of them yourself.</p>'
                        '<ul>' + ''.join(f'<li>{h(m)}</li>' for m in missing) + '</ul>'
                        '<p class="sg-measure"><a class="sg-cat cat-data" href="../../tools/scale-delta/">Calculator · Part weight from corner scales</a> '
                        '<a class="sg-cat cat-data" href="../../tools/cg-builder/">Calculator · Balance &amp; CG builder</a> '
                        f'<a class="sg-cat cat-notes" href="../../contact/?from=/vehicles/{h(r["slug"])}/&amp;type=measurement">Send a measurement</a></p></section>')

    k = r['key']
    def fig(label, val, unit, note, ev=None):
        tag = ' <span class="sg-est">estimate</span>' if ev == 'estimate' else ''
        return f'<div class="sg-fig"><dt>{h(label)}</dt><dd><b>{val}</b> <span>{h(unit)}</span>{tag}<small>{h(note)}</small></dd></div>'
    figs = []
    if 'power' in k: figs.append(fig('Power', round(k['power']['value']), 'hp', f'at {inputs["hpRpm"]["value"]:,} rpm' if inputs.get('hpRpm') else ''))
    if 'torque' in k: figs.append(fig('Torque', round(k['torque']['value']), 'lb-ft', f'at {inputs["torqueRpm"]["value"]:,} rpm' if inputs.get('torqueRpm') else ''))
    w = k.get('weight') or (inputs.get('weight') and {'value': inputs['weight']['value'], 'evidence': inputs['weight']['evidence']})
    if w: figs.append(fig('Weight', f'<span data-q="weight" data-v="{w["value"]}" data-bare>{round(w["value"]):,}</span>', 'lb', short((k.get('weight') or inputs.get('weight') or {}).get('basis')), w.get('evidence')))
    if w and 'power' in k: figs.append(fig('Weight per hp', f'{w["value"] / k["power"]["value"]:.1f}', 'lb/hp', 'from the two figures above'))
    if inputs.get('gears'): figs.append(fig('Transmission', f'{len(inputs["gears"]["value"])}-speed', 'manual' if inputs.get('transmission', {}).get('value') == 'manual' else '', f'overdrive {inputs["gears"]["value"][-1]:g}' if inputs['gears']['value'][-1] < 1 else ''))
    if inputs.get('finalDrive'): figs.append(fig('Axle ratio', f'{inputs["finalDrive"]["value"]:.2f}', ':1', short(inputs['finalDrive'].get('basis')) if inputs['finalDrive']['evidence'] == 'estimate' else '', inputs['finalDrive']['evidence']))

    refs = ''.join(f'<li id="source-{i}"><a href="{h(u)}" rel="noreferrer">{h(pubs.get(u))}</a></li>' for u, i in numbers.items())
    data = json.dumps({x: r[x] for x in ('schema', 'id', 'slug', 'title', 'variant', 'identity', 'key', 'tires', 'model', 'links', 'compareWith', 'facts')},
                      ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    title = r['title']
    name = title.split(' · ')[0]
    variant = title.split(' · ')[1] if ' · ' in title else ''
    desc = (f'{title} specifications with sources, and guided experiments built from its own numbers: power to weight, launch grip, '
            'tires, axle gears, weight balance, a first-mods plan and comparisons.')
    explore = ''
    if runs:
        explore = '''<section class="section sg-explore" id="explore" aria-labelledby="explore-h">
<div class="section-label">Explore this car</div><h2 id="explore-h">From the numbers to what they mean</h2>
<p>Pick a question. Every answer is worked out from this car’s specifications through the ESS model, and every change you try follows you through the page and into the Vehicle Lab.</p>
<div class="sg-legend" aria-label="Color key"><span><i class="k-stock"></i>Stock</span><span><i class="k-mod"></i>Your change</span><span><i class="k-ok"></i>Within grip</span><span><i class="k-over"></i>Past the limit</span><span><i class="k-est"></i>Estimate</span></div>
<div class="sg-bar" data-sg-bar aria-label="Your car, live from the model"></div>
<div class="sg-layout"><nav class="sg-toc" aria-label="Questions"><ol data-sg-toc><li class="sg-loading">Loading questions…</li></ol></nav>
<section class="panel sg-answer" data-sg-answer tabindex="-1" aria-live="polite"></section></div>
</section>'''
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{h(title)} specifications | Endicott Speed Shop</title>
<meta name="description" content="{h(desc)}">
<link rel="canonical" href="https://endicottspeedshop.com/vehicles/{h(r["slug"])}/">
{shell['GA']}
{shell['share_tags'](h(title + ' specifications | Endicott Speed Shop'), h(desc), 'https://endicottspeedshop.com/vehicles/' + h(r['slug']) + '/')}
<meta name="theme-color" content="#ffffff">
<link rel="icon" type="image/png" href="../../logo-round.png">
{('<meta name="robots" content="noindex,nofollow">' if private else '')}
<link rel="stylesheet" href="../../assets/candidate-a/site.css">
<link rel="stylesheet" href="../../assets/ess-guided.css">
<script type="module" src="../../experience/spec-guided.mjs"></script>
</head>
<body>
<header class="site-header"><div class="header-inner">
<div class="brand-wrap"><a href="../../" class="brand" aria-label="Endicott Speed Shop home"><img src="../../logo-horizontal-tight.png" alt="Endicott Speed Shop — Measure, Test, Improve" width="611" height="192"></a><a class="beta-pill" href="../../about/#beta" title="This site is in beta: tools and articles are still being checked and expanded">Beta</a></div>
<nav class="topnav" aria-label="Main navigation">{nav}</nav>
<button class="menu-toggle" id="menuToggle" aria-label="Open menu" aria-expanded="false"><div class="menu-lines"><span></span><span></span><span></span></div></button>
</div></header>
<aside class="sidebar" id="sidebar"><button class="close-btn" id="closeBtn" aria-label="Close menu">×</button>
<nav><a href="../../">Home<small>Start here</small></a>{side}</nav>
<p class="hint" style="margin-top:20px">This site is in beta: tools and articles are still being checked and expanded. <a href="../../contact/">Spot a problem? Tell us.</a></p>
</aside>
<main class="page sg-page" id="main">
<nav class="sg-crumbs" aria-label="Breadcrumb"><a href="../../">Home</a> / <a href="../">Vehicle specifications</a></nav>
<section class="sg-hero" aria-labelledby="sg-title"><div class="sg-hero-copy">
<div class="kicker">Vehicle specification · {h(ident.get("category") or "")}</div>
<h1 id="sg-title">{h(name)}</h1>
<p class="sg-variant">{h(r.get("variant") or variant)}</p>
<p class="lede" data-sg-lede>{intro(dict(r, title=name))}</p>
<div class="action-row">{('<a class="btn primary" href="#explore">Explore this car</a>' if runs else '')}<a class="btn secondary" href="#specifications">Specifications</a></div>
</div>
<dl class="sg-figs" aria-label="Key figures">{"".join(figs)}</dl></section>
{(f'<p class="sg-private note">Private review build. Model results are ESS estimates and labeled as such; nothing on this page is published.</p>' if private else '')}
{explore}
<section class="section sg-specs" id="specifications" aria-labelledby="specs-h">
<div class="sg-specs-head"><div><div class="section-label">Specifications</div><h2 id="specs-h">What the sources say</h2></div>
<label class="sg-toggle"><input type="checkbox" data-sg-sources> Show sources and definitions</label></div>
<div class="sg-groups" data-sg-groups>{"".join(groups_html)}</div>
{missing_html}
{model_table(r) if model else ''}
<section class="sg-sources" id="sources" aria-labelledby="sources-h"><h3 id="sources-h">Sources</h3><ol>{refs}</ol>
<p class="hint">Model inputs list their own sources in the table above. <a href="../../contact/?from=/vehicles/{h(r["slug"])}/&amp;type=correction">Suggest a correction</a></p></section>
</section>
<script type="application/json" id="ess-spec-data">{data}</script>
</main>
<footer class="footer"><div class="line"><span>© 2026 Endicott Speed Shop · Beta — <a href="../../contact/">report a problem</a></span><span><a href="../../privacy/">Privacy</a> · <a href="../../contact/">Contact</a></span></div></footer>
<script src="../../assets/candidate-a/site.js"></script>
</body>
</html>'''
    out = ROOT / 'vehicles' / r['slug'] / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding='utf-8')
    print('wrote', out.relative_to(ROOT), '(Candidate A guided demonstration)')
