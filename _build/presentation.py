"""Presentation layer hook for the generator.

Work (ChatGPT) owns the reusable brand and presentation package ("Speed you can explain.", ess-knowledge
presentation/ess @ bbe647d). This file ports that package's template transforms (its prepare-preview.py) into
the generator, so the integrated site builds with the presentation applied and no runtime rewriting.
To update: copy Work's new assets into assets/ess-presentation/ and replace the transforms below.
Build without the layer: ESS_BRAND=none python3 _build/build.py
"""
import os, re

BRAND = os.environ.get("ESS_BRAND", "speed").strip().lower()
PAIR_CALCULATORS = ("tools/load-transfer/index.html", "tools/spring-rate/index.html")
ARTICLE = "articles/traction-circle/index.html"
ARTICLE_EXPERIMENT = re.compile(r'<div class="section" id="try-it">.*?</script></div>', flags=re.S)


def head(rel):
    if BRAND != "speed":
        return ""
    return (f'<link rel="stylesheet" href="{rel}assets/ess-presentation/ess-system.css">\n'
            f'<link rel="stylesheet" href="{rel}assets/ess-presentation/ess-claude-adapter.css">\n'
            f'<link rel="icon" type="image/svg+xml" href="{rel}assets/ess-presentation/ess-mark.svg">\n')


def body_attrs():
    return ' data-ess-brand="speed"' if BRAND == "speed" else ""


def theme_color():
    return "#162720" if BRAND == "speed" else "#16191c"


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
    if BRAND != "speed":
        return html
    if path == "index.html":
        html = change_home(html)
    if path == ARTICLE:
        html = change_article(html)
    if path.startswith("tools/"):
        html = change_calculator(html, path)
    return html
