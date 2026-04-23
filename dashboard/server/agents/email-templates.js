// Personalization templates for the $${price} pitch email. Each entry returns a
// `{subject, body}` given `(business, previewUrl)`. Every template must work
// when optional fields are missing — business.rating, business.review_count,
// business.owner_name, and business.category may all be undefined.
//
// Why 20+: SendGrid and most spam filters pattern-match on subject + opening
// lines. Varying these across thousands of sends dramatically improves inbox
// placement. Tone stays consistent: friendly, specific, low-pressure, no
// marketing jargon, no emoji, no ALL-CAPS.

const safe = (val, fallback = '') => (val == null || val === '' ? fallback : val);
const hasRating = (b) => typeof b.rating === 'number' && b.rating > 0;
const hasReviews = (b) => typeof b.review_count === 'number' && b.review_count > 0;
const firstName = (b) => {
  const name = safe(b.owner_name, '').trim();
  if (!name) return 'there';
  return name.split(' ')[0];
};
const signature = 'Best,\nThe Website Scaler Team';

export const EMAIL_TEMPLATES = [
  // 1 — compliment on rating
  {
    id: 'rating-compliment',
    subject: (b) =>
      hasRating(b)
        ? `${b.rating}-star businesses deserve a website — here's one for ${b.name}`
        : `A quick website for ${b.name}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\n` +
      (hasRating(b) && hasReviews(b)
        ? `Your ${b.rating}-star rating on Google with ${b.review_count} reviews is the real deal — people clearly love ${b.name}.\n\n`
        : `${b.name} looks like the kind of place people come back to.\n\n`) +
      `I noticed you don't have a website yet, so I went ahead and built one.\n${url}\n\n` +
      `If you like it, it's yours for $${price} one time — no monthly fee, no contract. Just reply and I'll hand it over.\n\n${signature}`,
  },

  // 2 — curiosity / looking-for-you
  {
    id: 'looking-for',
    subject: (b) => `Was looking for a ${safe(b.category, 'local business')} and found ${b.name}`,
    body: (b, url, price = 50) =>
      `Hey ${firstName(b)},\n\nI was looking up ${safe(b.category, 'businesses')} in your area and ` +
      `${b.name} caught my eye${hasRating(b) ? ` — ${b.rating} stars is no joke` : ''}.\n\n` +
      `Since you don't have a site yet, I built you one to try on:\n${url}\n\n` +
      `It's yours for $${price} flat if you like it. If not, no hard feelings.\n\n${signature}`,
  },

  // 3 — no-pressure preview
  {
    id: 'no-pressure-preview',
    subject: (b) => `Quick preview for ${b.name}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nI build simple sites for local businesses and made one for ${b.name}. ` +
      `No obligation — just wanted to share it with you:\n\n${url}\n\n` +
      `If it's useful, you can claim it for $${price} one-time. Either way, hope it's helpful.\n\n${signature}`,
  },

  // 4 — review-specific
  {
    id: 'review-angle',
    subject: (b) =>
      hasReviews(b) ? `${b.review_count} happy customers — and no website?` : `Noticed ${b.name}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\n` +
      (hasReviews(b)
        ? `You've got ${b.review_count} Google reviews and a solid reputation. A website would make that even stronger.\n\n`
        : `Your reputation is clearly working on word of mouth — a website would lock it in.\n\n`) +
      `I put one together for you. Take a look:\n${url}\n\n` +
      `Yours for $${price} if you want it. Reply and I'll migrate it to your domain.\n\n${signature}`,
  },

  // 5 — "I made this"
  {
    id: 'i-made-this',
    subject: (b) => `I made ${b.name} a website`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nI made ${b.name} a website. It's live right now:\n${url}\n\n` +
      `It's built from your Google listing — real hours, real phone number, real location.\n\n` +
      `If you want to keep it, $${price} one-time and it's yours forever. No subscriptions.\n\n${signature}`,
  },

  // 6 — neighborhood angle (uses zip / city if present, else generic)
  {
    id: 'neighborhood',
    subject: (b) => `A website for ${b.name} (from a neighbor)`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nI build websites for local businesses. Made one for ${b.name} because you popped up when I was looking for ${safe(b.category, 'places')} nearby.\n\n` +
      `Preview here:\n${url}\n\n` +
      `$${price} if you want to keep it. Mobile-friendly, fast, and it's yours outright.\n\n${signature}`,
  },

  // 7 — specific service / menu
  {
    id: 'service-mention',
    subject: (b, price = 50) => `${b.name} — one-page site for $${price}`,
    body: (b, url, price = 50) =>
      `Hey ${firstName(b)},\n\nYour ${safe(b.category, 'business')} came up when I was searching for one near me. ` +
      `You've got solid reviews but no website, so I built a simple one:\n\n${url}\n\n` +
      `If you want it, $${price} one-time. Includes the design, the code, and help pointing your own domain at it.\n\n${signature}`,
  },

  // 8 — short & direct
  {
    id: 'short-direct',
    subject: (b) => `Website for ${b.name}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nQuick one: I built ${b.name} a site. Here it is: ${url}\n\n` +
      `$${price} if you like it, nothing if you don't. Reply either way and I'll delete the link.\n\n${signature}`,
  },

  // 9 — gift framing
  {
    id: 'gift-framing',
    subject: (b) => `Built something for ${b.name} — take a look`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nI had some extra time this weekend and built ${b.name} a website. ` +
      `Here's the preview:\n${url}\n\n` +
      `You don't have to do anything — but if you want to keep it, it's $${price} and it's all yours. No monthly fee.\n\n${signature}`,
  },

  // 10 — "why not"
  {
    id: 'why-not',
    subject: (b) => `Why doesn't ${b.name} have a website?`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nNoticed ${b.name} doesn't have a website and figured it was time. So I made one:\n\n${url}\n\n` +
      `Built from your real info. If you like it, $${price} one-time. If not, just ignore this email.\n\n${signature}`,
  },

  // 11 — referral framing
  {
    id: 'referral',
    subject: (b) => `Someone searching for ${safe(b.category, 'local')} couldn't find your site`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nI was searching for ${safe(b.category, 'businesses')} and clicked through to ${b.name}. ` +
      `You've got the reviews — you just need a website to send them to.\n\nI built you one:\n${url}\n\n` +
      `Yours for $${price} if you want it.\n\n${signature}`,
  },

  // 12 — "takes 2 minutes"
  {
    id: 'two-minutes',
    subject: (b) => `Took 2 minutes to make ${b.name} a website`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nI build websites for small businesses using AI. Took about 2 minutes to put one together for ${b.name}:\n\n${url}\n\n` +
      `$${price} and it's yours. Don't like it? Just delete this email.\n\n${signature}`,
  },

  // 13 — proof-of-concept
  {
    id: 'proof-of-concept',
    subject: (b) => `Proof of concept for ${b.name}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nCold email, I know. But I actually built something — a full website for ${b.name}, live at:\n${url}\n\n` +
      `If the site is useful, $${price} and it's yours. Fair trade for the work.\n\n${signature}`,
  },

  // 14 — "saw on Maps"
  {
    id: 'maps-angle',
    subject: (b) => `${b.name} on Google Maps — no website?`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nFound ${b.name} on Google Maps${hasRating(b) ? `, saw the ${b.rating} stars,` : ''} ` +
      `and noticed there's no website link. So I built one using your Google listing:\n\n${url}\n\n` +
      `$${price} one-time if you want to keep it. Easy to customize later.\n\n${signature}`,
  },

  // 15 — honest / meta
  {
    id: 'honest',
    subject: (b) => `Honest pitch for ${b.name}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nQuick honest pitch: I find businesses with no website, build them one with AI, and offer it for $${price}. Here's yours:\n${url}\n\n` +
      `Zero obligation. If it's useful, reply. If not, this is the last you'll hear from me.\n\n${signature}`,
  },

  // 16 — "thought you'd want this"
  {
    id: 'thought-youd-want',
    subject: (b) => `Thought ${b.name} would want this`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nSaw ${b.name} doesn't have a website. Thought you'd want one, so I made it:\n\n${url}\n\n` +
      `$${price} and it's yours. Mobile-ready, includes your Google hours and location.\n\n${signature}`,
  },

  // 17 — speed framing
  {
    id: 'speed-framing',
    subject: (b) => `Could ${b.name} have a live website today?`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nShort answer: yes. I already built it:\n${url}\n\n` +
      `Your info, your hours, your location. $${price} and we migrate it to your domain today.\n\n${signature}`,
  },

  // 18 — "while I was browsing"
  {
    id: 'browsing',
    subject: (b) => `While I was browsing ${safe(b.category, 'local businesses')}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nI was browsing ${safe(b.category, 'places')} in your area and ${b.name} kept coming up. ` +
      `Figured I'd try something: I built you a website.\n\n${url}\n\n` +
      `If it works for you, $${price} and you own it. Otherwise no worries, I'll take it down.\n\n${signature}`,
  },

  // 19 — "your customers will find this"
  {
    id: 'customers-will-find',
    subject: (b) => `Where do ${b.name} customers go when they Google you?`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nWhen someone Googles ${b.name}, they find your Maps listing — but that's it. A website makes a huge difference.\n\n` +
      `I made you one. Preview:\n${url}\n\n` +
      `$${price} and your customers have somewhere to land.\n\n${signature}`,
  },

  // 20 — low-pressure / "if ever"
  {
    id: 'if-ever',
    subject: (b) => `If ${b.name} ever wants a website`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nIf ${b.name} ever wants a website, here's one ready to go:\n${url}\n\n` +
      `$${price} if you ever want to claim it. No time pressure.\n\n${signature}`,
  },

  // 21 — "one question"
  {
    id: 'one-question',
    subject: (b) => `Quick question about ${b.name}'s website`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nQuick question: do you have a website for ${b.name}? I couldn't find one.\n\n` +
      `If not, here's one I built you:\n${url}\n\n` +
      `Yours for $${price} if you want it.\n\n${signature}`,
  },

  // 22 — "we should talk"
  {
    id: 'we-should-talk',
    subject: (b) => `For ${b.name} — already built, waiting on you`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\nNo pitch, no deck. I already built ${b.name} a website — it's live at:\n${url}\n\n` +
      `$${price} one-time if you want it. Reply and we're done.\n\n${signature}`,
  },

  // 23 — property management: tenant inquiries
  // Mentions AppFolio as a known upgrade path once the PM outgrows a static
  // landing page. We're not affiliated — just naming the category leader the
  // reader will already recognize.
  {
    id: 'pm-tenant-inquiries',
    categories: ['property_management', 'real_estate_agency'],
    subject: (b) => `A website that takes rental inquiries for ${b.name}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\n` +
      `Prospective tenants tend to Google a property manager before they call. ` +
      `Right now ${b.name} has a Google listing but no site to send them to — so I built one:\n${url}\n\n` +
      `It has a rental-inquiry form and a maintenance-request form that email you directly. ` +
      `When you're ready to handle online rent + accounting, AppFolio picks up where this leaves off.\n\n` +
      `Yours for $${price} one-time if you want it.\n\n${signature}`,
  },

  // 24 — property management: trust signal
  {
    id: 'pm-trust-signal',
    categories: ['property_management', 'real_estate_agency'],
    subject: (b) =>
      hasRating(b)
        ? `${b.name}: ${b.rating} stars, no website — here's one`
        : `A simple website for ${b.name}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\n` +
      (hasRating(b) && hasReviews(b)
        ? `${b.rating} stars from ${b.review_count} reviewers is the kind of reputation owners want managing their properties — but without a website, a lot of that trust never reaches them.\n\n`
        : `Owners shopping for a property manager almost always check for a website before they reach out.\n\n`) +
      `I built ${b.name} a simple, mobile-friendly site. Preview here:\n${url}\n\n` +
      `It includes an inquiry form for owners, a rental-application form for tenants, and a services section you can edit. ` +
      `When you outgrow the one-pager, AppFolio is the usual next step for rent + maintenance at scale.\n\n` +
      `$${price} one-time if you want to keep it.\n\n${signature}`,
  },

  // 25 — property management: short & practical
  {
    id: 'pm-practical',
    categories: ['property_management', 'real_estate_agency'],
    subject: (b) => `Rental inquiry form + site for ${b.name}`,
    body: (b, url, price = 50) =>
      `Hi ${firstName(b)},\n\n` +
      `Short one — I built ${b.name} a website with a working rental-inquiry form:\n${url}\n\n` +
      `Owners and tenants land on a real page instead of a dead Google listing. ` +
      `If you already use (or are evaluating) AppFolio, this is a clean front door that points customers at it.\n\n` +
      `$${price} flat if you want it. Reply and it's yours.\n\n${signature}`,
  },
];

// Pick a template. If `bias` (the business category) matches a template's
// `categories` list, we pick from that scoped set — otherwise we pick from
// the generic pool (templates with no `categories` field). This lets a
// category like `property_management` get its tailored copy while untagged
// categories keep the general random rotation.
export function pickTemplate(bias) {
  const scoped = bias
    ? EMAIL_TEMPLATES.filter((t) => Array.isArray(t.categories) && t.categories.includes(bias))
    : [];
  const pool = scoped.length > 0
    ? scoped
    : EMAIL_TEMPLATES.filter((t) => !Array.isArray(t.categories));
  return pool[Math.floor(Math.random() * pool.length)];
}
