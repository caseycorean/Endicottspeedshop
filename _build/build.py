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

def page(path, title, desc, body, active="", extra_head=""):
    depth = path.count("/")
    rel = "../" * depth
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
<link rel="stylesheet" href="{rel}assets/site.css">
{extra_head}
</head>
<body>
<header class="site-header"><div class="header-inner">
<a href="{rel}./" class="brand" aria-label="Endicott Speed Shop home"><img src="{rel}logo-horizontal.png" alt="Endicott Speed Shop"></a>
<nav class="topnav">{links}</nav>
<button class="menu-toggle" id="menuToggle" aria-label="Open menu" aria-expanded="false"><div class="menu-lines"><span></span><span></span><span></span></div></button>
</div></header>
<aside class="sidebar" id="sidebar"><button class="close-btn" id="closeBtn" aria-label="Close menu">×</button>
<nav><a href="{rel}./">Home<small>Start here</small></a>{side}</nav>
<p class="hint" style="margin-top:20px">Questions or calculator feedback: <a href="mailto:descore.llc@gmail.com?subject=Endicott%20Speed%20Shop">email the shop</a></p>
</aside>
{body}
<footer class="footer"><div class="line"><span>Endicott Speed Shop — Measure. Test. Improve. Know why.</span><span><a href="mailto:descore.llc@gmail.com?subject=Endicott%20Speed%20Shop">Contact</a></span></div></footer>
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
