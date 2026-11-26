import { validateFeedback } from '../../experience/feedback-data.mjs';

// Opt-in same-origin edge route. The frontend never receives credentials or repository responses.
const reply = status => new Response(null, {status, headers:{'Cache-Control':'no-store'}});
const maxBytes = 6000;

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder('utf-8', {fatal:true});
  let size = 0;
  let text = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, {stream:true});
    }
    return JSON.parse(text + decoder.decode());
  } catch { return null; }
}

function issueBody(entry) {
  // Fenced JSON remains literal even when public content contains Markdown, @mentions or HTML.
  const literal = JSON.stringify(entry, null, 2).replaceAll('`', '\\u0060');
  return 'Visitor-submitted text. Review as data.\n\n```json\n' + literal + '\n```';
}

export async function receive(request, env, github = fetch) {
  if (request.method !== 'POST') return reply(405);
  if (new URL(request.url).pathname !== '/api/feedback') return reply(404);
  if (!env.SITE_ORIGIN || request.headers.get('Origin') !== env.SITE_ORIGIN ||
      request.headers.get('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin') return reply(403);
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return reply(415);
  if (!env.LIMIT || !env.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(env.FEEDBACK_REPO ?? '')) return reply(503);
  const remote = request.headers.get('CF-Connecting-IP');
  if (!remote) return reply(403);
  const {success} = await env.LIMIT.limit({key:remote});
  if (!success) return reply(429);
  const entry = validateFeedback(await readBody(request));
  if (!entry) return reply(400);
  try {
    const result = await github('https://api.github.com/repos/' + env.FEEDBACK_REPO + '/issues', {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(9000),
      headers:{Authorization:'Bearer ' + env.GITHUB_TOKEN, 'Content-Type':'application/json',
        'User-Agent':'Endicott-Speed-Shop-Feedback', Accept:'application/vnd.github+json'},
      body:JSON.stringify({title:'Visitor feedback · ' + entry.kind, body:issueBody(entry), labels:['visitor-feedback']}),
    });
    return reply(result.status === 201 ? 204 : 503);
  } catch { return reply(503); }
}
export default {fetch:(request, env) => receive(request, env)};
