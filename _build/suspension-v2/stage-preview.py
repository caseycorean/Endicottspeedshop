"""Stage the Suspension V2 page as a self-contained private preview (artifact). Usage: stage-preview.py OUT_DIR SITE_URL
Links to other ESS pages open SITE_URL (the preserved integrated preview), so nothing dead-ends."""
import re, shutil, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
out, site = Path(sys.argv[1]), sys.argv[2]
if out.exists(): shutil.rmtree(out)
files = ["assets/site.css", "assets/ess-identity.css", "assets/ess-presentation/ess-system.css", "assets/ess-presentation/ess-claude-adapter.css",
         "assets/ess-presentation/open-sans-condensed-bold.ttf", "assets/candidate-a/ess-a-theme.css", "assets/site.js", "logo-round.png", "logo-horizontal-tight.png",
         "experience/manipulate.mjs", "experience/units.mjs", "experience/rear-links.mjs", "experience/rear-link-insights.mjs",
         "engine/linkage.mjs", "engine/axle-links.mjs", "engine/suspension.mjs"]
files += ["assets/ess-presentation/ess-mark.svg"] + [str(p.relative_to(ROOT)) for p in (ROOT / "assets/fonts").glob("*.woff")]
files += [str(p.relative_to(ROOT)) for p in (ROOT / "experience/suspension-v2").glob("*") if p.suffix in (".mjs", ".css")]
for f in files:
    (out / f).parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(ROOT / f, out / f)
html = (ROOT / "suspension-v2/index.html").read_text()
html = re.sub(r'href="\.\./(?!assets/|logo|experience/suspension-v2/)[^"]*"', f'href="{site}" target="_blank" rel="noopener"', html)
html = html.replace('href="../', 'href="./').replace('src="../', 'src="./')
html = html.replace('<div data-suspension-v2>', f'<div data-suspension-v2 data-site-base="{site}">')
html = html.replace('<title>Suspension | Endicott Speed Shop</title>', '<title>PREVIEW — Suspension V2 | Endicott Speed Shop</title>')
(out / "index.html").write_text(html)
print(len(files) + 1, "files")
