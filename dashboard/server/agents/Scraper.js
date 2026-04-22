import { BaseAgent } from './BaseAgent.js';
import { getDb, getSetting } from '../database.js';

const MOCK_OWNERS = [
  { name: 'Rosa Martinez', email: 'rosa@mamabakery.com' },
  { name: 'Joe Williams', email: 'joe@joesauto.com' },
  { name: 'Sunny Nguyen', email: 'sunny@sunnynails.com' },
  { name: 'David Chen', email: 'david@goldendragon.com' },
  { name: 'Mike Torres', email: 'mike@peakgym.com' },
  { name: 'Dr. Patricia Chen', email: 'patricia@chendentalcare.com' },
  { name: 'Frank Brown', email: 'frank@cornerbarbershop.com' },
  { name: 'Maria Gonzalez', email: 'maria@flowergardenco.com' },
  { name: 'James Thompson', email: 'james@thompsonlaw.com' },
  { name: 'Amy Park', email: 'amy@sunriseyoga.com' },
  { name: 'Luigi Romano', email: 'luigi@luigispizza.com' },
  { name: 'Sarah Kim', email: 'sarah@happypawspet.com' },
];

const MOCK_SERVICES = {
  bakery: ['Custom Cakes', 'Fresh Bread', 'Pastries', 'Catering', 'Wedding Cakes'],
  restaurant: ['Dine-In', 'Takeout', 'Delivery', 'Catering', 'Private Events'],
  salon: ['Haircuts', 'Manicure', 'Pedicure', 'Waxing', 'Facials'],
  auto_repair: ['Oil Change', 'Brake Repair', 'Engine Diagnostics', 'Tire Service', 'AC Repair'],
  gym: ['Personal Training', 'Group Classes', 'Yoga', 'Cardio', 'Weight Training'],
  dentist: ['Cleanings', 'Fillings', 'Crowns', 'Whitening', 'Root Canals'],
  lawyer: ['Consultations', 'Contract Review', 'Business Formation', 'Litigation', 'Estate Planning'],
  florist: ['Bouquets', 'Wedding Flowers', 'Event Arrangements', 'Plant Sales', 'Delivery'],
  pet_service: ['Dog Grooming', 'Cat Grooming', 'Nail Trimming', 'Bath & Brush', 'De-shedding'],
};

const MOCK_HOURS = {
  monday: '9:00 AM - 6:00 PM',
  tuesday: '9:00 AM - 6:00 PM',
  wednesday: '9:00 AM - 6:00 PM',
  thursday: '9:00 AM - 6:00 PM',
  friday: '9:00 AM - 7:00 PM',
  saturday: '10:00 AM - 5:00 PM',
  sunday: 'Closed',
};

export class Scraper extends BaseAgent {
  constructor(broadcast) {
    super('Scraper', broadcast);
  }

  async enrichBusiness(business) {
    this.heartbeat();
    this.log(`Enriching data for ${business.name}`, 'info');

    const apiKey = getSetting('google_maps_api_key');
    if (apiKey && business.place_id && !business.place_id.startsWith('mock_')) {
      const live = await this.enrichFromApi(business, apiKey);
      if (live) return live;
      // fall through to mock if the API call failed
    }

    await this.simulateDelay(500, 1500);

    const ownerIdx = Math.floor(Math.random() * MOCK_OWNERS.length);
    const owner = MOCK_OWNERS[ownerIdx];
    const category = business.category || 'restaurant';
    const services = MOCK_SERVICES[category] || MOCK_SERVICES.restaurant;

    const enriched = {
      ...business,
      owner_name: owner.name,
      owner_email: owner.email,
      services,
      hours: MOCK_HOURS,
      photos: [
        `https://picsum.photos/seed/${business.place_id}/800/600`,
        `https://picsum.photos/seed/${business.place_id}2/800/600`,
      ],
      enriched: true,
    };

    // Validate completeness
    const missingFields = [];
    if (!enriched.owner_email) missingFields.push('email');
    if (!enriched.phone) missingFields.push('phone');
    if (!enriched.address) missingFields.push('address');

    if (missingFields.length > 0) {
      this.log(`${business.name} missing: ${missingFields.join(', ')}`, 'warning');
    }

    this.log(`Enriched ${business.name} — ${services.length} services found`, 'success');
    this.completeTask();

    return enriched;
  }

  simulateDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min)) + min;
    return new Promise((r) => setTimeout(r, delay));
  }

  async enrichFromApi(business, apiKey) {
    // Places API (New) — Place Details. Field mask = cost control.
    // Note: owner email is not a public field; we keep the mock owner email
    // for now. A real deploy would plug in Hunter.io or a domain-guess fallback.
    const fieldMask = [
      'id',
      'displayName',
      'formattedAddress',
      'nationalPhoneNumber',
      'regularOpeningHours',
      'rating',
      'userRatingCount',
      'photos',
      'reviews',
      'editorialSummary',
      'websiteUri',
      'googleMapsUri',
    ].join(',');

    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${business.place_id}`, {
        headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fieldMask },
      });
      if (!res.ok) {
        this.log(`Places Details ${res.status} for ${business.name} — falling back to mock`, 'warning');
        return null;
      }
      const p = await res.json();

      // Convert weekdayDescriptions → { monday: "9am-5pm", ... }
      const hours = {};
      for (const line of p.regularOpeningHours?.weekdayDescriptions || []) {
        const [day, ...rest] = line.split(':');
        if (day && rest.length) hours[day.trim().toLowerCase()] = rest.join(':').trim();
      }

      // Photos: resolve up to 3 in parallel. `skipHttpRedirect` returns
      // JSON with the final photo URL instead of a redirect.
      const photoResults = await Promise.all(
        (p.photos || []).slice(0, 3).map(async (ph) => {
          try {
            const pr = await fetch(
              `https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
              { headers: { 'X-Goog-Api-Key': apiKey } },
            );
            if (!pr.ok) return null;
            const { photoUri } = await pr.json();
            return photoUri || null;
          } catch {
            return null;
          }
        }),
      );
      const photos = photoResults.filter(Boolean);

      const category = business.category || 'restaurant';
      const services = MOCK_SERVICES[category] || MOCK_SERVICES.restaurant;

      // Owner email: still guessed. Plug Hunter.io in here when the key exists.
      const ownerIdx = Math.floor(Math.random() * MOCK_OWNERS.length);
      const owner = MOCK_OWNERS[ownerIdx];

      const enriched = {
        ...business,
        name: p.displayName?.text || business.name,
        address: p.formattedAddress || business.address,
        phone: p.nationalPhoneNumber || business.phone,
        rating: p.rating ?? business.rating,
        review_count: p.userRatingCount ?? business.review_count,
        hours: Object.keys(hours).length ? hours : MOCK_HOURS,
        services,
        photos: photos.length
          ? photos
          : [
              `https://picsum.photos/seed/${business.place_id}/800/600`,
              `https://picsum.photos/seed/${business.place_id}2/800/600`,
            ],
        reviews: (p.reviews || []).slice(0, 3).map((r) => ({
          author: r.authorAttribution?.displayName || 'Anonymous',
          text: r.text?.text || '',
          rating: r.rating || 0,
        })),
        editorial_summary: p.editorialSummary?.text,
        owner_name: owner.name,
        owner_email: owner.email, // TODO: replace with Hunter.io lookup
        enriched: true,
        enrichment_source: 'google_places_api',
      };

      this.log(`Enriched ${business.name} via Places API (${photos.length} photos)`, 'success');
      this.completeTask();
      return enriched;
    } catch (err) {
      this.logIssue(`Scraper API call failed for ${business.name}: ${err.message}`, 'warning');
      this.recordFailure(business, err.message);
      return null;
    }
  }

  // Persist enrichment failures so we can see which upstream errors recur
  // without flooding the issues table with one row per attempt.
  recordFailure(business, reason) {
    if (!business?.place_id) return;
    try {
      getDb().prepare(`
        INSERT INTO enrichment_failures (place_id, business_name, reason)
        VALUES (?, ?, ?)
        ON CONFLICT(place_id) DO UPDATE SET
          attempts = attempts + 1,
          last_attempt_at = CURRENT_TIMESTAMP,
          reason = excluded.reason
      `).run(business.place_id, business.name || null, String(reason).slice(0, 500));
    } catch (_) {
      // non-fatal
    }
  }
}
