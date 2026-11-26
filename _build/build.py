"""Static page builder for endicottspeedshop.com.
Run from the repo root:  python3 _build/build.py
Pages are defined in _build/pages.py; shared header/footer live here.
Folders starting with '_' are not published by GitHub Pages (Jekyll default)."""
import os, sys, re, importlib.util
from html import escape
import reference_pages
import feedback_page
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import presentation
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GA_TAGS = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-GGJVMS8CZD"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-GGJVMS8CZD',{page_location:location.origin+location.pathname,page_referrer:document.referrer?new URL(document.referrer).origin:''});</script>"""
GA = GA_TAGS if os.environ.get("ESS_PRIVATE_REVIEW") != "1" else ""
# Approved architecture (owner, 26 Nov): Vehicles · Test · Plan · Learn + persistent My Garage. URLs unchanged.
NAV = [("Vehicles", "vehicles/", "Find a car: factory specifications and independent tests"),
       ("Test", "experience/", "Try a change: acceleration, gearing, grip and suspension"),
       ("Plan", "plan/", "Decide what to do first, step by step"),
       ("Learn", "learn/", "Articles, calculators and how ESS measures"),
       ("My Garage", "experience/#garage", "Your saved cars, kept in this browser")]
MORE_NAV = [("About", "about/", "Why this exists"), ("Contact", "contact/", "Corrections, questions and measured data")]
# Older pages pass their former section name; map it to the destination it now belongs to.
ACTIVE = {"Vehicle Lab": "Test", "Tools": "Learn", "Articles": "Learn", "Research": "Learn"}

SITE = "https://endicottspeedshop.com/"
URLS = ["weight-distribution-calculator/"]  # hand-made page, not generated here (experience/ is noindex: kept out of the sitemap, R13)

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

def page(path, title, desc, body, active="", extra_head="", *, indexable=True, journey=True):
    depth = path.count("/")
    rel = "../" * depth
    canon = path[:-len("index.html")] if path.endswith("index.html") else path
    title, desc = escape(title, quote=True), escape(desc, quote=True)
    if indexable:
        URLS.append(canon)
    else:
        extra_head += '<meta name="robots" content="noindex,follow">'
    if journey and path.startswith(("articles/", "tools/", "plan/")) and "data-ess-journey" not in body:
        # Calculators, hubs and the planning guide end with the same model-driven next-experiment band as articles.
        key = path.replace("/index.html", "")
        band = (f'<section class="ig-journey" data-ess-journey="{key}" data-lab-root="{rel}experience/" aria-label="Try it on a car">'
                f'<noscript><p><a href="{rel}experience/">Open the Vehicle Lab</a></p></noscript></section>')
        body = body[:body.rfind("</main>")] + band + body[body.rfind("</main>"):]
    if "data-ess-journey" in body:
        extra_head += f'<script type="module" src="{rel}experience/journey.mjs"></script>'
    if journey and path.startswith(("articles/", "tools/", "plan/")):
        tool = path.split("/")[-2] if path.startswith(("tools/", "plan/")) else "article"
        selector = (f'<div class="ess-config" data-ess-vehicle="{tool}" '
                    f'data-lab-root="{rel}experience/"></div>')
        body = re.sub(r"</h1>", "</h1>\n" + selector, body, count=1)
        extra_head += f'<script type="module" src="{rel}experience/search-bridge.mjs"></script>'
    if 'id="main"' not in body:
        body = body.replace("<main ", '<main id="main" ', 1)
    active = ACTIVE.get(active, active)
    links = "".join(f'<a href="{rel}{h}"{" class=on aria-current=page" if active==n else ""}{" class=nav-garage" if n=="My Garage" else ""}>{n}</a>' for n, h, _ in NAV)
    side = "".join(f'<a href="{rel}{h}">{n}<small>{s}</small></a>' for n, h, s in NAV + MORE_NAV)
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
<link rel="stylesheet" href="{rel}assets/ess-search.css">
<link rel="stylesheet" href="{rel}assets/ess-editorial.css">
<link rel="stylesheet" href="{rel}assets/ess-identity.css">
{presentation.head(rel)}<link rel="stylesheet" href="{rel}assets/ess-reference.css">
<script type="module" src="{rel}experience/measurement.mjs"></script>
<meta name="theme-color" content="{presentation.theme_color()}">
{extra_head}
{presentation.tail_css(rel)}</head>
<body class="ess-theme"{presentation.body_attrs()}>
<a class="vr-skip" href="#main">Skip to content</a>
<header class="site-header"><div class="header-inner">
<div class="brand-wrap"><a href="{rel}./" class="brand" aria-label="Endicott Speed Shop home">{presentation.brand_html(rel)}</a><a class="beta-pill" href="{rel}about/#beta" title="This site is in beta: tools and articles are still being checked and expanded">Beta</a></div>
<nav class="topnav" aria-label="Main navigation">{links}</nav>
<button class="menu-toggle" id="menuToggle" aria-label="Open menu" aria-expanded="false"><div class="menu-lines"><span></span><span></span><span></span></div></button>
</div></header>
<aside class="sidebar" id="sidebar"><button class="close-btn" id="closeBtn" aria-label="Close menu">×</button>
<nav><a href="{rel}./">Home<small>Start here</small></a>{side}</nav>
<p class="hint" style="margin-top:20px">This site is in beta: tools and articles are still being checked and expanded. <a href="{rel}contact/">Spot a problem? Tell us.</a></p>
</aside>
{body}
<footer class="footer"><div class="line"><span class="ig-sign">Measure. Test. Improve.</span><span>© 2026 Endicott Speed Shop · Beta — <a href="{rel}contact/?from=/{canon}">Give feedback</a></span><span><a href="{rel}privacy/">Privacy</a> · <a href="{rel}contact/">Contact</a></span><label class="ess-units"><span>Units</span><select data-units-pref aria-label="Measurement units"><option value="us">US customary</option><option value="metric">Metric</option><option value="dual">Both</option></select></label></div></footer>
<script src="{rel}assets/site.js"></script>
<script type="module" src="{rel}experience/units.mjs"></script>
</body>
</html>
"""
    html = presentation.transform(path, html)
    out = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(out) or ROOT, exist_ok=True)
    open(out, "w").write(html)
    print("wrote", path)

if __name__ == "__main__":
    import simulate_published; simulate_published.write(ROOT)
    spec = importlib.util.spec_from_file_location("pages", os.path.join(ROOT, "_build", "pages.py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    m.build(page)
    reference_pages.build(page)
    feedback_page.build(page)
    sm = "".join(f"<url><loc>{SITE}{u}</loc></url>" for u in sorted(set(URLS)))
    open(os.path.join(ROOT, "sitemap.xml"), "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + sm + "</urlset>\n")
    open(os.path.join(ROOT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n")
    print("wrote sitemap.xml, robots.txt")
