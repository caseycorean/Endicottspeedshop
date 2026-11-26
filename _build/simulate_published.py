"""Compact published road-test figures for Test → Simulations (simulate/published.json), keyed by Lab id.
Only the figures the simulations compare against: braking distances, skidpad, 0–60 and quarter mile, each with its
publisher and link. Built from the knowledge records so the page needs one small fetch."""
import json, os, re

def write(root):
    recs = json.load(open(os.path.join(root, '_build/knowledge/vehicle-knowledge.json')))['records']
    out = {}
    for r in recs:
        lab = (r.get('model') or {}).get('labId')
        if not lab: continue
        e = {'route': r['route'], 'title': r['title'], 'stops': [], 'skidpad': [], 'et': [], 't60': []}
        for f in r['facts']:
            v = f.get('value')
            if not isinstance(v, (int, float)) or f.get('publish') is False: continue
            src = f.get('source') or {}
            pub = {'pub': src.get('publisher'), 'url': src.get('url')}
            m = re.match(r'^Braking (\d+)–0 mph$', f['label'])
            if m: e['stops'].append({'mph': int(m.group(1)), 'ft': v, **pub})
            elif f['label'] == 'Skidpad': e['skidpad'].append({'g': v, 'note': f.get('note'), **pub})
            elif f['label'] == 'Quarter-mile time': e['et'].append({'s': v, **pub})
            elif f['label'] == '0–60 mph': e['t60'].append({'s': v, **pub})
        out.setdefault(lab, e)
    path = os.path.join(root, 'simulate', 'published.json')
    json.dump(out, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
    print('wrote simulate/published.json', len(out), 'vehicles,', sum(len(x['stops']) for x in out.values()), 'stops')
