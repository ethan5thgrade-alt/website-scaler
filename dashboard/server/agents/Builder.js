import { BaseAgent } from './BaseAgent.js';
import { getSetting } from '../database.js';
import Anthropic from '@anthropic-ai/sdk';
import { logClaudeUsage } from '../services/cost-tracker.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITES_DIR = path.join(__dirname, '..', '..', 'generated-sites');

const DESIGN_STYLES = {
  restaurant: {
    primary: '#8B4513', accent: '#D2691E', bg: '#FFF8F0', text: '#2C1810',
    font: "'Georgia', serif", heroGradient: 'linear-gradient(135deg, #8B4513 0%, #D2691E 100%)',
    style: 'warm-rich',
  },
  bakery: {
    primary: '#D4A574', accent: '#E8C9A0', bg: '#FDF6F0', text: '#4A3728',
    font: "'Georgia', serif", heroGradient: 'linear-gradient(135deg, #D4A574 0%, #F5E6D3 100%)',
    style: 'warm-inviting',
  },
  salon: {
    primary: '#B76E79', accent: '#F0E0E3', bg: '#FFFFFF', text: '#333333',
    font: "'Helvetica Neue', sans-serif", heroGradient: 'linear-gradient(135deg, #B76E79 0%, #E8C4C8 100%)',
    style: 'clean-rose',
  },
  lawyer: {
    primary: '#1B2A4A', accent: '#2C4A7C', bg: '#F5F6FA', text: '#1B2A4A',
    font: "'Times New Roman', serif", heroGradient: 'linear-gradient(135deg, #1B2A4A 0%, #2C4A7C 100%)',
    style: 'serious-navy',
  },
  dentist: {
    primary: '#008B8B', accent: '#20B2AA', bg: '#F0FFFF', text: '#2F4F4F',
    font: "'Helvetica Neue', sans-serif", heroGradient: 'linear-gradient(135deg, #008B8B 0%, #20B2AA 100%)',
    style: 'clinical-teal',
  },
  gym: {
    primary: '#1A1A2E', accent: '#E94560', bg: '#16213E', text: '#FFFFFF',
    font: "'Arial Black', sans-serif", heroGradient: 'linear-gradient(135deg, #1A1A2E 0%, #E94560 100%)',
    style: 'bold-electric',
  },
  florist: {
    primary: '#6B8E23', accent: '#9ACD32', bg: '#FAFFF5', text: '#2E4600',
    font: "'Georgia', serif", heroGradient: 'linear-gradient(135deg, #6B8E23 0%, #9ACD32 100%)',
    style: 'natural-green',
  },
  auto_repair: {
    primary: '#333333', accent: '#FF6600', bg: '#F5F5F5', text: '#222222',
    font: "'Arial', sans-serif", heroGradient: 'linear-gradient(135deg, #333333 0%, #FF6600 100%)',
    style: 'industrial',
  },
  pet_service: {
    primary: '#4A90D9', accent: '#FFB347', bg: '#F8FBFF', text: '#2C3E50',
    font: "'Helvetica Neue', sans-serif", heroGradient: 'linear-gradient(135deg, #4A90D9 0%, #FFB347 100%)',
    style: 'friendly-bright',
  },
  default: {
    primary: '#2563EB', accent: '#3B82F6', bg: '#F8FAFC', text: '#1E293B',
    font: "'Helvetica Neue', sans-serif", heroGradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
    style: 'modern-blue',
  },
};

export class Builder extends BaseAgent {
  constructor(name, broadcast) {
    super(name, broadcast);
    this.buildCount = 0;
    this.totalBuildTime = 0;
  }

  get avgBuildTime() {
    return this.buildCount > 0 ? Math.round(this.totalBuildTime / this.buildCount) : 0;
  }

  async buildSite(business) {
    this.heartbeat();
    const startTime = Date.now();
    this.log(`Building site for "${business.name}"`, 'info');

    const category = business.category || 'default';
    const design = DESIGN_STYLES[category] || DESIGN_STYLES.default;

    // Use real Claude when key is set; fall back to templates otherwise.
    const anthropicKey = getSetting('anthropic_api_key');
    let about;
    let tagline;
    if (anthropicKey) {
      try {
        ({ about, tagline } = await this.generateCopyWithClaude(business, anthropicKey));
      } catch (err) {
        this.log(`Claude copy failed (${err.message}) — falling back to templates`, 'warning');
        about = this.generateAbout(business);
        tagline = this.generateTagline(business);
      }
    } else {
      about = this.generateAbout(business);
      tagline = this.generateTagline(business);
    }

    const html = this.generateHtml(business, design, about, tagline);

    // Save file
    const filename = `${business.place_id.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    const filePath = path.join(SITES_DIR, filename);
    fs.writeFileSync(filePath, html, 'utf-8');

    const buildTime = Date.now() - startTime;
    this.buildCount++;
    this.totalBuildTime += buildTime;

    const baseUrl = getSetting('site_base_url') || 'http://localhost:3001/sites';
    const previewUrl = `${baseUrl}/${filename}`;

    this.log(`Built site for "${business.name}" in ${buildTime}ms`, 'success');
    this.completeTask();

    return {
      htmlPath: filePath,
      previewUrl,
      buildTime,
      designStyle: design.style,
    };
  }

  // Real Claude copy generation. Haiku for minimum token cost (~$0.001 per site).
  // Returns { about, tagline } — structured JSON so we never have to parse prose.
  async generateCopyWithClaude(biz, apiKey) {
    const client = new Anthropic({ apiKey });
    const reviews = Array.isArray(biz.reviews)
      ? biz.reviews
          .slice(0, 3)
          .map((r) => `- (${r.rating}★) ${String(r.text || '').slice(0, 220)}`)
          .join('\n')
      : '';
    const userInput = [
      `Name: ${biz.name}`,
      `Category: ${biz.category || 'local business'}`,
      `Address: ${biz.address || ''}`,
      biz.rating ? `Rating: ${biz.rating} (${biz.review_count || 0} reviews)` : '',
      biz.editorial_summary ? `Editorial: ${biz.editorial_summary}` : '',
      reviews ? `Top reviews:\n${reviews}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const model = 'claude-haiku-4-5';
    const response = await client.messages.create({
      model,
      max_tokens: 400,
      system:
        'You write short, grounded website copy for small local businesses. ' +
        'No jargon, no marketing clichés ("dedicated to", "nestled", "where quality meets"). ' +
        'Base every line on the business data provided; never invent credentials or services. ' +
        'Return ONLY valid JSON matching: {"tagline": "5-9 word phrase", "about": "50-90 word paragraph (2-3 sentences)"}',
      messages: [{ role: 'user', content: userInput }],
    });

    // Real-cost accounting — feeds the daily budget cap + dashboard meter.
    logClaudeUsage({ agent: this.name, model, usage: response.usage });

    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock?.text?.trim() || '';
    // Strip accidental markdown fences if the model adds them.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned);
    if (!parsed.about || !parsed.tagline) {
      throw new Error('Claude returned incomplete copy JSON');
    }
    return { about: parsed.about, tagline: parsed.tagline };
  }

  generateAbout(biz) {
    const templates = [
      `Welcome to ${biz.name}! We've been proudly serving our community with dedication and passion. Our team is committed to providing you with the highest quality ${biz.category === 'restaurant' ? 'dining experience' : 'service'} every single time you visit us.`,
      `At ${biz.name}, we believe in putting our customers first. With a stellar ${biz.rating}-star rating from ${biz.review_count} happy customers, we're proud to be a trusted name in our neighborhood. Come see why our community loves us!`,
      `${biz.name} is your go-to destination for exceptional ${biz.category === 'restaurant' ? 'food and atmosphere' : 'quality and care'}. Our experienced team brings years of expertise to ensure you receive nothing but the best.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateTagline(biz) {
    const taglines = {
      restaurant: 'Where Every Meal Tells a Story',
      bakery: 'Freshly Baked with Love, Daily',
      salon: 'Your Beauty, Our Passion',
      lawyer: 'Trusted Counsel When It Matters Most',
      dentist: 'Smiles You Can Be Proud Of',
      gym: 'Push Your Limits. Transform Your Life.',
      florist: 'Blooming Beautiful Since Day One',
      auto_repair: 'Keeping You on the Road',
      pet_service: 'Because They Deserve the Best',
    };
    return taglines[biz.category] || 'Excellence in Everything We Do';
  }

  generateHtml(biz, design, about, tagline) {
    const services = Array.isArray(biz.services) ? biz.services : ['Quality Service'];
    const hours = biz.hours || {};
    const isDark = design.style === 'bold-electric';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escHtml(biz.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${design.font};
      background: ${design.bg};
      color: ${design.text};
      line-height: 1.6;
    }
    .hero {
      background: ${design.heroGradient};
      color: #fff;
      padding: 80px 20px;
      text-align: center;
    }
    .hero h1 { font-size: 2.8rem; margin-bottom: 10px; }
    .hero p { font-size: 1.3rem; opacity: 0.9; }
    .hero .rating {
      margin-top: 15px;
      font-size: 1.1rem;
      opacity: 0.85;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 0 20px; }
    section { padding: 60px 20px; }
    section h2 {
      font-size: 1.8rem;
      color: ${design.primary};
      margin-bottom: 20px;
      text-align: center;
    }
    .about p { text-align: center; max-width: 700px; margin: 0 auto; font-size: 1.1rem; }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    .service-card {
      background: ${isDark ? '#0F3460' : '#fff'};
      border: 1px solid ${isDark ? '#1A1A2E' : '#e5e7eb'};
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .service-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .hours-table {
      width: 100%;
      max-width: 500px;
      margin: 20px auto;
      border-collapse: collapse;
    }
    .hours-table td {
      padding: 10px 15px;
      border-bottom: 1px solid ${isDark ? '#333' : '#eee'};
    }
    .hours-table td:first-child { font-weight: 600; text-transform: capitalize; }
    .map-section { background: ${isDark ? '#0F3460' : '#f9fafb'}; }
    .map-container {
      border-radius: 10px;
      overflow: hidden;
      margin-top: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .map-container iframe { width: 100%; height: 350px; border: 0; }
    .contact {
      background: ${design.primary};
      color: #fff;
      text-align: center;
    }
    .contact h2 { color: #fff; }
    .contact p { margin: 8px 0; font-size: 1.1rem; }
    .contact a { color: #fff; text-decoration: underline; }
    footer {
      background: ${isDark ? '#0A0A1A' : '#1f2937'};
      color: #9ca3af;
      text-align: center;
      padding: 30px 20px;
      font-size: 0.9rem;
    }
    @media (max-width: 600px) {
      .hero h1 { font-size: 2rem; }
      .hero p { font-size: 1rem; }
      .services-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <section class="hero">
    <div class="container">
      <h1>${this.escHtml(biz.name)}</h1>
      <p>${this.escHtml(tagline)}</p>
      ${biz.rating ? `<div class="rating">${'&#9733;'.repeat(Math.round(biz.rating))} ${biz.rating}/5 (${biz.review_count || 0} reviews)</div>` : ''}
    </div>
  </section>

  <section class="about">
    <div class="container">
      <h2>About Us</h2>
      <p>${this.escHtml(about)}</p>
    </div>
  </section>

  <section>
    <div class="container">
      <h2>Our Services</h2>
      <div class="services-grid">
        ${services.map((s) => `<div class="service-card">${this.escHtml(s)}</div>`).join('\n        ')}
      </div>
    </div>
  </section>

  ${Object.keys(hours).length > 0 ? `
  <section>
    <div class="container">
      <h2>Hours</h2>
      <table class="hours-table">
        ${Object.entries(hours).map(([day, time]) => `<tr><td>${this.escHtml(day)}</td><td>${this.escHtml(time)}</td></tr>`).join('\n        ')}
      </table>
    </div>
  </section>` : ''}

  <section class="map-section">
    <div class="container">
      <h2>Find Us</h2>
      <p style="text-align:center;">${this.escHtml(biz.address || '')}</p>
      <div class="map-container">
        <iframe src="https://maps.google.com/maps?q=${encodeURIComponent(biz.address || biz.name)}&output=embed" allowfullscreen loading="lazy"></iframe>
      </div>
    </div>
  </section>

  <section class="contact">
    <div class="container">
      <h2>Contact Us</h2>
      ${biz.phone ? `<p>Phone: <a href="tel:${this.escHtml(biz.phone)}">${this.escHtml(biz.phone)}</a></p>` : ''}
      ${biz.address ? `<p>Address: ${this.escHtml(biz.address)}</p>` : ''}
    </div>
  </section>

  <footer>
    <p>&copy; ${new Date().getFullYear()} ${this.escHtml(biz.name)}. All rights reserved.</p>
  </footer>
</body>
</html>`;
  }

  escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
