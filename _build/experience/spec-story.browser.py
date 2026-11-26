# Usage: ESS_PRIVATE_REVIEW=1 ESS_SPEC_STORY=1 python3 -B _build/build.py, then python3 _build/experience/spec-story.browser.py
# (needs Playwright Chromium). Restore the public build afterwards with python3 -B _build/build.py.
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright
import pathlib; root = sys.argv[1] if len(sys.argv) > 1 else str(pathlib.Path(__file__).resolve().parents[2])
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8140', '--bind', '127.0.0.1', '-d', root], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
url = 'http://127.0.0.1:8140/vehicles/1977-pontiac-firebird-formula-w72-four-speed/'
out = {}
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for w, h in [(390, 844), (1280, 900)]:
            p = b.new_page(viewport={'width': w, 'height': h})
            errs = []
            p.on('pageerror', lambda e: errs.append('page: ' + str(e)[:300]))
            p.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text[:300]))
            p.goto(url); p.wait_for_timeout(1800)
            r = {'toc': p.eval_on_selector_all('.st-q', 'els => els.map(e => e.innerText.replace(/\\s+/g," ").slice(0,150))'), 'cluster': p.inner_text('[data-st-cluster]')[:200]}
            p.screenshot(path=f'/tmp/fb-{w}-top.png')
            seen = {}
            for q in ['torque', 'launch', 'tires', 'balance', 'gearing', 'chassis', 'decades']:
                p.evaluate(f"document.querySelector('.st-q[data-st-q={q}]').click()"); p.wait_for_timeout(600)
                seen[q] = p.inner_text('.st-answer h3')
                if q == 'torque': p.eval_on_selector('.st-answer [data-in=rpm]', "el => { el.value = 3600; el.dispatchEvent(new Event('input', {bubbles:true})); }"); p.wait_for_timeout(200); seen['formula'] = p.inner_text('[data-formula]')
                if q == 'tires': p.click('.st-answer [data-tire="maxSummer"]'); p.wait_for_timeout(500); seen['tireList'] = p.inner_text('.st-tires')[:400]
                if q == 'balance': p.click('.st-answer [data-preset="battery"]'); p.wait_for_timeout(400)
                if q == 'gearing': p.click('.st-answer [data-fd="3.73"]'); p.wait_for_timeout(500); seen['gearOut'] = p.inner_text('.st-answer [data-out]')[:300]
                if q == 'decades': p.wait_for_timeout(800); seen['rows'] = p.locator('.st-answer tbody tr').count()
                if w == 1280: p.locator('.st-answer').screenshot(path=f'/tmp/fb-{w}-{q}.png')
            seen['next'] = p.inner_text('.st-a-next')
            r['seen'] = seen
            p.click('.st-cluster-more > summary'); p.wait_for_timeout(300)
            r['clusterOpen'] = p.inner_text('[data-st-cluster]')[:700]
            p.screenshot(path=f'/tmp/fb-{w}-cluster.png')
            p.click('[data-st-sources]'); p.wait_for_timeout(200)
            r['srcShown'] = p.locator('.st-src').first.is_visible()
            r['scrollW'] = p.evaluate('[document.documentElement.scrollWidth, innerWidth]')
            r['errors'] = errs
            p.screenshot(path=f'/tmp/fb-{w}-full.png', full_page=True)
            out[w] = r
        b.close()
finally:
    srv.terminate()
print(json.dumps(out, indent=1)[:12000])
