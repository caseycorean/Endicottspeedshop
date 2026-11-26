"""Presentation layer hook for the generator.

Work (ChatGPT) owns the reusable brand and presentation package ("Speed you can explain.", ess-knowledge
presentation/ess @ bbe647d). This file ports that package's template transforms (its prepare-preview.py) into
the generator, so the integrated site builds with the presentation applied and no runtime rewriting.
To update: copy Work's new assets into assets/ess-presentation/ and replace the transforms below.
Build without the layer: ESS_BRAND=none python3 _build/build.py

Owner direction 25–26 Nov (overnight convergence): Candidate A (site/v12-growth 56303cb) is the provisional visual
foundation. ESS_BRAND=candidate-a (the default on this branch) keeps Work's component layer for layout but re-binds its
tokens and header to Candidate A (assets/candidate-a/ess-a-theme.css), restores the Candidate A logo and keeps the
owner's tagline "Measure. Test. Improve." / "Your car. Your experiment." ESS_BRAND=speed gives Work's look back.
"""
import os, re

BRAND = os.environ.get("ESS_BRAND", "candidate-a").strip().lower()
SKIN = BRAND == "candidate-a"
PAIR_CALCULATORS = ("tools/load-transfer/index.html", "tools/spring-rate/index.html")
ARTICLE = "articles/traction-circle/index.html"
ARTICLE_EXPERIMENT = re.compile(r'<div class="section" id="try-it">.*?</script></div>', flags=re.S)


def head(rel):
    if BRAND not in ("speed", "candidate-a"):
        return ""
    if SKIN:
        return (f'<link rel="stylesheet" href="{rel}assets/ess-presentation/ess-system.css">\n'
                f'<link rel="stylesheet" href="{rel}assets/ess-presentation/ess-claude-adapter.css">\n'
                f'<link rel="icon" type="image/png" href="{rel}logo-round.png">\n')
    return (f'<link rel="stylesheet" href="{rel}assets/ess-presentation/ess-system.css">\n'
            f'<link rel="stylesheet" href="{rel}assets/ess-presentation/ess-claude-adapter.css">\n'
            f'<link rel="icon" type="image/svg+xml" href="{rel}assets/ess-presentation/ess-mark.svg">\n')


def tail_css(rel):
    """Stylesheet loaded after every other one (the skin must win)."""
    return f'<link rel="stylesheet" href="{rel}assets/candidate-a/ess-a-theme.css">\n' if SKIN else ""


def brand_html(rel):
    if SKIN:
        return (f'<img class="a-logo" src="{rel}logo-horizontal-tight.png" alt="Endicott Speed Shop — Measure, Test, Improve" '
                'width="611" height="192">')
    return '<span class="ess-wordmark"><strong>ENDICOTT</strong><span>SPEED SHOP</span></span>'


def body_attrs():
    if SKIN:
        return ' data-ess-brand="speed" data-ess-skin="candidate-a"'
    return ' data-ess-brand="speed"' if BRAND == "speed" else ""


def theme_color():
    return "#ffffff" if SKIN else "#162720" if BRAND == "speed" else "#16191c"


def change_home(html):
    return (
        html.replace("Endicott Speed Shop | Run it before you buy it.", "Endicott Speed Shop | Speed you can explain.")
        .replace("Run it before<br><em>you buy it.</em>", "Speed you<br><em>can explain.</em>")
        .replace('<p class="ig-eyebrow">Measure. Test. Improve.</p>',
                 '<p class="ig-eyebrow">Engineering for the cars we drive</p>', 1)
        .replace("Pick your car, change a gear, a tire or a part, and see what it does before anything ships. Engineering models, sourced numbers, honest ranges.",
                 "Pick a car. Change one thing. See how it affects grip, balance or acceleration before you buy the part.")
        .replace("Live from the Vehicle Lab", "Live Vehicle Lab result · Model estimate", 1)
    )


def change_home_a(html):
    """Candidate A homepage: the owner's taglines, and the simulators one tap from the first screen."""
    sims = ('<div class="a-sims" aria-label="Simulators">'
            '<a href="experience/#performance"><strong>Performance simulator</strong><span>0–60, quarter mile, gearing and tires, side by side</span></a>'
            '<a href="experience/#build"><strong>Build a car</strong><span>Engine, transmission, weight and balance</span></a>'
            '<a href="simulate/"><strong>Accelerate, brake, corner</strong><span>Any distance or speed, stops from any speed, corners, and braking into and powering out of them</span></a>'
            '<a href="suspension-v2/"><strong>Suspension</strong><span>Move the pivots: camber, roll center and anti-squat through travel</span></a>'
            '<a href="vehicles/"><strong>Vehicle specifications</strong><span>116 cars with sources and live experiments</span></a></div>')
    return (html.replace("Endicott Speed Shop | Run it before you buy it.", "Endicott Speed Shop | Measure. Test. Improve.")
            .replace("Run it before<br><em>you buy it.</em>", "Your car.<br><em>Your experiment.</em>")
            .replace('<p class="ig-invite">Your car. Your experiment.</p>', '<p class="ig-invite">Engineering models, sourced numbers and honest ranges.</p>')
            .replace("Pick your car, change a gear, a tire or a part, and see what it does before anything ships. Engineering models, sourced numbers, honest ranges.",
                     "Pick a car. Change a gear, a tire or a part. See what it does to grip, balance and acceleration before you buy anything.")
            .replace("Live from the Vehicle Lab", "Example · ESS model estimate", 1)  # R12: an example, not a live result
            .replace('<section class="ig-section home-intentions"', sims + '\n<section class="ig-section home-intentions"', 1))


def change_article(html):
    journey_mount = '<section class="ig-journey" data-ess-journey="articles/traction-circle"'
    journey_id = "ess-article-journey"
    if journey_mount in html:
        html = html.replace(journey_mount, journey_mount + f' id="{journey_id}"', 1)
    rail = ('<aside class="ess-study-rail ess-system-next" aria-label="Explore this article">'
            '<strong>Keep the question in view</strong>'
            '<a href="#try-it">Brake into a corner</a>'
            f'<a href="#{journey_id}">See the launch version</a>'
            '<a href="../../tools/load-transfer/">Run the Load Transfer Calculator</a>'
            '</aside>')
    experiment = ARTICLE_EXPERIMENT.search(html)
    first_question = html.find("<p>Every tire has a limit")
    if experiment and 0 <= first_question < experiment.start():
        introduction_end = html.index("</p>", first_question) + len("</p>")
        html = html[:experiment.start()] + html[experiment.end():]
        html = html[:introduction_end] + "\n" + experiment.group() + "\n" + html[introduction_end:]
    return (html.replace('class="page narrow article ig-article"', 'class="page narrow article ig-article" data-ess-layout="article-rail"')
            .replace('<p>Every tire has a limit', rail + '<p>Every tire has a limit', 1)
            .replace("The amber dot sits on the modern limit.", "The marked point sits on the modern limit."))


def change_calculator(html, path):
    html = html.replace('<main class="page', '<main data-ess-layout="calculator" class="page', 1)
    if path in PAIR_CALCULATORS:
        first = '<div class="panel"><h2>The car</h2>'
        end = '<div class="section narrow"><div class="section-label">How it works</div>'
        if first in html and end in html:
            html = html.replace(first, '<div class="ess-calculator-grid">' + first, 1).replace(end, '</div>\n' + end, 1)
    return html


def transform(path, html):
    """Apply the presentation package's page changes to one generated page."""
    if BRAND not in ("speed", "candidate-a"):
        return html
    if path == "index.html" and SKIN:
        html = change_home_a(html)
    elif path == "index.html":
        html = change_home(html)
    if path == ARTICLE:
        html = change_article(html)
    if path.startswith("tools/"):
        html = change_calculator(html, path)
    return html
