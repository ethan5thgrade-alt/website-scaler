import { BaseAgent } from './BaseAgent.js';
import { getSetting } from '../database.js';

// Mock business data for when no API key is configured
const MOCK_BUSINESSES = [
  { place_id: 'mock_1', name: "Mama Rosa's Bakery", category: 'bakery', rating: 4.7, review_count: 142, address: '123 Main St', phone: '(310) 555-0101', latitude: 34.0522, longitude: -118.2437 },
  { place_id: 'mock_2', name: "Joe's Auto Repair", category: 'auto_repair', rating: 4.3, review_count: 89, address: '456 Oak Ave', phone: '(310) 555-0102', latitude: 34.0530, longitude: -118.2450 },
  { place_id: 'mock_3', name: 'Sunny Nails & Spa', category: 'salon', rating: 4.8, review_count: 231, address: '789 Elm Blvd', phone: '(310) 555-0103', latitude: 34.0515, longitude: -118.2420 },
  { place_id: 'mock_4', name: 'Golden Dragon Kitchen', category: 'restaurant', rating: 4.5, review_count: 176, address: '321 Pine Rd', phone: '(310) 555-0104', latitude: 34.0540, longitude: -118.2460 },
  { place_id: 'mock_5', name: 'Peak Performance Gym', category: 'gym', rating: 4.6, review_count: 95, address: '654 Cedar Ln', phone: '(310) 555-0105', latitude: 34.0508, longitude: -118.2415 },
  { place_id: 'mock_6', name: 'Dr. Patricia Chen DDS', category: 'dentist', rating: 4.9, review_count: 67, address: '987 Maple Dr', phone: '(310) 555-0106', latitude: 34.0550, longitude: -118.2480 },
  { place_id: 'mock_7', name: 'The Corner Barbershop', category: 'salon', rating: 4.4, review_count: 203, address: '147 Birch St', phone: '(310) 555-0107', latitude: 34.0525, longitude: -118.2445 },
  { place_id: 'mock_8', name: 'Maria\'s Flower Garden', category: 'florist', rating: 4.7, review_count: 58, address: '258 Walnut Ave', phone: '(310) 555-0108', latitude: 34.0535, longitude: -118.2455 },
  { place_id: 'mock_9', name: 'Thompson & Associates Law', category: 'lawyer', rating: 4.2, review_count: 34, address: '369 Oak Park Blvd', phone: '(310) 555-0109', latitude: 34.0512, longitude: -118.2425 },
  { place_id: 'mock_10', name: 'Sunrise Yoga Studio', category: 'gym', rating: 4.8, review_count: 187, address: '741 Sunset Blvd', phone: '(310) 555-0110', latitude: 34.0545, longitude: -118.2470 },
  { place_id: 'mock_11', name: "Luigi's Pizza Palace", category: 'restaurant', rating: 4.6, review_count: 312, address: '852 Broadway', phone: '(310) 555-0111', latitude: 34.0518, longitude: -118.2435 },
  { place_id: 'mock_12', name: 'Happy Paws Pet Grooming', category: 'pet_service', rating: 4.5, review_count: 121, address: '963 Highland Ave', phone: '(310) 555-0112', latitude: 34.0528, longitude: -118.2442 },
];

export class Scout extends BaseAgent {
  constructor(broadcast) {
    super('Scout', broadcast);
  }

  async findBusinesses(zipCode, category, limit = 10) {
    this.heartbeat();
    const apiKey = getSetting('google_maps_api_key');

    if (apiKey) {
      return this.findBusinessesFromApi(zipCode, category, limit, apiKey);
    }

    // Mock mode
    this.log(`Searching for ${category} businesses in ${zipCode} (mock mode)`, 'info');
    await this.simulateDelay(800, 2000);

    const filtered = MOCK_BUSINESSES
      .filter((b) => !category || b.category === category || category === 'all')
      .slice(0, limit)
      .map((b) => ({
        ...b,
        place_id: `${b.place_id}_${zipCode}_${Date.now()}`,
        address: `${b.address}, ${zipCode}`,
      }));

    this.log(`Found ${filtered.length} businesses without websites in ${zipCode}`, 'success');
    this.completeTask();
    return filtered;
  }

  async findBusinessesFromApi(zipCode, category, limit, apiKey) {
    // Places API (New) v1 Text Search. Field mask keeps cost minimal — we only
    // pay for fields we request. `websiteUri` is how we filter: if the listing
    // has a website, we skip it (that's our qualifier — they don't need us).
    const query = `${category === 'all' ? 'businesses' : category} in ${zipCode}`;
    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.types',
      'places.websiteUri',
      'places.rating',
      'places.userRatingCount',
      'places.nationalPhoneNumber',
      'places.location',
      'places.googleMapsUri',
      'nextPageToken',
    ].join(',');

    const qualified = [];
    let pageToken;
    let requestsMade = 0;

    try {
      do {
        const body = { textQuery: query, pageSize: 20 };
        if (pageToken) body.pageToken = pageToken;

        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': fieldMask,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          this.logIssue(
            `Google Maps API ${res.status}: ${text.slice(0, 200)}`,
            'error',
            'Check the GOOGLE_MAPS_API_KEY and enable Places API in Google Cloud Console.',
          );
          break;
        }

        const data = await res.json();
        requestsMade++;

        for (const p of data.places || []) {
          if (p.websiteUri) continue; // already has a site — skip
          qualified.push({
            place_id: p.id,
            name: p.displayName?.text || '',
            category: category || this.inferCategory(p.types),
            rating: p.rating,
            review_count: p.userRatingCount,
            address: p.formattedAddress || '',
            phone: p.nationalPhoneNumber,
            latitude: p.location?.latitude,
            longitude: p.location?.longitude,
            maps_url: p.googleMapsUri,
          });
          if (qualified.length >= limit) break;
        }

        pageToken = data.nextPageToken;
      } while (pageToken && qualified.length < limit && requestsMade < 3);

      this.log(
        `Found ${qualified.length} businesses without websites in ${zipCode} (${requestsMade} API calls)`,
        qualified.length > 0 ? 'success' : 'warning',
      );
      this.completeTask();
      return qualified;
    } catch (err) {
      this.logIssue(`Scout API call failed: ${err.message}`, 'error');
      return [];
    }
  }

  inferCategory(types = []) {
    const map = {
      restaurant: 'restaurant',
      cafe: 'restaurant',
      bakery: 'bakery',
      bar: 'restaurant',
      beauty_salon: 'salon',
      hair_care: 'salon',
      nail_salon: 'salon',
      spa: 'salon',
      gym: 'gym',
      dentist: 'dentist',
      doctor: 'dentist',
      lawyer: 'lawyer',
      florist: 'florist',
      car_repair: 'auto_repair',
      pet_store: 'pet_service',
    };
    for (const t of types) if (map[t]) return map[t];
    return types[0] || 'other';
  }

  simulateDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min)) + min;
    return new Promise((r) => setTimeout(r, delay));
  }
}
