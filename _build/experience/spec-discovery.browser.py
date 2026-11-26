# Usage: ESS_PRIVATE_REVIEW=1 ESS_SPEC_DISCOVERY=1 python3 -B _build/build.py, then python3 _build/experience/spec-discovery.browser.py
# (needs Playwright Chromium). Restore the public build afterwards with python3 -B _build/build.py.
# Development test of the new F40 discovery page: load at 390 and 1280 px, open every question,
# make one change of each kind, check the readout and model results update, no script errors, no overflow.
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright
import pathlib; root = str(pathlib.Path(__file__).resolve().parents[2])
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8130', '--bind', '127.0.0.1', '-d', root], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
url = 'http://127.0.0.1:8130/vehicles/1991-ferrari-f40/'
out = {}
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for w, h in [(390, 844), (1280, 900)]:
            p = b.new_page(viewport={'width': w, 'height': h})
            errs = []
            p.on('pageerror', lambda e: errs.append('page: ' + str(e)[:300]))
            p.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text[:300]))
            p.goto(url); p.wait_for_timeout(1500)
            r = {'cards': p.eval_on_selector_all('.sd-card', 'els => els.map(e => e.innerText.replace(/\\s+/g," ").slice(0,140))')}
            r['dock'] = p.inner_text('[data-sd-dock]') if p.locator('[data-sd-dock]').count() else None
            r['benchTitle'] = p.inner_text('.sd-bench h3')
            p.screenshot(path=f'/tmp/f40-{w}-top.png')
            p.locator('.sd-bench').screenshot(path=f'/tmp/f40-{w}-launch.png')
            # change tire type in launch
            p.click('[data-tire="extremeSummer"]'); p.wait_for_timeout(300)
            r['afterTire'] = p.inner_text('.sd-bench [data-out]')[-200:]
            # each question
            seen = {}
            for q in ['gearing', 'power', 'balance', 'tires', 'speed', 'ride', 'compare', 'launch']:
                p.evaluate(f"document.querySelector('.sd-card[data-sd-q={q}]').click()"); p.wait_for_timeout(500)
                seen[q] = p.inner_text('.sd-bench h3')
                if q == 'gearing': p.click('.sd-bench [data-fd]:nth-child(6)'); p.wait_for_timeout(300)
                if q == 'power':
                    p.eval_on_selector('.sd-bench [data-in]', "el => { el.value = 20; el.dispatchEvent(new Event('input', {bubbles:true})); }"); p.wait_for_timeout(300)
                if q == 'balance': p.click('.sd-bench [data-at]:nth-child(5)'); p.wait_for_timeout(300)
                if q == 'tires': p.click('.sd-bench [data-size="335/30R18"]'); p.wait_for_timeout(200); p.click('.sd-bench [data-apply]'); p.wait_for_timeout(300)
                if q == 'speed':
                    p.eval_on_selector('.sd-bench [data-in]', "el => { el.value = -10; el.dispatchEvent(new Event('input', {bubbles:true})); }"); p.wait_for_timeout(300)
                if q == 'compare': p.wait_for_timeout(800); seen['compareRows'] = p.locator('.sd-bench table tbody tr').count()
                if w == 1280: p.locator('.sd-bench').screenshot(path=f'/tmp/f40-{w}-{q}.png')
            r['seen'] = seen
            if w == 390: p.click('[data-sd-dock]'); p.wait_for_timeout(300)
            r['readout'] = p.inner_text('[data-sd-readout-body]')[:900]
            p.screenshot(path=f'/tmp/f40-{w}-readout.png')
            r['scrollW'] = p.evaluate('[document.documentElement.scrollWidth, innerWidth]')
            r['errors'] = errs
            p.screenshot(path=f'/tmp/f40-{w}-full.png', full_page=True)
            out[w] = r
        b.close()
finally:
    srv.terminate()
print(json.dumps(out, indent=1)[:9000])
