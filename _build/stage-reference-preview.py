"""Stage the generated private review as a static site with no analytics or indexing."""
from pathlib import Path
import argparse
import re
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('destination', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
target = args.destination.resolve()
if target.exists() and any(target.iterdir()):
    raise SystemExit('Preview destination must be empty.')
target.mkdir(parents=True, exist_ok=True)
for asset in ('index.html', 'logo-round.png', 'logo-horizontal-tight.png', 'logo-horizontal.png',
              'assets', 'engine', 'experience', 'articles', 'about', 'build', 'contact', 'experiments',
              'grip', 'plan', 'privacy', 'tools', 'vehicles', 'weight-distribution-calculator'):
    source = root / asset
    if source.is_dir():
        shutil.copytree(source, target/asset, ignore=shutil.ignore_patterns('*.test.mjs', '*.md', '.git', 'test'))
    else:
        shutil.copyfile(source, target/asset)
for page in target.rglob('*.html'):
    html = page.read_text(encoding='utf-8')
    html = re.sub(r'<script\b[^>]*src="https://www\.googletagmanager\.com/[^"]+"[^>]*>\s*</script>', '', html)
    html = re.sub(r'<script>\s*window\.dataLayer.*?</script>', '', html, flags=re.S)
    html = re.sub(r'<meta name="robots"[^>]*>', '', html)
    page.write_text(html.replace('</head>', '<meta name="robots" content="noindex,nofollow">\n</head>', 1), encoding='utf-8')
(target/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(target/'assets/ess-presentation/palouse-run.webp').unlink(missing_ok=True)
