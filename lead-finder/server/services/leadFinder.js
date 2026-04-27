const cheerio = require('cheerio');

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.primaryType',
  'places.types',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

const SOCIAL_DOMAINS = new Set([
  'facebook.com', 'fb.com', 'm.facebook.com',
  'instagram.com', 'instagr.am',
  'twitter.com', 'x.com',
  'tiktok.com',
  'linkedin.com',
  'linktr.ee', 'beacons.ai', 'bio.link',
  'yelp.com', 'yellowpages.com',
  'google.com', 'goo.gl', 'g.page', 'maps.google.com',
  'nextdoor.com',
  'youtube.com', 'youtu.be',
]);

const DEFAULTS = {
  MIN_REVIEWS: 3,
  MAX_REVIEWS: 500,
  MIN_RATING: 3.0,
  REQUIRE_PHONE: true,
  REQUIRE_OPERATIONAL: true,
  SOCIAL_ONLY_COUNTS_AS_NO_WEBSITE: true,
};

function normalizeDomain(url) {
  if (!url) return '';
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return '';
  }
}

function isSocialLink(url) {
  const domain = normalizeDomain(url);
  if (!domain) return false;
  for (const d of SOCIAL_DOMAINS) {
    if (domain === d || domain.endsWith('.' + d)) return true;
  }
  return false;
}

function hasRealWebsite(place, opts) {
  const site = (place.websiteUri || '').trim();
  if (!site) return false;
  if (opts.SOCIAL_ONLY_COUNTS_AS_NO_WEBSITE && isSocialLink(site)) return false;
  return true;
}

function passesQualityFilters(place, opts) {
  const reviews = place.userRatingCount || 0;
  const rating = place.rating || 0;
  const phone = place.nationalPhoneNumber || place.internationalPhoneNumber;
  const status = place.businessStatus || '';

  if (reviews < opts.MIN_REVIEWS) return [false, `too few reviews (${reviews})`];
  if (reviews > opts.MAX_REVIEWS) return [false, `too many reviews (${reviews}) — likely chain`];
  if (rating && rating < opts.MIN_RATING) return [false, `rating too low (${rating})`];
  if (opts.REQUIRE_PHONE && !phone) return [false, 'no phone number'];
  if (opts.REQUIRE_OPERATIONAL && status && status !== 'OPERATIONAL') return [false, `status: ${status}`];
  return [true, ''];
}

async function searchPlaces(query, apiKey) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': SEARCH_FIELD_MASK,
  };

  const results = [];
  let pageToken = null;

  for (let page = 0; page < 3; page++) {
    const body = { textQuery: query, pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;

    const resp = await fetch(PLACES_SEARCH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google Places API error ${resp.status}: ${text.slice(0, 300)}`);
    }

    const data = await resp.json();
    if (Array.isArray(data.places)) results.push(...data.places);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results;
}

function filterLeads(places, opts) {
  return places.filter((p) => {
    if (hasRealWebsite(p, opts)) return false;
    const [ok] = passesQualityFilters(p, opts);
    return ok;
  });
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SKIP_EMAIL_HINTS = ['sentry.io', 'wixpress', 'example.com', 'godaddy', 'no-reply', 'noreply'];

async function scrapeEmail(url) {
  if (!url) return '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 LeadFinderBot/1.0' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!resp.ok) return '';
    const html = await resp.text();
    const $ = cheerio.load(html);

    const mailtos = [];
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const addr = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (addr) mailtos.push(addr);
    });

    const matches = (html.match(EMAIL_RE) || []);
    const candidates = [...mailtos, ...matches]
      .map((e) => e.toLowerCase())
      .filter((e) => !SKIP_EMAIL_HINTS.some((h) => e.includes(h)));

    return candidates[0] || '';
  } catch {
    return '';
  }
}

function flattenForOutput(p, query) {
  const name = p.displayName?.text || '';
  const site = p.websiteUri || '';
  return {
    place_id: p.id || '',
    name,
    address: p.formattedAddress || '',
    phone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
    email: '',
    rating: p.rating || null,
    review_count: p.userRatingCount || 0,
    category: p.primaryType || '',
    social_link: isSocialLink(site) ? site : '',
    google_maps_uri: p.googleMapsUri || '',
    search_query: query,
  };
}

async function findLeads({ zip, businessType, apiKey, options = {} }) {
  const opts = { ...DEFAULTS, ...options };
  const query = `${businessType} in ${zip}`;

  const raw = await searchPlaces(query, apiKey);
  const filtered = filterLeads(raw, opts);
  const leads = filtered.map((p) => flattenForOutput(p, query));

  const enriched = await Promise.all(
    leads.map(async (lead) => {
      if (!lead.email && lead.social_link) {
        lead.email = await scrapeEmail(lead.social_link);
      }
      return lead;
    })
  );

  return { totalFound: raw.length, leads: enriched };
}

module.exports = { findLeads, isSocialLink, normalizeDomain };
