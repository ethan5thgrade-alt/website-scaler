// Category → design spec. Each entry is a self-contained style contract:
// palette + typography + hero treatment + a `style` tag the Builder reads for
// small layout tweaks (dark mode, card shadows, etc).
//
// Adding a new category = one entry here. The Builder picks the closest match
// when Scout/Scraper emit a category not in this map by falling through to
// `default`.

export const DESIGN_STYLES = {
  // Food & drink
  restaurant: {
    primary: '#8B4513', accent: '#D2691E', bg: '#FFF8F0', text: '#2C1810',
    font: "'Fraunces', 'Georgia', serif", heroGradient: 'linear-gradient(135deg, #8B4513 0%, #D2691E 100%)',
    style: 'warm-rich',
  },
  cafe: {
    primary: '#6F4E37', accent: '#C08552', bg: '#FAF7F2', text: '#2D1A0E',
    font: "'Fraunces', 'Georgia', serif", heroGradient: 'linear-gradient(135deg, #6F4E37 0%, #C08552 100%)',
    style: 'warm-rich',
  },
  bakery: {
    primary: '#D4A574', accent: '#E8C9A0', bg: '#FDF6F0', text: '#4A3728',
    font: "'Fraunces', 'Georgia', serif", heroGradient: 'linear-gradient(135deg, #D4A574 0%, #F5E6D3 100%)',
    style: 'warm-inviting',
  },

  // Beauty / salon family
  salon: {
    primary: '#B76E79', accent: '#F0E0E3', bg: '#FFFFFF', text: '#333333',
    font: "'Cormorant Garamond', 'Helvetica Neue', sans-serif", heroGradient: 'linear-gradient(135deg, #B76E79 0%, #E8C4C8 100%)',
    style: 'clean-rose',
  },
  hair_salon: {
    primary: '#B76E79', accent: '#F0E0E3', bg: '#FFFFFF', text: '#1A1A1A',
    font: "'Cormorant Garamond', serif", heroGradient: 'linear-gradient(135deg, #B76E79 0%, #E8C4C8 100%)',
    style: 'clean-rose',
  },
  nail_salon: {
    primary: '#E4A5A5', accent: '#F5D5D5', bg: '#FFF9F9', text: '#2A1A1A',
    font: "'Cormorant Garamond', serif", heroGradient: 'linear-gradient(135deg, #E4A5A5 0%, #F5D5D5 100%)',
    style: 'clean-rose',
  },
  spa: {
    primary: '#6B8E8A', accent: '#D4E4E0', bg: '#FAFCFB', text: '#1F2B2A',
    font: "'Cormorant Garamond', serif", heroGradient: 'linear-gradient(135deg, #6B8E8A 0%, #A7C4BF 100%)',
    style: 'calm-airy',
  },
  barbershop: {
    primary: '#0F0F0F', accent: '#C9A227', bg: '#EDE6D6', text: '#0F0F0F',
    font: "'Anton', 'Oswald', sans-serif", heroGradient: 'linear-gradient(135deg, #1A1A1A 0%, #3A3028 100%)',
    style: 'heritage-bold',
  },

  // Legal & professional
  lawyer: {
    primary: '#1B2A4A', accent: '#C9A14A', bg: '#F5F6FA', text: '#1B2A4A',
    font: "'Playfair Display', 'Times New Roman', serif", heroGradient: 'linear-gradient(135deg, #1B2A4A 0%, #2C4A7C 100%)',
    style: 'serious-navy',
  },
  law_office: {
    primary: '#1B2A4A', accent: '#C9A14A', bg: '#F5F6FA', text: '#1B2A4A',
    font: "'Playfair Display', 'Times New Roman', serif", heroGradient: 'linear-gradient(135deg, #1B2A4A 0%, #2C4A7C 100%)',
    style: 'serious-navy',
  },

  // Medical
  dentist: {
    primary: '#008B8B', accent: '#20B2AA', bg: '#F0FFFF', text: '#2F4F4F',
    font: "'DM Serif Display', 'Helvetica Neue', sans-serif", heroGradient: 'linear-gradient(135deg, #008B8B 0%, #20B2AA 100%)',
    style: 'clinical-teal',
  },
  dental_office: {
    primary: '#008B8B', accent: '#20B2AA', bg: '#F0FFFF', text: '#2F4F4F',
    font: "'DM Serif Display', sans-serif", heroGradient: 'linear-gradient(135deg, #008B8B 0%, #20B2AA 100%)',
    style: 'clinical-teal',
  },
  medical_office: {
    primary: '#0F2340', accent: '#2A7DA8', bg: '#FFFFFF', text: '#0F2340',
    font: "'DM Serif Display', sans-serif", heroGradient: 'linear-gradient(135deg, #0F2340 0%, #2A7DA8 100%)',
    style: 'clinical-blue',
  },

  // Fitness
  gym: {
    primary: '#1A1A2E', accent: '#E94560', bg: '#16213E', text: '#FFFFFF',
    font: "'Bebas Neue', 'Arial Black', sans-serif", heroGradient: 'linear-gradient(135deg, #1A1A2E 0%, #E94560 100%)',
    style: 'bold-electric',
  },

  // Services
  auto_repair: {
    primary: '#333333', accent: '#FF6600', bg: '#F5F5F5', text: '#222222',
    font: "'Oswald', 'Arial', sans-serif", heroGradient: 'linear-gradient(135deg, #333333 0%, #FF6600 100%)',
    style: 'industrial',
  },
  plumber: {
    primary: '#1A1F2E', accent: '#F5A623', bg: '#F5F6FA', text: '#1A1F2E',
    font: "'Oswald', sans-serif", heroGradient: 'linear-gradient(135deg, #1A1F2E 0%, #2D3648 100%)',
    style: 'industrial',
  },
  electrician: {
    primary: '#1A1F2E', accent: '#F7C948', bg: '#F5F6FA', text: '#1A1F2E',
    font: "'Oswald', sans-serif", heroGradient: 'linear-gradient(135deg, #1A1F2E 0%, #2D3648 100%)',
    style: 'industrial',
  },
  dry_cleaner: {
    primary: '#1F2937', accent: '#2E5EAA', bg: '#FFFFFF', text: '#1A1A1A',
    font: "'Source Serif Pro', 'Inter', sans-serif", heroGradient: 'linear-gradient(135deg, #1F2937 0%, #2E5EAA 100%)',
    style: 'clean-service',
  },
  tutoring: {
    primary: '#2563EB', accent: '#93C5FD', bg: '#F8FAFC', text: '#0F172A',
    font: "'Source Serif Pro', 'Inter', sans-serif", heroGradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
    style: 'clean-service',
  },

  // Retail / creative
  florist: {
    primary: '#6B8E23', accent: '#9ACD32', bg: '#FAFFF5', text: '#2E4600',
    font: "'Cormorant Garamond', 'Georgia', serif", heroGradient: 'linear-gradient(135deg, #6B8E23 0%, #9ACD32 100%)',
    style: 'natural-green',
  },
  boutique: {
    primary: '#2B1B17', accent: '#D88373', bg: '#FAF6F2', text: '#2B1B17',
    font: "'Cormorant Garamond', serif", heroGradient: 'linear-gradient(135deg, #A47D73 0%, #D88373 100%)',
    style: 'soft-editorial',
  },

  // Property management / real estate — AppFolio-funnel automation target.
  // Trust-building navy + a touch of green; serif display for credibility.
  property_management: {
    primary: '#0B2545', accent: '#13856B', bg: '#F7F9FC', text: '#0B2545',
    font: "'Source Serif Pro', 'Inter', sans-serif", heroGradient: 'linear-gradient(135deg, #0B2545 0%, #13856B 100%)',
    style: 'trust-navy',
  },
  real_estate_agency: {
    primary: '#0B2545', accent: '#13856B', bg: '#F7F9FC', text: '#0B2545',
    font: "'Source Serif Pro', 'Inter', sans-serif", heroGradient: 'linear-gradient(135deg, #0B2545 0%, #13856B 100%)',
    style: 'trust-navy',
  },

  // Pet care
  pet_service: {
    primary: '#4A90D9', accent: '#FFB347', bg: '#F8FBFF', text: '#2C3E50',
    font: "'Manrope', 'Helvetica Neue', sans-serif", heroGradient: 'linear-gradient(135deg, #4A90D9 0%, #FFB347 100%)',
    style: 'friendly-bright',
  },
  pet_grooming: {
    primary: '#4A90D9', accent: '#FFB347', bg: '#F8FBFF', text: '#2C3E50',
    font: "'Manrope', sans-serif", heroGradient: 'linear-gradient(135deg, #4A90D9 0%, #FFB347 100%)',
    style: 'friendly-bright',
  },

  // Fallback
  default: {
    primary: '#2563EB', accent: '#3B82F6', bg: '#F8FAFC', text: '#1E293B',
    font: "'Inter', 'Helvetica Neue', sans-serif", heroGradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
    style: 'modern-blue',
  },
};

export function pickStyle(category) {
  return DESIGN_STYLES[category] || DESIGN_STYLES.default;
}
