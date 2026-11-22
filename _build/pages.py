# Page content for endicottspeedshop.com. Edit here, then run: python3 _build/build.py
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

ARTICLES = [
 ("articles/measured-firebird-weights/", "What Second-Gen Firebird Parts Actually Weigh (Measured)", "Build data",
  "Scale-measured weights of LS-swap and second-gen F-body parts, with what each number includes."),
 ("articles/weight-distribution-50-50/", "Why 50/50 Weight Distribution Is Not the Goal", "Engineering foundations",
  "Where the mass sits matters more than the percentage on the scale."),
 ("articles/traction-circle/", "The Traction Circle: The One Concept That Explains Everything", "Engineering foundations",
  "Why braking into a corner costs grip, and why modern tires changed everything."),
 ("articles/ls-swap-real-cost/", "What LS Swap Parts Actually Cost", "Build log · green car",
  "The advertised price is rarely the real price: a documented LS1/T5 swap parts list."),
]
TOOLS = [
 ("tools/cg-builder/", "Balance & CG Builder", "New",
  "Start from your scale numbers, add, remove or move parts, and watch front %, side-to-side balance and center of gravity move. Includes ESS-measured part weights."),
 ("weight-distribution-calculator/", "Weight Distribution Calculator", "Original",
  "The quick version: move or change components and see the front-to-rear balance change."),
 ("tools/load-transfer/", "Load Transfer Calculator", "New",
  "See how much load moves front to rear under braking and side to side in a corner, and what each tire carries when you brake into a turn."),
 ("tools/scale-delta/", "Part Weight from Corner Scales", "New",
  "Weigh the car before and after removing a part to get the part's weight AND where it sat — the method ESS uses."),
]

def cards(items, rel):
    return "".join(f'<article class="card"><span class="tag">{t}</span><h3><a href="{rel}{p}">{h}</a></h3><p>{d}</p><a class="more" href="{rel}{p}">Open</a></article>' for p, h, t, d in items)

def article(page, path, title, kicker, desc, meta, body):
    rel = "../" * path.count("/")
    page(path + "index.html", f"{title} | Endicott Speed Shop", desc,
         f'<main class="page narrow article"><div class="kicker">{kicker}</div><h1>{title}</h1><div class="meta">{meta}</div>{body}'
         f'<div class="section"><div class="section-label">Keep going</div><p><a href="{rel}tools/cg-builder/">Try the Balance &amp; CG Builder</a> · <a href="{rel}articles/">All articles</a></p></div></main>',
         active="Articles")

def build(page):
    # HOME
    page("index.html", "Endicott Speed Shop | Measured tools for real performance decisions",
         "Calculators, measured part weights and engineering articles for builders making real performance decisions on classic cars.",
         f"""<main class="page">
<section><div class="kicker">Measure • Test • Improve</div>
<h1>Measured answers for real performance builds.</h1>
<p class="lede">Endicott Speed Shop builds second-generation Firebirds and publishes what the scales, the receipts and the engineering actually say — so you can make better decisions on your own car before you spend the money or cut the metal.</p>
<div class="action-row"><a class="btn primary" href="tools/cg-builder/">Open the Balance &amp; CG Builder</a><a class="btn secondary" href="weight-distribution-calculator/">Weight distribution calculator</a></div></section>
<section class="section"><div class="section-label">Tools</div><h2>Calculators built around measured data.</h2>
<p>Model a change before you make it. Every tool shows its assumptions.</p><div class="grid">{cards(TOOLS, "")}</div></section>
<section class="section"><div class="section-label">Articles</div><h2>Know why, not just what.</h2>
<p>Engineering foundations explained plainly, and build notes with real numbers.</p><div class="grid">{cards(ARTICLES[:3], "")}</div>
<p style="margin-top:14px"><a href="articles/">All articles →</a></p></section>
<section class="section"><div class="section-label">The build</div><h2>A 1977 Firebird Formula, measured as it's built.</h2>
<p>The green car is an LS1/T5 swap built on a tight budget: every part weighed, every cost recorded, every decision explained. It is the baseline for the more ambitious builds that follow.</p>
<div class="action-row"><a class="btn secondary" href="build/">Follow the build</a></div></section>
</main>""", active="")

    # TOOLS HUB
    page("tools/index.html", "Tools | Endicott Speed Shop", "Free calculators for weight distribution, center of gravity, load transfer and part weights.",
         f'<main class="page"><div class="kicker">Tools</div><h1>Model it before you build it.</h1><p class="lede">Free calculators for balance, center of gravity, load transfer and part weights. Results are estimates — the scales have the final word.</p><div class="grid">{cards(TOOLS, "../")}</div></main>', active="Tools")

    # ARTICLES HUB
    page("articles/index.html", "Articles | Endicott Speed Shop", "Engineering foundations and measured build notes from Endicott Speed Shop.",
         f'<main class="page"><div class="kicker">Articles</div><h1>Engineering, explained with real numbers.</h1><p class="lede">Foundations that explain how cars behave, and build notes that show what things really weigh and cost.</p><div class="grid">{cards(ARTICLES, "../")}</div></main>', active="Articles")

    # BUILD
    page("build/index.html", "The Build | Endicott Speed Shop", "The green 1977 Firebird Formula LS1/T5 build, measured as it is built.",
         """<main class="page narrow article"><div class="kicker">The build</div><h1>The green car: a 1977 Firebird Formula, measured.</h1>
<div class="meta">Status updated November 2026</div>
<p>The green car is the proof of concept: a budget LS1/T5 swap with honest constraints. The engine is a 2004 GTO LS1; the transmission is a T5 from an '84 Z28. The patina stays — if the car performs against cars costing far more, the patina becomes the point.</p>
<h2>Where it stands</h2>
<ul><li>Drivetrain installed with clutch and flywheel; driveshaft in; headers in.</li>
<li>Standalone engine harness and controller mounted; battery relocated to the trunk.</li>
<li>C5 Corvette front brakes; fuel and brake plumbing largely done.</li>
<li><strong>Next:</strong> finish wiring and final assembly, then first start.</li></ul>
<h2>What gets measured</h2>
<p>Every part going on or off the car is weighed. The whole car is weighed on four corner scales at each milestone, and the scale differences give each major part's weight and location. The finished car will be weighed with fuel, fluids and driver recorded, and taken to autocross.</p>
<div class="callout">Latest recorded weighing (July 2026, not yet complete — no nose, hood, radiator, exhaust, fuel or coolant): <strong>2,786 lb, 51% front</strong>.</div>
<h2>What comes next</h2>
<p>The green car is the baseline. Later development explores moving the engine rearward, Corvette front suspension, a three-link rear axle and, eventually, a reworked structure and underbody aerodynamics — each step measured against this car.</p>
<p><a href="../articles/measured-firebird-weights/">See the measured part weights →</a> · <a href="../articles/ls-swap-real-cost/">See what the swap parts really cost →</a></p>
</main>""", active="The Build")

    # ABOUT
    page("about/index.html", "About | Endicott Speed Shop", "Why Endicott Speed Shop exists: decisions explained, not just documented.",
         """<main class="page narrow article"><div class="kicker">About</div><h1>Not what to do next — why it's the right move.</h1>
<p>Endicott Speed Shop exists because most automotive content tells you what people did. Almost none of it tells you why the decision made sense, what it was trading off against, or how you would think through the same problem on a different car.</p>
<p>The thinking behind this platform started in the early 2000s with a concept called SuperCar X. The premise was simple: treat the car as a variable. Pick any platform. Apply the same engineering philosophy. The specific car was never the point — the framework was. That idea sat in the background for twenty years while the builds got more serious and the thinking got sharper.</p>
<p>ESS is where that led.</p>
<p>The current work centers on second-generation Firebirds. The green car is the proof of concept — a budget build with honest constraints, designed to show that the philosophy produces results against cars costing far more. The white car is the full expression of the idea: an architectural build developed from the ground up, every decision deliberate.</p>
<p>The tools, articles and guides here are built around the same question those cars ask every day: not what do I do next, but why is this the right move? That question has an engineering answer. Usually more than one. The goal of this platform is to help you find yours.</p>
<div class="callout">Measure. Test. Improve. Know why.</div>
<p>Questions, corrections or data to share: <a href="mailto:descore.llc@gmail.com?subject=Endicott%20Speed%20Shop">email the shop</a>.</p>
</main>""", active="About")

    # ARTICLES
    for p, t, k, d in ARTICLES:
        body = open(os.path.join(HERE, "content", p.strip("/").split("/")[-1] + ".html")).read()
        meta = {"articles/ls-swap-real-cost/": "Endicott Speed Shop · Green car build log · Prices as of April 2026",
                "articles/measured-firebird-weights/": "Endicott Speed Shop · Measured March–July 2026"}.get(p, "Endicott Speed Shop · Engineering foundations")
        article(page, p, t, k, d, meta, body)

    # TOOLS
    for slug, title, desc in [("cg-builder", "Balance & CG Builder", "Free center of gravity and weight distribution builder: start from corner weights, add, remove or move parts, see front %, side balance and CG height change."),
                              ("scale-delta", "Part Weight from Corner Scales", "Find a part's weight and fore-aft location from four-corner scale readings taken before and after removing it."),
                              ("load-transfer", "Load Transfer Calculator", "Free load transfer calculator: braking, acceleration and cornering weight transfer, front/rear split from roll stiffness and roll centers, and the load on each tire.")]:
        body = open(os.path.join(HERE, "content", "tool-" + slug + ".html")).read()
        ev, res = {"cg-builder": ("cg_builder", "oF"), "scale-delta": ("scale_delta", "w"), "load-transfer": ("load_transfer", "lx")}[slug]
        tag = f'<script src="../../assets/tool-events.js" data-tool="{ev}" data-result="{res}" defer></script>'
        page(f"tools/{slug}/index.html", f"{title} | Endicott Speed Shop", desc, body, active="Tools", extra_head=tag)
