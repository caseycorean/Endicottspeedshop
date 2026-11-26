# Usage: ESS_PRIVATE_REVIEW=1 ESS_SPEC_GUIDED=1 python3 -B _build/build.py, then python3 _build/experience/spec-guided.browser.py
# (needs Playwright Chromium). Restore the public build afterwards with python3 -B _build/build.py.
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright
import pathlib; root = sys.argv[1] if len(sys.argv) > 1 else str(pathlib.Path(__file__).resolve().parents[2])
path = sys.argv[2] if len(sys.argv) > 2 else 'vehicles/1993-ford-mustang-lx-5-0-ssp-five-speed-m5-us/'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8150', '--bind', '127.0.0.1', '-d', root], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
url = 'http://127.0.0.1:8150/' + path
out = {}
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for w, h in [(390, 844), (1280, 900)]:
            p = b.new_page(viewport={'width': w, 'height': h})
            errs = []
            p.on('pageerror', lambda e: errs.append('page: ' + str(e)[:300]))
            p.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text[:300]))
            p.goto(url); p.wait_for_timeout(2000)
            r = {'toc': p.eval_on_selector_all('.sg-q', 'els => els.map(e => e.innerText.replace(/\\s+/g," ").slice(0,170))'), 'bar': p.inner_text('[data-sg-bar]')[:200]}
            p.screenshot(path=f'/tmp/mg-{w}-top.png')
            seen = {}
            order = p.eval_on_selector_all('.sg-q', 'els => els.map(e => e.dataset.sgQ)')
            for q in order:
                p.evaluate(f"document.querySelector('.sg-q[data-sg-q={q}]').click()"); p.wait_for_timeout(600)
                seen[q] = p.inner_text('.sg-a-title')
                if q == 'power': p.eval_on_selector('.sg-a-body [data-in=pct]', "el => { el.value = 20; el.dispatchEvent(new Event('input', {bubbles:true})); }"); p.wait_for_timeout(300)
                if q == 'tires': p.click('.sg-a-body [data-tire="extremeSummer"]'); p.wait_for_timeout(500)
                if q == 'gearing': p.click('.sg-a-body [data-fd="3.73"]'); p.wait_for_timeout(500); seen['gearOut'] = p.inner_text('.sg-a-body [data-out]')[:500]
                if q == 'balance': p.click('.sg-a-body [data-preset="battery"]'); p.wait_for_timeout(400)
                if q == 'plan': seen['plan'] = p.inner_text('.sg-a-body [data-plan]')[:700]
                if q == 'compare': p.wait_for_timeout(800); seen['rows'] = p.locator('.sg-a-body tbody tr').count(); seen['cmpHead'] = p.inner_text('.sg-a-body thead')
                if w == 1280: p.locator('.sg-answer').screenshot(path=f'/tmp/mg-{w}-{q}.png')
            r['seen'] = seen
            p.click('.sg-bar-more > summary'); p.wait_for_timeout(300)
            r['barOpen'] = p.inner_text('[data-sg-bar]')[:800]
            p.screenshot(path=f'/tmp/mg-{w}-bar.png')
            p.click('[data-sg-sources]'); p.wait_for_timeout(200)
            r['scrollW'] = p.evaluate('[document.documentElement.scrollWidth, innerWidth]')
            r['errors'] = errs
            p.screenshot(path=f'/tmp/mg-{w}-full.png', full_page=True)
            out[w] = r
        b.close()
finally:
    srv.terminate()
print(json.dumps(out, indent=1)[:14000])
