const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function fallbackPitch(lead, sender) {
  const name = lead.name || 'there';
  const fromName = sender?.name || 'a local web designer';
  return {
    subject: `Quick idea for ${name}`,
    body:
`Hi ${name} team,

I noticed you have ${lead.review_count || 'great'} reviews and a ${lead.rating || 'solid'}-star rating, but no website yet. Folks searching online for ${lead.category || 'your services'} in your area are probably finding your competitors instead.

I build simple, fast websites for local businesses for a flat fee — phone number, hours, services, reviews, and a contact form. Most clients are live in under a week.

If you'd like, I can put together a free 60-second mockup of what your site could look like. Just reply "yes" and I'll send it over.

Thanks,
${fromName}`,
  };
}

async function generatePitch(lead, sender = {}) {
  const c = getClient();
  if (!c) return fallbackPitch(lead, sender);

  const fromName = sender.name || 'a local web designer';
  const fromOffer = sender.offer || 'simple, fast websites for local businesses for a flat fee';

  const prompt = `You write short cold pitch emails to small local businesses that don't have a website. Keep it warm, specific, and under 130 words. End with a soft call-to-action. No emojis, no marketing fluff.

Business:
- Name: ${lead.name || 'unknown'}
- Category: ${lead.category || 'unknown'}
- Address: ${lead.address || 'unknown'}
- Rating: ${lead.rating || 'n/a'} (${lead.review_count || 0} reviews)
- Has social-only presence: ${lead.social_link ? 'yes (' + lead.social_link + ')' : 'no'}

Sender: ${fromName}
What sender offers: ${fromOffer}

Return JSON only, no prose, with keys "subject" and "body". The body must use real newlines (\\n).`;

  try {
    const resp = await c.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallbackPitch(lead, sender);
    const parsed = JSON.parse(match[0]);
    if (!parsed.subject || !parsed.body) return fallbackPitch(lead, sender);
    return parsed;
  } catch {
    return fallbackPitch(lead, sender);
  }
}

module.exports = { generatePitch };
