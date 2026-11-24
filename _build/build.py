"""Static page builder for endicottspeedshop.com.
Run from the repo root:  python3 _build/build.py
Pages are defined in _build/pages.py; shared header/footer live here.
Folders starting with '_' are not published by GitHub Pages (Jekyll default)."""
import os, sys, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GA = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-GGJVMS8CZD"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-GGJVMS8CZD');</script>"""
NAV = [("Tools", "tools/", "Calculators built from measured data"),
       ("Articles", "articles/", "Engineering foundations and build notes"),
       ("The Build", "build/", "The green car, measured"),
       ("About", "about/", "Why this exists")]

SITE = "https://endicottspeedshop.com/"
URLS = ["weight-distribution-calculator/"]  # hand-made page, not generated here

def share_tags(title, desc, url):
    """Link-preview tags (Facebook, iMessage, forums, X) so a shared link shows the logo, title and summary."""
    return (f'<meta property="og:type" content="website">\n'
            f'<meta property="og:site_name" content="Endicott Speed Shop">\n'
            f'<meta property="og:title" content="{title}">\n'
            f'<meta property="og:description" content="{desc}">\n'
            f'<meta property="og:url" content="{url}">\n'
            f'<meta property="og:image" content="{SITE}logo-round.png">\n'
            f'<meta property="og:image:width" content="1536">\n'
            f'<meta property="og:image:height" content="1024">\n'
            f'<meta property="og:image:alt" content="Endicott Speed Shop logo: a second-generation Firebird in a round badge">\n'
            f'<meta name="twitter:card" content="summary_large_image">')

def page(path, title, desc, body, active="", extra_head=""):
    depth = path.count("/")
    rel = "../" * depth
    canon = path[:-len("index.html")] if path.endswith("index.html") else path
    URLS.append(canon)
    links = "".join(f'<a href="{rel}{h}"{" class=on" if active==n else ""}>{n}</a>' for n, h, _ in NAV)
    side = "".join(f'<a href="{rel}{h}">{n}<small>{s}</small></a>' for n, h, s in NAV)
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
{GA}
<link rel="canonical" href="{SITE}{canon}">
{share_tags(title, desc, SITE + canon)}
<link rel="stylesheet" href="{rel}assets/site.css">
{extra_head}
</head>
<body>
<header class="site-header"><div class="header-inner">
<a href="{rel}./" class="brand" aria-label="Endicott Speed Shop home"><img src="{rel}logo-horizontal.png" alt="Endicott Speed Shop"></a><span class="beta-pill">Beta</span>
<nav class="topnav">{links}</nav>
<button class="menu-toggle" id="menuToggle" aria-label="Open menu" aria-expanded="false"><div class="menu-lines"><span></span><span></span><span></span></div></button>
</div></header>
<div class="beta-bar" role="note"><strong>Beta.</strong> Endicott Speed Shop is a work in progress: tools and articles are still being checked and expanded, so some things may change or not work perfectly yet. Spot a problem? Use Contact at the bottom of the page — and check back soon.</div>
<aside class="sidebar" id="sidebar"><button class="close-btn" id="closeBtn" aria-label="Close menu">×</button>
<nav><a href="{rel}./">Home<small>Start here</small></a>{side}</nav>
<p class="hint" style="margin-top:20px">Questions or calculator feedback: <a href="mailto:descore.llc@gmail.com?subject=Endicott%20Speed%20Shop">email the shop</a></p>
</aside>
{body}
<footer class="footer"><div class="line"><span>Endicott Speed Shop — Measure. Test. Improve. Know why.</span><span><a href="{rel}privacy/">Privacy</a> · <a href="mailto:descore.llc@gmail.com?subject=Endicott%20Speed%20Shop">Contact</a></span></div></footer>
<script src="{rel}assets/site.js"></script>
</body>
</html>
"""
    out = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(out) or ROOT, exist_ok=True)
    open(out, "w").write(html)
    print("wrote", path)

if __name__ == "__main__":
    spec = importlib.util.spec_from_file_location("pages", os.path.join(ROOT, "_build", "pages.py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    m.build(page)
    sm = "".join(f"<url><loc>{SITE}{u}</loc></url>" for u in sorted(set(URLS)))
    open(os.path.join(ROOT, "sitemap.xml"), "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + sm + "</urlset>\n")
    open(os.path.join(ROOT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n")
    print("wrote sitemap.xml, robots.txt")
