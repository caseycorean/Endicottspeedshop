"""Build the same guest feedback form for private review and the approved delivery endpoint."""
from html import escape
import os

def build(page):
    preview = os.environ.get('ESS_PRIVATE_REVIEW') == '1'
    active = os.environ.get('ESS_FEEDBACK_ENDPOINT') == '/api/feedback' and not preview
    mode = 'local' if preview else 'live' if active else 'draft'
    address = os.environ.get('ESS_CONTACT_EMAIL', '').strip()
    mail = (f'<p><a href="mailto:{escape(address, quote=True)}">Email the shop</a></p>'
            if address and address != 'pending' and not preview else '')
    message = {'live': 'Send a note to the private ESS feedback queue. No account is required.',
               'local': 'Private preview. Save a test note on this device. No feedback is sent.',
               'draft': 'Prepare a note you can copy. Online delivery is awaiting setup.'}[mode]
    action = 'Send feedback' if active else 'Save test note' if preview else 'Prepare feedback note'
    body = f'''<main id="main" class="page vr-page vr-feedback">
    <nav class="vr-breadcrumb" aria-label="Breadcrumb"><a href="../">Home</a></nav>
    <section class="vr-hero"><p class="vr-eyebrow">Endicott Speed Shop</p><h1>Tell us what needs attention.</h1><p class="vr-variant">{message}</p></section>
    <noscript><p>The feedback form needs JavaScript. {('Use the email option below.' if mail else '')}</p></noscript>
    <form class="vr-feedback-form" data-feedback-mode="{mode}" hidden>
      <label for="kind">What would you like to tell us?</label>
      <select id="kind" name="kind" required>
        <option value="">Choose a topic</option><option value="suggestion">Suggestion</option>
        <option value="correction">Specification or source correction</option><option value="usability">Something was hard to use</option>
        <option value="vehicle">Vehicle request</option><option value="feature">Feature request</option>
      </select>
      <label for="note">Your feedback</label><textarea id="note" name="note" rows="6" required minlength="10" maxlength="1200" aria-describedby="note-help"></textarea>
      <p id="note-help">Between 10 and 1,200 characters. Leave out contact details, VINs and shared configuration links.</p>
      <div class="vr-check" data-feedback-context hidden><label><input type="checkbox" name="context"> Include the public page path and, when available, its factory reference link.</label>
      <p data-context-value></p><p>Your saved vehicles, settings and measurements stay on this device.</p></div>
      <div hidden><label>Leave blank<input name="website" autocomplete="off" tabindex="-1"></label></div>
      <div class="vr-button-row"><button class="vr-button primary" type="submit">{action}</button><a href="../privacy/">Privacy</a></div>
      <p data-feedback-status role="status" tabindex="-1"></p>
      <div data-feedback-copy hidden><label for="feedback-copy">Your feedback note</label><textarea id="feedback-copy" rows="5" readonly></textarea>
        <button class="vr-button" type="button" data-feedback-copy-button>Copy note</button></div>
    </form>{mail}</main>'''
    page("contact/index.html", "Feedback | Endicott Speed Shop",
         "Suggest a correction, report a usability problem or request a vehicle or tool.", body, "Contact",
         '<script type="module" src="../experience/feedback.mjs"></script>')
