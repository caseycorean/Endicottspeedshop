# Page content for endicottspeedshop.com. Edit here, then run: python3 _build/build.py
import json, os
from reference_pages import discovery
HERE = os.path.dirname(os.path.abspath(__file__))

ARTICLES = [
 ("articles/weight-distribution-50-50/", "What 50/50 Weight Distribution Really Means", "Engineering foundations",
  "A balanced car is a good thing, but the percentage alone doesn't tell you where the mass sits — and that matters too."),
 ("articles/traction-circle/", "Understanding the Traction Circle", "Engineering foundations",
  "Why braking into a corner costs grip, and how tires set the limit on everything the car can do."),

]
TOOLS = [
 ("tools/cg-builder/", "Balance & CG Builder", "New",
  "Start from your scale numbers, add, remove or move parts, and watch front %, side-to-side balance and center of gravity move. Includes ESS-measured part weights."),
 ("weight-distribution-calculator/", "Weight Distribution Calculator", "Original",
  "The quick version: move or change components and see the front-to-rear balance change."),
 ("tools/load-transfer/", "Load Transfer Calculator", "New",
  "See how much load moves front to rear under braking and side to side in a corner, and what each tire carries when you brake into a turn."),
 ("tools/spring-rate/", "Spring Rate & Ride Frequency", "New",
  "Turn a spring rate into the rate the wheel actually feels, see how stiff the car rides, and find the spring you need for a target."),
 ("tools/scale-delta/", "Part Weight from Corner Scales", "New",
  "Weigh the car before and after removing a part to get the part's weight AND where it sat — the method ESS uses."),
]

CATS = {"Engineering foundations": "cat-found", "Build data": "cat-data", "Testing": "cat-test"}
def cat(t):
    return CATS.get(t, "cat-notes" if t.startswith("Build notes") else "")

def cards(items, rel):
    return "".join(f'<article class="card"><span class="tag {cat(t)}">{t}</span><h3><a href="{rel}{p}">{h}</a></h3><p>{d}</p><a class="more" href="{rel}{p}">Open</a></article>' for p, h, t, d in items)

# Goal-first routing (owner desktop review, 24 Nov 2026): each goal pairs the idea with a tool.
GOALS = [
 ("Balance and weight placement", "Where your car's weight sits, and what moving, removing or swapping parts does to it.",
  [("What 50/50 really means", "articles/weight-distribution-50-50/"), ("Balance &amp; CG Builder", "tools/cg-builder/")]),
 ("Grip in corners and under braking", "How tires share their grip, and how much load moves when you brake, accelerate and turn.",
  [("Understanding the traction circle", "articles/traction-circle/"), ("Load Transfer Calculator", "tools/load-transfer/")]),
 ("Springs and ride", "Turn a spring rate into what the wheel feels, and find the spring for the ride you want.",
  [("Spring Rate &amp; Ride Frequency", "tools/spring-rate/")]),
 ("Know what your parts weigh", "Measured second-gen F-body part weights, and how to weigh parts on your own car.",
  [("How ESS measures parts", "build/"), ("Part Weight from Corner Scales", "tools/scale-delta/")]),
]
def GOALS_HTML(rel):
    return "".join(f'<article class="card goal"><h3>{g}</h3><p>{d}</p><ul class="links">' +
                   "".join(f'<li><a href="{rel}{h}">{n}</a></li>' for n, h in links) + '</ul></article>' for g, d, links in GOALS)

def journey(path, rel):
    """Mount point for the model-driven 'try it on a car' band (experience/journey.mjs). Visible content, filled by the
    visitor's active car or the page's reference car; links open the experiment already applied."""
    key = path.strip("/").replace("/index.html", "") or "home"
    return (f'<section class="ig-journey" data-ess-journey="{key}" data-lab-root="{rel}experience/" aria-label="Try it on a car">'
            f'<noscript><p><a href="{rel}experience/">Open the Vehicle Lab</a></p></noscript></section>')

def article(page, path, title, kicker, desc, meta, body):
    rel = "../" * path.count("/")
    page(path + "index.html", f"{title} | Endicott Speed Shop", desc,
         f'<main class="page narrow article ig-article"><div class="kicker">{kicker}</div><h1>{title}</h1><div class="meta">{meta}</div>{body}'
         f'{journey(path, rel)}'
         f'<div class="section"><div class="section-label">Keep going</div><p><a href="{rel}tools/cg-builder/">Try the Balance &amp; CG Builder</a> · <a href="{rel}articles/">All articles</a></p></div></main>',
         active="Articles")

from home import homepage, grip_entrance

def build(page):
    page("index.html", "Endicott Speed Shop | Run it before you buy it.",
         "Choose your car, compare builds and use engineering tools to test changes in weight, grip, gearing and suspension.",
         homepage().replace('<section class="ig-section home-fieldnotes"', discovery() + '<section class="ig-section home-fieldnotes"'), extra_head='<script type="module" src="experience/home.mjs"></script>')
    page("grip/index.html", "Tire Load Experiment | Endicott Speed Shop",
         "See how braking and cornering move load between your tires with an interactive experiment.",
         grip_entrance(), extra_head='<script type="module" src="../assets/grip-lab.js"></script>')

    # TOOLS HUB
    page("tools/index.html", "Tools | Endicott Speed Shop", "Free calculators for weight distribution, center of gravity, load transfer, spring rates and part weights.",
         f'<main class="page"><div class="kicker">Tools</div><h1>Model it before you build it.</h1><p class="lede">Free calculators for balance, center of gravity, load transfer, springs and part weights. Results are estimates you can check against measurements.</p><div class="grid">{cards(TOOLS, "../")}</div>'
         '<p class="lab-callout">Use one car across experiments. <a href="../experience/#tools">Open Vehicle Lab tools</a> or <a href="../experiments/">discover more experiments</a>.</p></main>' , active="Tools")

    # LEARN HUB (approved architecture, 26 Nov): one entrance to explanations, calculators, experiments and method.
    page("learn/index.html", "Learn | Endicott Speed Shop",
         "Engineering explanations, free calculators and interactive experiments from Endicott Speed Shop, and how ESS measures and tests.",
         '<main class="page"><div class="kicker">Learn</div><h1>Understand what makes the numbers move.</h1>'
         '<p class="lede">Plain-language explanations with real numbers, calculators you can use on your own car, and how ESS measures and tests.</p>'
         '<h2>Explanations</h2><div class="grid">' + cards(ARTICLES, "../") + '</div>'
         '<h2>Calculators</h2><div class="grid">' + cards(TOOLS, "../") + '</div>'
         '<h2>Interactive experiments</h2><div class="grid">'
         '<article class="card"><span class="tag cat-test">Experiment</span><h3><a href="../grip/">Tire loads under braking and cornering</a></h3><p>Brake into a corner and watch what each tire carries.</p><a class="more" href="../grip/">Open</a></article>'
         '<article class="card"><span class="tag cat-test">Experiments</span><h3><a href="../experiments/">Which change matters?</a></h3><p>Pick a question and run it on a car in Test.</p><a class="more" href="../experiments/">Open</a></article></div>'
         '<h2>How ESS measures</h2><p><a href="../build/">Research method: baseline, model, measure again</a> · <a href="../about/">About ESS</a></p>'
         '</main>', active="Learn", journey=False)

    # ARTICLES HUB
    page("articles/index.html", "Articles | Endicott Speed Shop", "Engineering foundations from Endicott Speed Shop.",
         f'<main class="page"><div class="kicker">Articles</div><h1>Engineering, explained with real numbers.</h1><p class="lede">Foundations that explain how vehicles behave, with experiments that put the ideas to work.</p><div class="grid">{cards(ARTICLES, "../")}</div></main>', active="Articles")

    page("build/index.html", "Engineering research | Endicott Speed Shop",
         "How Endicott Speed Shop establishes a measurable baseline, models changes and checks the results.",
         """<main class="page narrow article"><div class="kicker">Engineering research</div>
<h1>Build a case for the change.</h1>
<p class="lede">Endicott Speed Shop grew out of Supercar X and a simple question. How much can we learn about the potential of the car we already have?</p>
<h2>Start with the car and its job</h2><p>A daily-driver hatchback, a tow-capable pickup and a track car have different goals. Establish a baseline for the one you have. Record the exact configuration, the equipment, and the conditions that matter.</p>
<h2>Model one change</h2><p>Use a shared model to see what changing gearing, tires, weight or suspension might do. Distinguish factory specifications, independent tests and your own measurements from estimates.</p>
<h2>Repeat the measurement</h2><p>Check the prediction under comparable conditions. Capture the setup and what changed, including results that challenge the model.</p>
<p><a href="../vehicles/">Find a documented baseline</a> · <a href="../experiments/">Explore the experiments</a> · <a href="../plan/">Plan a build</a></p>
</main>""", active="Research")

    page("about/index.html", "About | Endicott Speed Shop", "Supercar X grew into Endicott Speed Shop, an independent automotive engineering reference and workshop.",
         """<main class="page narrow article"><div class="kicker">About ESS</div><h1>Explore the car you have.</h1>
<p class="lede">Supercar X started with the idea that any car could be worth studying. Endicott Speed Shop carries that idea forward with sourced vehicle specifications, explanations and experiments.</p>
<p>Use ESS to research a configuration, ask what a change might do, and decide what to measure or test next. The result you want might be more grip, a better ride, a more useful gear or simply a clearer understanding of how your vehicle works.</p>
<h2 id="beta">What beta means</h2><p>We expand coverage when the evidence supports it. If a source conflicts, a model needs an input or a specification is missing, we show that distinction. <a href="../contact/">Tell us what needs attention</a>.</p>
<p><a href="../build/">Read how we do the research</a></p></main>""", active="About")

    for route in ("measured-firebird-weights", "ls-swap-real-cost"):
        page(f"articles/{route}/index.html", "Engineering research | Endicott Speed Shop",
             "Explore the ESS approach to measuring parts and planning a build.",
             '<main class="page narrow article"><h1>Engineering research</h1><p>This article is awaiting editorial review.</p>'
             '<p><a href="../../build/">See the research method</a> · <a href="../../articles/">Engineering articles</a></p></main>',
             indexable=False, journey=False)

    # PLAN YOUR BUILD (owner desktop review, 24 Nov 2026): first version of the Build Planning Guide.
    page("plan/index.html", "Plan Your Build | Endicott Speed Shop",
         "A step-by-step way to go from a performance goal to a build plan you can test: goal, baseline, constraints, options, modeling and measurement.",
         f"""<main class="page narrow article"><div class="kicker">Build planning</div><h1>Plan your build.</h1>
<p class="lede">Most builds go wrong before the first bolt is turned: parts get bought before the goal is clear. This guide walks from what you want the car to do, to a plan you can test — using the articles and calculators on this site along the way.</p>
<div class="callout">Save a baseline in <a href="../experience/#garage">My Garage</a> as you work through the guide. Use a measured baseline when you have one, and mark the changes you still need to test.</div>
<h2>1 · Name the goal</h2>
<p>What should the car do better: turn in, put power down, stop, ride, or simply weigh less? Is it a street car, a track car or both? A clear goal is what lets you say no to parts that don't serve it.</p>
<ul class="links">{"".join(f'<li>{g}: ' + ' · '.join(f'<a href="../{h}">{n}</a>' for n, h in links) + '</li>' for g, d, links in GOALS)}</ul>
<h2>2 · Record your baseline</h2>
<p>Write down what you have now: total weight and corner weights if you can get the car on scales, wheelbase and track, tires, and the current suspension. Every later decision is measured against this.</p>
<p><a href="../tools/cg-builder/">Balance &amp; CG Builder</a> · <a href="../tools/scale-delta/">Part Weight from Corner Scales</a> · <a href="../build/">Research method</a></p>
<h2>3 · Set your constraints</h2>
<p>Budget, time, tools, the fabrication you can actually do, and what has to stay (comfort, registration, originality). Constraints aren't limits on a good build — they are design inputs that narrow the options to the ones that fit.</p>
<h2>4 · Understand what drives the result</h2>
<p>Before comparing parts, understand the mechanism you're trying to change: how tires share grip, how load moves when the car brakes and turns, and why where mass sits matters as well as the percentage on the scale.</p>
<p><a href="../articles/traction-circle/">Understanding the traction circle</a> · <a href="../articles/weight-distribution-50-50/">What 50/50 really means</a></p>
<h2>5 · Compare the options on the same terms</h2>
<p>Put each option side by side: cost, weight and where it sits, fabrication required, what it changes and what it doesn't. For example, a second-gen F-body owner improving the front suspension might compare upgrading the stock parts, a bolt-in aftermarket package such as those from QA1 or Pro Touring F-Body, and a Corvette front suspension conversion. ESS is documenting comparisons like this one; they will be published here as the data is checked. (Brands are examples, not recommendations.)</p>
<h2>6 · Model before you spend</h2>
<p>Use the calculators for the questions they answer well: balance, load transfer and spring rates. The Vehicle Lab lets you <a href="../experience/#compare">compare acceleration</a> and <a href="../suspension-v2/">explore rear link geometry</a> before deciding what to measure next.</p>
<p><a href="../tools/">All calculators</a></p>
<h2>7 · Build in stages, and measure each one</h2>
<p>Make the reversible decisions first. After each stage, weigh, test and compare against your baseline — that is how you find out whether a change did what you expected, and it's how the ESS cars are developed too.</p>
<p><a href="../build/">How ESS measures and tests</a> · <a href="../contact/">Questions or suggestions for this guide</a></p>
</main>""", active="Plan")

    # PRIVACY (launch blocker fix, 23 Nov 2026)
    page("privacy/index.html", "Privacy | Endicott Speed Shop", "What Endicott Speed Shop collects when you visit, why, and how to opt out.",
         open(os.path.join(HERE, "content", "privacy.html")).read())

    # ARTICLES
    for p, t, k, d in ARTICLES:
        body = open(os.path.join(HERE, "content", p.strip("/").split("/")[-1] + ".html")).read()
        meta = "Endicott Speed Shop · Engineering foundations"
        article(page, p, t, k, d, meta, body)

    # TOOLS
    for slug, title, desc in [("cg-builder", "Balance & CG Builder", "Free center of gravity and weight distribution builder: start from corner weights, add, remove or move parts, see front %, side balance and CG height change."),
                              ("scale-delta", "Part Weight from Corner Scales", "Find a part's weight and fore-aft location from four-corner scale readings taken before and after removing it."),
                              ("load-transfer", "Load Transfer Calculator", "Free load transfer calculator: braking, acceleration and cornering weight transfer, front/rear split from roll stiffness and roll centers, and the load on each tire."),
                              ("spring-rate", "Spring Rate & Ride Frequency Calculator", "Free spring rate calculator: wheel rate from motion ratio and spring angle, ride rate with the tire, ride frequency front and rear, and the spring rate needed for a target frequency.")]:
        body = open(os.path.join(HERE, "content", "tool-" + slug + ".html")).read()
        ev, res = {"cg-builder": ("cg_builder", "oF"), "scale-delta": ("scale_delta", "w"), "load-transfer": ("load_transfer", "lx"), "spring-rate": ("spring_rate", "ff")}[slug]
        tag = f'<script src="../../assets/tool-events.js" data-tool="{ev}" data-result="{res}" defer></script>'
        page(f"tools/{slug}/index.html", f"{title} | Endicott Speed Shop", desc, body, active="Tools", extra_head=tag)
