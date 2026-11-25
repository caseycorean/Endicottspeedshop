"""The two review entrances share these sections and all downstream destinations."""

def homepage(rel=""):
    lab = rel + "experience/"
    choices = [
        ("Improve my car", "Try a part, a gear or a chassis change.", lab + "#build"),
        ("Compare vehicles", "See how two cars or two setups stack up.", lab + "#compare"),
        ("Plan my next build", "Work from a goal to a list you can test.", rel + "plan/"),
        ("Understand the engineering", "Explore what makes the numbers move.", lab + "#learn"),
    ]
    cards = "".join(f'<a class="intent-choice" href="{href}"><strong>{title}</strong><span>{copy}</span></a>'
                    for title, copy, href in choices)
    return f"""<main class="page home-page" id="main">
<section class="vehicle-hero" aria-labelledby="home-title">
  <div class="vehicle-hero-copy">
    <p class="kicker">The real-world performance workshop</p>
    <h1 id="home-title">Build it.<br><em>Then prove it.</em></h1>
    <p>Start with a car and find out what a change does before you make it.</p>
    <div class="hero-actions" data-home-vehicle data-lab-root="{lab}">
      <button type="button" data-open-catalog aria-haspopup="dialog" class="hero-button">Choose your car</button>
      <a href="{lab}#garage">My Garage</a>
    </div>
    <noscript><p><a href="{rel}tools/">Browse calculators</a></p></noscript>
  </div>
  <figure class="vehicle-hero-photo">
    <img src="{rel}assets/palouse-pony.webp" width="1320" height="880" alt="Illustrative classic American coupe in the Palouse">
  </figure>
</section>
<section class="home-intentions" aria-labelledby="intent-title">
  <h2 id="intent-title">What are you working on?</h2>
  <div class="intent-choices">{cards}</div>
</section>
<section class="home-fieldnotes" aria-labelledby="field-title">
  <div>
    <p class="kicker">In the workshop</p><h2 id="field-title">From a change to a result</h2>
    <p>Try braking and turning together. See which tire gets light first, then explore the same forces on your setup.</p>
    <a class="section-link" href="{lab}#tools">Explore tire loads</a>
  </div>
  <div class="home-reading">
    <a href="{rel}tools/"><strong>Calculators</strong><span>Weight, balance, load transfer and spring rates</span></a>
    <a href="{rel}articles/"><strong>Engineering articles</strong><span>From the traction circle to real component weights</span></a>
    <a href="{rel}build/"><strong>The ESS Firebird</strong><span>Follow the shop's measured project</span></a>
  </div>
</section>
<p class="review-entrance"><a href="{rel}grip/">Try the tire-load entrance</a></p>
</main>"""


def grip_entrance():
    return """<main class="page home-page" id="main">
<section class="alternate-entry">
  <p class="kicker">Engineering experiment</p>
  <h1>Watch the load move.</h1>
  <p class="lede">Brake and turn at the same time to see how the weight moves across all four tires.</p>
  <div class="glab" data-glab data-tools="../tools/load-transfer/" data-article="../articles/traction-circle/"></div>
  <div class="action-row"><a class="btn primary" href="../experience/#tools">Try it on your car</a>
  <a class="btn secondary" href="../">Vehicle-first entrance</a></div>
</section>
</main>"""
