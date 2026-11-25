# Page content for endicottspeedshop.com. Edit here, then run: python3 _build/build.py
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

ARTICLES = [
 ("articles/measured-firebird-weights/", "What Second-Gen Firebird Parts Actually Weigh (Measured)", "Build data",
  "Scale-measured weights of LS-swap and second-gen F-body parts, with what each number includes."),
 ("articles/weight-distribution-50-50/", "What 50/50 Weight Distribution Really Means", "Engineering foundations",
  "A balanced car is a good thing, but the percentage alone doesn't tell you where the mass sits — and that matters too."),
 ("articles/traction-circle/", "Understanding the Traction Circle", "Engineering foundations",
  "Why braking into a corner costs grip, and how tires set the limit on everything the car can do."),
 ("articles/ls-swap-real-cost/", "What LS Swap Parts Actually Cost", "Build notes · green car",
  "The advertised price is rarely the real price: a documented LS1/T5 swap parts list."),
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
  [("Measured Firebird part weights", "articles/measured-firebird-weights/"), ("Part Weight from Corner Scales", "tools/scale-delta/")]),
]
def GOALS_HTML(rel):
    return "".join(f'<article class="card goal"><h3>{g}</h3><p>{d}</p><ul class="links">' +
                   "".join(f'<li><a href="{rel}{h}">{n}</a></li>' for n, h in links) + '</ul></article>' for g, d, links in GOALS)

def COMING_SOON(rel):
    return (f'<section class="section"><div class="section-label">Coming soon</div><h2>Compare options before you buy them.</h2>'
            f'<p>We are building ways to run two versions of a car through the same model — stock springs against a stiffer set, '
            f'an iron part against an aluminum one, and eventually whole suspension approaches side by side — and see what each change '
            f'is likely to do before you spend the money. These arrive after launch, as each one is checked; no dates yet.</p></section>')

def contact(page, address):
    """Contact page. The address is passed in (environment variable ESS_CONTACT_EMAIL) so it lives in one published page only."""
    page("contact/index.html", "Contact | Endicott Speed Shop", "Contact Endicott Speed Shop with corrections, calculator problems, questions or measured part data.",
         f"""<main class="page narrow article"><div class="kicker">Contact</div><h1>Contact the shop.</h1>
<p class="lede">Endicott Speed Shop is a one-person shop. Email is the best way to reach us; replies may take a few days.</p>
{('<p class="note">PREVIEW: the contact address is added before launch.</p>' if address == "pending" else f'<p><a class="btn primary" href="mailto:{address}?subject=Endicott%20Speed%20Shop">Email the shop</a></p>')}
<h2>Especially welcome</h2>
<ul><li><strong>Corrections.</strong> Which page, what looks wrong, and your source if you have one.</li>
<li><strong>Calculator problems.</strong> Which tool, the numbers you entered, and your device and browser.</li>
<li><strong>Measured data.</strong> A part's weight with what it included (hardware, fluids, brackets) and how it was weighed.</li>
<li><strong>Questions</strong> about the builds, the articles or the tools.</li></ul>
<p class="hint">What happens to your email: see <a href="../privacy/">Privacy</a>.</p>
</main>""", active="Contact")

def article(page, path, title, kicker, desc, meta, body):
    rel = "../" * path.count("/")
    page(path + "index.html", f"{title} | Endicott Speed Shop", desc,
         f'<main class="page narrow article"><div class="kicker">{kicker}</div><h1>{title}</h1><div class="meta">{meta}</div>{body}'
         f'<div class="section"><div class="section-label">Keep going</div><p><a href="{rel}tools/cg-builder/">Try the Balance &amp; CG Builder</a> · <a href="{rel}articles/">All articles</a></p></div></main>',
         active="Articles")

def build(page):
    # HOME — growth candidate (owner launch reset 24 Nov 2026): experience first, then where to go next.
    page("index.html", "Endicott Speed Shop | See what a change does before you make it",
         "Brake into a corner and watch the load on each tire move. Free, measured, plain-English performance tools and articles for real builds.",
         f"""<main class="page">
<section class="hero-lab">
<h1>Brake into a corner. Watch your tires.</h1>
<p class="lede">Every performance change moves load between the four tires. Slide the braking and cornering, lower the car, change its weight — and see what each tire is left with. Then share exactly what you found.</p>
<div class="glab" data-glab data-tools="tools/load-transfer/" data-article="articles/traction-circle/"></div>
</section>
<section class="section"><div class="section-label">Where next</div><h2>Go from “what if” to a plan.</h2>
<div class="paths">
<article class="card"><span class="tag cat-found">Available</span><h3><a href="plan/">Plan your build</a></h3><p>Turn a goal — turn-in, grip, ride, weight — into steps you can test, using the tools here along the way.</p><a class="more" href="plan/">Start planning</a></article>
<article class="card"><span class="tag cat-data">Available</span><h3><a href="tools/">Run the numbers</a></h3><p>Balance and center of gravity, load transfer, spring rates and part weights — on your own car’s numbers.</p><a class="more" href="tools/">Open the calculators</a></article>
<article class="card"><span class="tag cat-notes">In development</span><h3>Compare upgrades</h3><p>Two versions of a car through the same model: stock springs against stiffer ones, an iron part against aluminum, whole suspension approaches side by side. Published as each comparison is checked.</p></article>
<article class="card"><span class="tag cat-notes">In development</span><h3>Simulate the car</h3><p>The experiment above is step one. Next: straight-line acceleration, braking, a single corner, then linked corners and a representative lap — each checked before it goes up.</p>
<ul class="roadmap" aria-label="Simulation roadmap"><li class="now">Tire loads</li><li>Acceleration</li><li>Braking</li><li>One corner</li><li>Linked corners</li><li>A lap</li></ul></article>
</div></section>
<section class="section"><div class="section-label">Start with your question</div><h2>What are you trying to improve?</h2>
<p>Pick the closest goal. Each one pairs the idea behind it with a calculator you can run on your own numbers — whatever you drive.</p>
<div class="grid goals">{GOALS_HTML("")}</div></section>
<section class="section"><div class="section-label">Articles</div><h2>Know why, not just what.</h2>
<p>Engineering foundations explained plainly, and build notes with real numbers.</p><div class="grid">{cards(ARTICLES[:3], "")}</div>
<p style="margin-top:14px"><a href="articles/">All articles →</a></p></section>
<section class="section"><div class="section-label">The proof car</div><h2>A 1977 Firebird Formula, measured as it's built.</h2>
<p>The principles here apply to a Mustang, a Miata, a BMW or a Chevelle. Our test car happens to be a budget-conscious LS1 and T5-powered 1977 Firebird Formula: every part weighed, every cost recorded, every decision measured against the car before it.</p>
<div class="action-row"><a class="btn secondary" href="build/">Follow the build</a></div></section>
</main>
<script src="assets/grip-lab.js" defer></script>""", active="")

    # TOOLS HUB
    page("tools/index.html", "Tools | Endicott Speed Shop", "Free calculators for weight distribution, center of gravity, load transfer, spring rates and part weights.",
         f'<main class="page"><div class="kicker">Tools</div><h1>Model it before you build it.</h1><p class="lede">Free calculators for balance, center of gravity, load transfer, springs and part weights. Results are estimates — the scales have the final word.</p><div class="grid">{cards(TOOLS, "../")}</div>'
         f'{COMING_SOON("../")}</main>', active="Tools")

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
<p>Major parts going on or off the car are weighed, and each published weight says what it includes. The whole car is weighed on four corner scales at milestones, and the scale differences give a major part's weight and location. The plan for the finished car is to weigh it with fuel, fluids and driver recorded, then take it to autocross.</p>
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
<h2 id="beta">Why the site says "beta"</h2>
<p>Endicott Speed Shop launched in November 2026 and is still being built. Tools are checked against hand calculations before they go up, but they are new, and articles will be corrected and expanded as the cars are measured and tested. If something looks wrong, <a href="../contact/">please tell us</a> — corrections are welcome.</p>
<p>Questions, corrections or data to share: <a href="../contact/">contact the shop</a>.</p>
</main>""", active="About")

    # PLAN YOUR BUILD (owner desktop review, 24 Nov 2026): first version of the Build Planning Guide.
    page("plan/index.html", "Plan Your Build | Endicott Speed Shop",
         "A step-by-step way to go from a performance goal to a build plan you can test: goal, baseline, constraints, options, modeling and measurement.",
         f"""<main class="page narrow article"><div class="kicker">Build planning</div><h1>Plan your build.</h1>
<p class="lede">Most builds go wrong before the first bolt is turned: parts get bought before the goal is clear. This guide walks from what you want the car to do, to a plan you can test — using the articles and calculators on this site along the way.</p>
<div class="callout">This is the first version of the ESS build-planning guide. Some steps link to working tools today; others point to comparisons and simulations that are still being built and checked.</div>
<h2>1 · Name the goal</h2>
<p>What should the car do better: turn in, put power down, stop, ride, or simply weigh less? Is it a street car, a track car or both? A clear goal is what lets you say no to parts that don't serve it.</p>
<ul class="links">{"".join(f'<li>{g}: ' + ' · '.join(f'<a href="../{h}">{n}</a>' for n, h in links) + '</li>' for g, d, links in GOALS)}</ul>
<h2>2 · Record your baseline</h2>
<p>Write down what you have now: total weight and corner weights if you can get the car on scales, wheelbase and track, tires, and the current suspension. Every later decision is measured against this.</p>
<p><a href="../tools/cg-builder/">Balance &amp; CG Builder</a> · <a href="../tools/scale-delta/">Part Weight from Corner Scales</a> · <a href="../articles/measured-firebird-weights/">Measured part weights</a></p>
<h2>3 · Set your constraints</h2>
<p>Budget, time, tools, the fabrication you can actually do, and what has to stay (comfort, registration, originality). Constraints aren't limits on a good build — they are design inputs that narrow the options to the ones that fit.</p>
<h2>4 · Understand what drives the result</h2>
<p>Before comparing parts, understand the mechanism you're trying to change: how tires share grip, how load moves when the car brakes and turns, and why where mass sits matters as well as the percentage on the scale.</p>
<p><a href="../articles/traction-circle/">Understanding the traction circle</a> · <a href="../articles/weight-distribution-50-50/">What 50/50 really means</a></p>
<h2>5 · Compare the options on the same terms</h2>
<p>Put each option side by side: cost, weight and where it sits, fabrication required, what it changes and what it doesn't. For example, a second-gen F-body owner improving the front suspension might compare upgrading the stock parts, a bolt-in aftermarket package such as those from QA1 or Pro Touring F-Body, and a Corvette front suspension conversion. ESS is documenting comparisons like this one; they will be published here as the data is checked. (Brands are examples, not recommendations.)</p>
<h2>6 · Model before you spend</h2>
<p>Use the calculators for the questions they answer well: balance, load transfer and spring rates. Simulations that show how a change affects the car through a corner or a lap are in development, and will be added once they have been checked against measurements.</p>
<p><a href="../tools/">All calculators</a></p>
<h2>7 · Build in stages, and measure each one</h2>
<p>Make the reversible decisions first. After each stage, weigh, test and compare against your baseline — that is how you find out whether a change did what you expected, and it's how the ESS cars are developed too.</p>
<p><a href="../build/">Follow the green car</a> · <a href="../contact/">Questions or suggestions for this guide</a></p>
</main>""", active="Plan")

    # PRIVACY (launch blocker fix, 23 Nov 2026)
    page("privacy/index.html", "Privacy | Endicott Speed Shop", "What Endicott Speed Shop collects when you visit, why, and how to opt out.",
         open(os.path.join(HERE, "content", "privacy.html")).read())

    # ARTICLES
    for p, t, k, d in ARTICLES:
        body = open(os.path.join(HERE, "content", p.strip("/").split("/")[-1] + ".html")).read()
        meta = {"articles/ls-swap-real-cost/": "Endicott Speed Shop · Green car build log · Prices as of April 2026",
                "articles/measured-firebird-weights/": "Endicott Speed Shop · Measured March–July 2026"}.get(p, "Endicott Speed Shop · Engineering foundations")
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
