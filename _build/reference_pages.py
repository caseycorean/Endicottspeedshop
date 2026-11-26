"""Static vehicle pages. Runtime links come from the same Lab resolver as the Lab."""
from collections import defaultdict
from html import escape
import csv
import json
import os
from pathlib import Path
import re
import subprocess

from reference_comparison import build_comparison

HERE = Path(__file__).parent
GROUPS = {
    'engine': 'Engine', 'transmission': 'Transmission & gearing', 'capacities': 'Capacities',
    'chassis': 'Chassis & structure', 'dimensions': 'Dimensions', 'weight': 'Weight & balance',
    'tires': 'Tires & wheels', 'suspension': 'Suspension & steering', 'brakes': 'Brakes',
    'aero': 'Aerodynamics', 'performance': 'Performance',

}
LABELS = {
    'peak_power': 'Rated power', 'peak_torque': 'Rated torque', 'peak_power_rpm': 'Power peak',
    'peak_torque_rpm': 'Torque peak', 'front_share': 'Static weight on front axle',
    'zero_to_60': '0–60 mph', 'quarter_mile_et': 'Quarter-mile time', 'quarter_mile_trap': 'Quarter-mile trap speed',
    'braking_60_to_0': 'Braking 60–0 mph', 'braking_70_to_0': 'Braking 70–0 mph',
    'braking_100_to_0': 'Braking 100–0 mph', 'cda': 'Drag area (CdA)', 'cd': 'Drag coefficient (Cd)',
    'type_front': 'Front suspension', 'type_rear': 'Rear suspension', 'fuel_capacity': 'Fuel capacity',
    'oe_tire_category': 'Original-equipment tire category', 'final_drive': 'Final drive ratio',
}
EVIDENCE = {
    'manufacturer': 'Manufacturer', 'independent_test': 'Independent test', 'published': 'Published',
    'calculated': 'Calculated from source', 'historical': 'Supercar X archive', 'estimated': 'Estimate',
}
GIFT = {'A': 'automatic', 'M': 'manual', 'S': 'automated manual'}
QUESTIONS = {
    'strip': ('Quarter-mile replay', 'Watch two setups launch and see how gearing or tire grip changes the run.'),
    'oval': ('Test-oval replay', 'Watch the same cars brake, turn and accelerate on a synthetic course.'),
    'performance': ('Gearing & traction', 'See speeds in each gear and where wheel torque exceeds available grip.'),
    'load-transfer': ('Tire loads', 'Brake and turn together to see what each tire is carrying.'),
    'balance': ('Weight & balance', 'Move or change a part and compare the load across both axles.'),
    'spring-rate': ('Ride frequency', 'See what spring rate and motion ratio do at the wheel.'),
}
EDITORIAL_HOLD = {
    'sx-1977-pontiac-supercar-x-firebird-formula': 'ESS development predecessor. Owner approval required for project details.',
}

def h(value):
    return escape(str(value), quote=True)

def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

def field_name(key):
    return LABELS.get(key, key.replace('_', ' ').capitalize())

def clean_units(unit):
    return '' if unit in ('label', 'ratio', 'text', None) else unit

def format_value(value, unit, group):
    if unit in ("fraction", "ratio") and group == "weight" and isinstance(value, (int, float)):
        return f"{value * 100:.5g}% <small>Source fraction {value}</small>"
    if isinstance(value, list):
        if all(isinstance(v, (int, float)) for v in value):
            return ' · '.join(f'{i + 1}: {v}' for i, v in enumerate(value))
        return ' · '.join(h(v) for v in value)
    if isinstance(value, dict):
        return h(json.dumps(value, ensure_ascii=False))
    units = clean_units(unit)
    shown = format(value, ',') if isinstance(value, (int, float)) else str(value)
    quantity = {
        'lb': 'weight', 'lbs': 'weight', 'kg': 'weight', 'hp': 'power', 'kW': 'power', 'PS': 'power',
        'lb-ft': 'torque', 'N·m': 'torque', 'mph': 'speed', 'km/h': 'speed', 'lb/in': 'rate',
        'N/mm': 'rate', 'in': 'length', 'mm': 'length', 'ft': 'distance', 'm': 'distance',
    }.get(unit)
    text = h(shown + (' ' + units if units else ''))
    if quantity and isinstance(value, (int, float)):
        return (f'<span data-spec-quantity="{quantity}" data-spec-value="{value}" '
                f'data-spec-unit="{h(unit)}">{text}</span><small class="vr-converted" hidden></small>')
    return text

def row(label, value, unit, evidence, source, note='', key=''):
    return dict(label=label, value=value, unit=unit, evidence=evidence, source=source, note=note, key=key)

def approved_groups(review, rid, sources, default_evidence='published'):
    sources[rid] = {'url':review['url'], 'publisher':review['publisher'], 'title':review['publisher']}
    attribution = {}
    for i, (publisher,url,labels,*kind) in enumerate(review.get('additional',[]),1):
        sid = f'{rid}-source-{i}'
        sources[sid] = {'url':url,'publisher':publisher,'title':publisher}
        attribution.update(dict.fromkeys(labels,(sid, kind[0] if kind else None)))
    selected = {}
    declared = {label for facts in review['fields'].values() for label,*_ in facts}
    if not set(attribution) <= declared:
        raise ValueError(f'Unused source attribution {rid}')
    for group, facts in review['fields'].items():
        if group not in GROUPS or not facts:
            raise ValueError(f'Invalid approved group {rid} {group}')
        selected[group] = []
        for label,value,*rest in facts:
            unit,note = (rest+['',''])[:2]
            evidence = review.get('evidence', default_evidence)
            sid, source_kind = attribution.get(label,(rid,None))
            evidence = source_kind or evidence
            if label == 'Static weight on front axle' and 'test scales' in note:
                evidence = 'independent_test'
            if label == 'As tested weight' or (group == 'performance' and note.startswith(('Independent','Standing'))):
                evidence = 'independent_test'
            selected[group].append(row(label,value,unit,evidence,sid,note))
    return selected

def curated_groups(record, sources):
    result = defaultdict(list)
    mappings = {
        'mass': 'weight', 'geometry': 'dimensions', 'tires_wheels': 'tires', 'suspension': 'suspension',
        'brakes': 'brakes', 'powertrain': 'engine', 'aero': 'aero', 'performance_validation': 'performance',
        'capacities': 'capacities', 'chassis': 'chassis',
    }
    for original, group in mappings.items():
        for key, field in record.get(original, {}).items():
            if not isinstance(field, dict) or field.get('value') is None or field.get('source') not in sources:
                continue
            if group == 'capacities' or key in ('fuel_capacity','engine_oil_capacity','oil_capacity','coolant_capacity','transmission_fluid_capacity','differential_fluid_capacity'):
                destination = 'capacities'
            else:
                destination = 'transmission' if key in ('gear_ratios', 'final_drive', 'driven_wheels', 'differential_type') else group
            note = ' '.join(filter(None, (field.get('note'), field.get('conditions'))))
            label = field_name(key)
            if key in ('peak_power', 'peak_torque') and 'gross' in note.lower():
                label += ' (gross)'
            result[destination].append(row(label, field['value'], field.get('unit'), field.get('evidence'),
                                           field['source'], note, key))
            for alt in field.get('alternates', []):
                if alt.get('source') in sources and alt.get('value') is not None:
                    result[destination].append(row(label + ' · alternate source', alt['value'],
                                                   alt.get('unit', field.get('unit')), alt.get('evidence','published'),
                                                   alt['source'], alt.get('note','')))
    return result

def format_variant(identity):
    code = identity.get('transmission', '')
    transmission = f'{code[1:]}-speed {GIFT[code[0]]}' if len(code) > 1 and code[0] in GIFT else code
    return ' · '.join(filter(None, (identity.get('body'), transmission, identity.get('market'))))

def render_rows(rows, group, source_numbers):
    return '<dl class="vr-rows">' + ''.join(
        f'<div><dt>{h(f["label"])}</dt><dd>{format_value(f["value"], f["unit"], group)}'
        f'<small class="vr-evidence">{h(EVIDENCE.get(f["evidence"], "Source"))}'
        f' <a href="#source-{source_numbers[f["source"]]}">[{source_numbers[f["source"]]}]<span class="vr-sr"> source for {h(f["label"])}</span></a></small>'
        + (f'<small class="vr-note">{h(f["note"])}</small>' if f['note'] else '')
        + '</dd></div>' for f in rows) + '</dl>'

def card(title, body, href, capability):
    return (f'<article class="vr-action"><h3><a href="{h(href)}" data-ess-capability="{h(capability)}">{h(title)}</a></h3>'
            f'<p>{h(body)}</p></article>')

def discovery(rel='', include_hub=True):
    return ('<section class="vr-discovery" aria-labelledby="vr-discover-title"><h2 id="vr-discover-title">Which change matters?</h2>'
            '<p>Pick a question and watch the model respond.</p><div class="vr-action-grid">'
            + card('What happens at the launch?', QUESTIONS['strip'][1], rel+'experience/#compare', 'strip')
            + card('Which setup carries more corner speed?', QUESTIONS['oval'][1], rel+'experience/?event=oval#compare', 'oval')
            + card('Where does load move under braking?', QUESTIONS['load-transfer'][1], rel+'grip/', 'load-transfer')
            + '</div>' + (f'<p><a href="{rel}experiments/">Explore the experiments →</a></p>' if include_hub else '') + '</section>')

SECTION_OPPORTUNITIES = {
    'transmission': ('performance', 'What changes at the tire when you change a gear?'),
    'tires': ('performance', 'Explore how gearing and tire grip shape traction.'),
    'weight': ('balance', 'See how moving weight changes axle loads.'),
    'suspension': ('spring-rate', 'See how spring rate affects ride frequency.'),
    'performance': ('strip', 'What determines this car’s performance? Explore how traction, gearing and weight shape the run.'),
}

def available_experiments(fixture):
    if not fixture:
        return {}
    actions = {}
    for key, (title, description) in QUESTIONS.items():
        readiness_key = {'strip':'quarter', 'performance':'quarter'}.get(key,key)
        readiness = fixture['readiness'][readiness_key]
        if readiness['missing'] or key == 'balance' and not fixture['balanceCalculator']:
            continue
        if key in ('strip','oval','performance'):
            href = '../../experience/?via=reference' + fixture[key]
        else:
            route = 'cg-builder' if key == 'balance' else key
            href = '../../tools/' + route + '/' + fixture['tools']
        if readiness['estimated']:
            description += ' Uses editable model estimates.'
        actions[key] = (title,description,href)
    return actions

def section_opportunity(group, actions):
    if group not in SECTION_OPPORTUNITIES:
        return ''
    capability, label = SECTION_OPPORTUNITIES[group]
    if capability not in actions:
        return ''
    return (f'<p class="vr-section-invitation"><a data-ess-capability="{capability}" '
            f'href="{h(actions[capability][2])}">{h(label)} →</a></p>')

def experiment_panel(fixture, rid, actions):
    if not actions:
        return ('<section class="vr-workbench" id="experiment"><h2>Engineering experiments</h2>'
                '<p>An exact setup with the inputs needed for a working experiment is pending for this configuration.</p>'
                '<p><a href="../../articles/">Read the engineering guides</a></p></section>')
    return (f'<section class="vr-workbench" id="experiment"><h2>Explore this vehicle</h2>'
            '<p>What determines this car’s performance? Try an exact configuration and see how available inputs shape the result. '
            'Lab results depend on the displayed model assumptions. Instrumented road tests have their own conditions.</p>'
            '<div class="vr-action-grid">'
            + ''.join(card(*action, key) for key,action in actions.items())
            + '</div><p class="vr-related"><a href="../../articles/traction-circle/">Understand tire grip</a>'
            ' <a href="../../articles/weight-distribution-50-50/">Understand weight distribution</a>'
            ' <a href="../../plan/">Plan a build</a></p>'
            f'<div class="vr-button-row"><button type="button" class="vr-button" data-save-reference="{h(rid)}" hidden>Save to My Garage</button>'
            f'<button type="button" class="vr-button" data-share-reference="../../experience/{h(fixture["build"])}" hidden>Share the stock setup</button>'
            '<a href="../../experience/#garage">Open My Garage</a></div><p role="status" class="vr-status" data-reference-status></p></section>')

_PENDING = None

def vehicle_page(page, path, title, variant, kind, groups, sources, fixture, rid, indexable=True, note_html=''):
    """Collect during build(); pages render after the shared knowledge record is built (spec_page.py)."""
    if _PENDING is not None:
        _PENDING.append(dict(path=path, title=title, variant=variant, kind=kind, groups=groups, sources=sources,
                             fixture=fixture, rid=rid, indexable=indexable, note_html=note_html))
        return
    reference_page(page, path, title, variant, kind, groups, sources, fixture, rid, indexable, note_html)

def reference_page(page, path, title, variant, kind, groups, sources, fixture, rid, indexable=True, note_html=''):
    source_ids = list(dict.fromkeys(f['source'] for g in GROUPS for f in groups.get(g, [])))
    source_numbers = {key: i for i, key in enumerate(source_ids, 1)}
    section_nav = ''.join(f'<a href="#{g}">{h(label)}</a>' for g, label in GROUPS.items() if groups.get(g))
    opportunities = available_experiments(fixture)
    sections = ''.join(f'<section class="vr-spec" id="{g}"><h2>{h(label)}</h2>{render_rows(groups[g],g,source_numbers)}'
                       + section_opportunity(g, opportunities) + '</section>'
                       for g, label in GROUPS.items() if groups.get(g))
    preferred = [('engine', 'Rated power'), ('weight', 'Curb weight'), ('dimensions', 'Wheelbase'), ('transmission', 'Final drive ratio')]
    top = []
    for g, label in preferred:
        facts = groups.get(g, [])
        f = next((f for f in facts if f['label'] == label or f['label'] == label + ' (gross)'), None)
        if f is None and g == 'weight':
            f = next((f for f in facts if 'weight' in f['label'].lower()), None)
        if f:
            top.append(f'<a href="#{g}"><strong>{format_value(f["value"], f["unit"],g)}</strong><span>{h(f["label"])}</span></a>')
    refs = ''.join(f'<li id="source-{i}"><a href="{h(sources[key]["url"])}" rel="noreferrer">{h(sources[key]["title"])}</a>'
                   f'<small>{h(sources[key]["publisher"])}</small></li>' for key, i in source_numbers.items())
    desc = f'Specifications for the {title}. ' + ', '.join(label.lower() for g, label in GROUPS.items() if groups.get(g)) + '.'
    actions = ('<a class="vr-button primary" href="#experiment">Explore this vehicle</a>' if opportunities else '')
    if indexable:
        actions += (f'<a class="vr-button" data-ess-capability="compare" href="../compare/?a={h(path)}">'
                    'Compare with another vehicle</a>')
    pathway = 'vehicles/' + path + '/'
    body = f'''<main id="main" class="page vr-page" data-ess-page="reference">
    <nav class="vr-breadcrumb" aria-label="Breadcrumb"><a href="../../">Home</a> <span aria-hidden="true">/</span> <a href="../">Vehicle specifications</a></nav>
    <section class="vr-hero"><p class="vr-eyebrow">{h(kind)}</p><h1>{h(title)}</h1><p class="vr-variant">{h(variant)}</p>
    {note_html}<div class="vr-facts">{''.join(top)}</div>
    <div class="vr-button-row">{actions}<a class="vr-button" href="#specifications">Find a specification ↓</a></div></section>
    <div class="vr-detail-layout"><div id="specifications" class="vr-specification">
    <div class="vr-section-head"><h2>Specifications</h2><span data-reference-units></span></div>
    <nav class="vr-jumps" aria-label="Specifications by section">{section_nav}<a href="#sources">Sources</a></nav>
    {sections}
    <details class="vr-missing"><summary>About missing values and source conventions</summary>
    <p>Blank fields have no usable source for this exact configuration. Tested weights and times describe the cited test vehicle. Tire sizing and gross/net power ratings keep their source conventions.</p>
    </details>
    <details class="vr-missing" id="sources" open><summary>Sources and provenance</summary><ol class="vr-sources">{refs}</ol></details>
    <p><a href="../../contact/?from=/{h(pathway)}&amp;type=correction">Suggest a correction</a></p></div>
    {experiment_panel(fixture, rid, opportunities)}</div></main>'''
    page(pathway+'index.html', f'{title} specifications | Endicott Speed Shop', desc, body, 'Vehicles',
         '<script type="module" src="../../experience/reference-page.mjs"></script>', indexable=indexable)

def archive_groups(item, source_key):
    rec = item['record']
    groups = defaultdict(list)
    fields = {
        'weight': ('weight', 'Archive curb weight', 'lb'), 'front': ('weight', 'Static weight on front axle', ''),
        'wheelbase': ('dimensions', 'Wheelbase', 'in'), 'frontTrack': ('dimensions', 'Front track', 'in'),
        'rearTrack': ('dimensions', 'Rear track', 'in'), 'hp': ('engine', 'Archive rated power', 'hp'),
        'hpRpm': ('engine', 'Power peak', 'rpm'), 'torque': ('engine', 'Archive rated torque', 'lb-ft'),
        'torqueRpm': ('engine', 'Torque peak', 'rpm'), 'redline': ('engine', 'Redline', 'rpm'),
        'finalDrive': ('transmission', 'Final drive ratio', 'ratio'), 'gears': ('transmission', 'Gear ratios', 'ratio'),
        'tire': ('tires', 'Rear tire size', 'label'), 'frontTire': ('tires', 'Front tire size', 'label'),
        'test60': ('performance', 'Archive 0–60 mph', 's'), 'testEt': ('performance', 'Archive quarter-mile time', 's'),
        'testTrap': ('performance', 'Archive quarter-mile trap speed', 'mph'),
    }
    for key, (value, evidence, _url, note) in rec['fields'].items():
        if key in fields:
            group, label, unit = fields[key]
            if key == 'front':  # The original published front percentage was normalized to a fraction.
                if not isinstance(value, (float, int)) or not 0 < value < 1:
                    continue
                value, unit = round(value * 100, 5), '%'
            groups[group].append(row(label, value, unit, evidence, source_key, note or ''))
    if rec['transmissionText']:
        groups['transmission'].append(row('Transmission', rec['transmissionText'], 'label', 'historical', source_key))
    for key in ('typeFront', 'typeRear'):
        if item.get(key):
            groups['suspension'].append(row('Front suspension' if key == 'typeFront' else 'Rear suspension',
                                            item[key], 'label', 'historical', source_key))
    return groups

def catalogue(page, entries, history=False):
    cards = ''.join(f'<li data-reference-entry data-reference-search="{h((title+" "+variant).lower())}">'
                    f'<a href="{h(href)}"><strong>{h(title)}</strong><span>{h(variant)}</span></a></li>'
                    for title, variant, href, *_ in sorted(entries, key=lambda x: (re.sub(r'^\d{4}\s+', '', x[0]).lower(), x[0])))
    archive_link = ('<p><a href="archive-review/">Open the historical source review</a></p>'
                    if os.environ.get('ESS_PRIVATE_REVIEW') == '1' and not history else '')
    title = 'Supercar X source review' if history else 'Vehicle specifications'
    lede = ('Historical records under review. Figures remain explicitly attributed to the original archive.'
            if history else 'Find sourced vehicle specifications for a specific year, trim or configuration. The library emphasizes historical vehicles and difficult-to-find engineering data. More contemporary performance vehicles will be added over time.')
    body = f'''<main id="main" class="page vr-page"><section class="vr-hero"><p class="vr-eyebrow">Endicott Speed Shop</p>
    <h1>{title}</h1><p class="vr-variant">{lede}</p>
    <label class="vr-filter" hidden>Find a vehicle <input type="search" data-reference-filter placeholder="Try Civic, Miata or Raptor"></label>
    <p data-reference-count role="status">{len(entries)} configurations</p>
    {'<p><a href="compare/">Compare two vehicles</a></p>' if not history else ''}</section>
    <ul class="vr-catalogue">{cards}</ul>{archive_link}
    {discovery(rel="../../" if history else "../")}</main>'''
    page('vehicles/' + ('archive-review/' if history else '') + 'index.html',
         f'{title} | Endicott Speed Shop', lede, body, 'Vehicles',
         f'<script type="module" src="{"../../" if history else "../"}experience/reference-page.mjs"></script>', indexable=not history)

def build(page):
    global _PENDING
    # One editorial decision set for the Lab and the pages (engine/data/publication.mjs, archive-corrections.mjs).
    subprocess.run(['node', str(HERE/'knowledge'/'engine-data.mjs')], check=True, stdout=subprocess.DEVNULL)
    _PENDING = []
    data = json.loads((HERE/'vehicle-reference-data.json').read_text())
    source = {s['id']: s for s in data['sources'] if s.get('url', '').startswith('https://')}
    runtime = json.loads(subprocess.check_output(['node', str(HERE/'reference-inputs.mjs')], text=True))
    promoted = json.loads((HERE/'reference-oem.json').read_text())
    promoted.update(json.loads((HERE/'reference-reviewed.json').read_text()))
    editorial = json.loads((HERE/'reference-editorial.json').read_text())
    unresolved = set(editorial['archive_holds'])
    removed = set(promoted)

    new_curated = set(editorial['curated'])
    checkpoints = json.loads((HERE/'reference-test-checkpoints.json').read_text())

    private = os.environ.get('ESS_PRIVATE_REVIEW') == '1'
    entries, historical, coverage = [], [], []
    used = set()
    if not private:
        vehicles_root = HERE.parent / 'vehicles'
        # A private review may have been generated in this checkout. Refuse to leave those routes in a release.
        if (vehicles_root/'archive-review/index.html').exists():
            raise SystemExit('Build the public candidate in a fresh checkout. Private review pages are present.')

    for record in data['records']:
        rid, title = record['config_id'], record['display_name']
        identity = record['identity']
        variant = ' · '.join(filter(None, [identity.get('trim'), format_variant(identity)]))
        groups = curated_groups(record, source)
        decision = editorial['curated'].get(rid)
        path = decision.get('route') if decision and decision.get('route') else slug(
            f'{title}-{identity.get("transmission", "")}-{identity.get("market", "")}')
        if path in used:
            raise ValueError(f'Duplicate reference URL {path}')
        used.add(path)
        fixture = runtime['fixtures'].get(rid)
        if decision:
            new_curated.remove(rid)
            eligible = decision['disposition'] == 'candidate'
            reason = decision['reason']
            if eligible:
                if 'title' in decision:
                    title = decision['title']
                if 'scope' in decision:
                    variant = decision['scope']
                groups = approved_groups(decision, rid, source)
                fixture = None  # Existing runtime row was not verified for these this release.
        else:
            if not groups or not all(identity.get(k) for k in ('make','model','market','trim','years_start')):
                raise ValueError(f'Missing editorial disposition for curated configuration {rid}')
            eligible = True
            reason = 'Previously reviewed configuration with distinct identity and traceable facts.'
        for checkpoint in checkpoints.get(rid, []):
            sid = 'checkpoint-' + checkpoint['test_id']
            if not eligible:
                continue
            source[sid] = {'url':checkpoint['source_url'],'publisher':checkpoint['publisher'],
                           'title':checkpoint['title']}
            groups.setdefault('performance',[]).append(row(checkpoint['label'], checkpoint['value'], checkpoint['unit'],
                  'independent_test', sid, checkpoint['conditions']))
        facts = sum(map(len, groups.values()))
        rendered = eligible or private
        coverage.append(['curated',rid,title,'stock','candidate' if eligible else 'hold',reason,
                         '/vehicles/'+path+'/' if rendered else '', facts, 'exact Lab and specification comparison' if available_experiments(fixture) else 'exact specification comparison' if eligible else '', '',
                         ' | '.join(sorted({source[f['source']]['url'] for fs in groups.values() for f in fs})), '',
                         json.dumps(fixture['readiness'], ensure_ascii=False) if fixture and rendered else ''])
        if rendered:
            vehicle_page(page, path, title, variant, 'Factory configuration' if eligible else 'Private source review',
                         groups, source, fixture, rid, eligible)
            (entries if eligible else historical).append((title, variant, '../'+path+'/' if not eligible else path+'/', groups, source))

    canonical = {r[1]:r[6] for r in coverage if r[4] == 'candidate'}
    for a in runtime['history']:
        rid, title = a['id'], a['name']
        rec = a['record']['archive']
        kind = 'competition' if rec['competition'] else 'modified' if rec['modified'] else 'stock'
        url, count, handoff = '', 0, ''
        if a['mergedInto'] and a['mergedInto'] in canonical:
            state, reason, url = 'merged', 'Exact match already represented by the curated configuration.', canonical[a['mergedInto']]
        elif rid in EDITORIAL_HOLD:
            state, reason = 'withheld', EDITORIAL_HOLD[rid]
        elif rid in promoted:
            review = promoted[rid]
            removed.remove(rid)
            title = review.get('title', title)
            src = {}
            groups = approved_groups(review, rid, src, default_evidence='manufacturer')
            path = slug(title)
            if path in used:
                raise ValueError(f'Duplicate reference URL {path}')
            used.add(path)
            state, reason, url = 'candidate', review.get('reason', 'Independent source supports the exact factory configuration.'), '/vehicles/'+path+'/'
            count = sum(map(len, groups.values()))
            fixture = runtime['fixtures'].get(rid)  # Lab registry includes publishable archive ids (Claude, 25 Nov)
            handoff = 'exact Lab and specification comparison' if available_experiments(fixture) else 'exact specification comparison; simulator setup pending'
            note = f'<p>Historical discovery source: <a href="{h(rec["capture"])}" rel="noreferrer">Original Supercar X capture</a>.</p>'
            label = {'stock':'factory configuration', 'competition':'race configuration', 'modified':'modified or development configuration'}[kind]
            vehicle_page(page,path,title,review['scope'],f'Supercar X heritage · {label}',groups,src,fixture,rid, note_html=note)
            entries.append((title,'Supercar X heritage · ' + label,path+'/',groups,src))
        else:
            state = 'hold'
            if rid not in unresolved:
                raise ValueError(f'Missing individual disposition for archive configuration {rid}')
            unresolved.remove(rid)
            hold = editorial['archive_holds'][rid]
            reason = hold['class'] + ' — ' + hold['reason']
            groups = archive_groups(a, rid)
            count = sum(map(len, groups.values()))
            if private and count:
                url = '/vehicles/'+rid+'/'
                vehicle_page(page,rid,title,'Historical values · confirmation pending',f'Private Supercar X review · {kind}',
                             groups,{rid:{'url':rec['capture'], 'publisher':'Supercar X', 'title':rec['title']}},None,rid,False)
                historical.append((title,kind.capitalize()+' · Supercar X', '../'+rid+'/'))
        coverage.append(['archive',rid,title,kind,state,reason,url,count,handoff,a['mergedInto'] or '',
                         rec['capture'],' | '.join([promoted[rid]['url']]+[x[1] for x in promoted[rid].get('additional',[])]) if rid in promoted else '',json.dumps(a.get('missing') or {},ensure_ascii=False)])
    if unresolved or new_curated or removed:
        raise ValueError(f'Unused editorial decisions: {unresolved | new_curated | removed}')
    pending, _PENDING = _PENDING, None
    import spec_page
    spec_page.render_all(page, pending, data, runtime, private, reference_page)
    catalogue(page, entries)
    build_comparison(page, entries, GROUPS)
    if private:
        catalogue(page, historical, history=True)
    report = Path(os.environ.get('ESS_COVERAGE_PATH', str(HERE/'vehicle-reference-coverage.csv')))
    with report.open('w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['collection','id','title','configuration','disposition','reason','route','sourced_facts','handoff','merged_into',
                         'source_urls','corroborating_source','runtime_missing_or_estimated'])
        writer.writerows(coverage)
    page('experiments/index.html', 'Engineering experiments | Endicott Speed Shop',
         'Discover the quarter-mile replay, test oval, tire loads, ride, balance and suspension.',
         '<main id="main" class="page vr-page"><section class="vr-hero"><p class="vr-eyebrow">Vehicle Lab</p>'
         '<h1>Engineering experiments</h1><p class="vr-variant">Start with a question about your car.</p>'
         '<p><a href="../vehicles/">Find a reference vehicle</a> <a href="../experience/#build">Use your own vehicle</a></p></section>'
         + discovery('../', include_hub=False) + '<section class="vr-discovery"><h2>Take another measurement</h2><div class="vr-action-grid">'
         + card(*QUESTIONS['performance'], '../experience/#performance','performance')
         + card(*QUESTIONS['balance'], '../tools/cg-builder/','balance')
         + card(*QUESTIONS['spring-rate'], '../tools/spring-rate/','spring-rate')
         + card('Suspension geometry', 'Move the suspension and examine how geometry changes as the wheel travels.', '../experience/#suspension','suspension')
         + '</div></section></main>')
