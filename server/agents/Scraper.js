import { BaseAgent } from './BaseAgent.js';

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

    await this.simulateDelay(500, 1500);

    // In real implementation, this would:
    // 1. Call Google Places Details API for full info
    // 2. Scrape web for owner email (LinkedIn, public records, etc.)
    // 3. Validate and clean data

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
}
