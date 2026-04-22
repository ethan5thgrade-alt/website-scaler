import { BaseAgent } from './BaseAgent.js';
import { getDb, getSetting } from '../database.js';

const EMAIL_TEMPLATES = [
  {
    subject: (name) => `I built a website for ${name} — take a look!`,
    body: (biz, url) =>
      `Hi ${biz.owner_name || 'there'},\n\nI came across ${biz.name} on Google and was really impressed — ${biz.rating} stars with ${biz.review_count} reviews is incredible!\n\nI noticed you don't have a website yet, so I went ahead and built one for you. Here's a preview:\n\n${url}\n\nIf you like it, it's yours for just $50 — no contracts, no subscriptions, you own it forever.\n\nJust reply to this email and I'll get it set up on your domain.\n\nBest,\nWebsite Scaler Team`,
  },
  {
    subject: (name) => `${name} deserves a great website — here's one I made for you`,
    body: (biz, url) =>
      `Hey ${biz.owner_name || 'there'},\n\nYour ${biz.review_count} Google reviews speak volumes about ${biz.name}. Your customers clearly love what you do!\n\nI put together a professional website for your business — completely free to preview:\n\n${url}\n\nIt's mobile-friendly, fast, and showcases your services beautifully. If you want it, just $50 and it's yours. No monthly fees, ever.\n\nWant it? Just hit reply.\n\nCheers,\nWebsite Scaler Team`,
  },
  {
    subject: (name) => `Quick question about ${name}`,
    body: (biz, url) =>
      `Hi ${biz.owner_name || 'there'},\n\nI was looking up ${biz.category || 'businesses'} in your area and found ${biz.name}. Love the ${biz.rating}-star rating!\n\nI build websites for small businesses, and I actually made one for you already — here's the preview:\n\n${url}\n\nIf it looks good, you can claim it for $50. That's it — one payment, you own the site outright.\n\nNo pressure at all. Just thought you'd want to see it!\n\nBest regards,\nWebsite Scaler Team`,
  },
];

export class Postman extends BaseAgent {
  constructor(broadcast) {
    super('Postman', broadcast);
    this.systemPrompt = `You are a friendly, professional sales copywriter. Write a short personalized email to a small business owner. Mention their business by name. Compliment something specific (their rating, reviews, or what they do). Tell them you built them a free preview website. Include the preview link. Offer to hand it over for $50 — no contracts, no subscriptions, they own it forever. Keep it under 150 words. Sound human, not salesy.`;
    this.sentThisHour = 0;
    this.hourResetTime = Date.now();
  }

  async sendPitch(business, previewUrl) {
    this.heartbeat();

    // Rate limiting
    const maxPerHour = parseInt(getSetting('max_emails_per_hour')) || 50;
    if (Date.now() - this.hourResetTime > 3600000) {
      this.sentThisHour = 0;
      this.hourResetTime = Date.now();
    }
    if (this.sentThisHour >= maxPerHour) {
      this.log(`Rate limit reached (${maxPerHour}/hr) — waiting`, 'warning');
      await new Promise((r) => setTimeout(r, 5000));
    }

    // Pick random template (in real implementation, use LLM)
    const template = EMAIL_TEMPLATES[Math.floor(Math.random() * EMAIL_TEMPLATES.length)];
    const subject = template.subject(business.name);
    const body = template.body(business, previewUrl);

    const apiKey = getSetting('sendgrid_api_key');

    if (apiKey) {
      await this.sendViaApi(business.owner_email, subject, body, apiKey);
    } else {
      // Mock mode
      await new Promise((r) => setTimeout(r, Math.random() * 500 + 200));
      this.log(`Sent pitch to ${business.owner_email} for "${business.name}"`, 'success');
    }

    this.sentThisHour++;
    this.completeTask();

    return { subject, body, to: business.owner_email };
  }

  async sendViaApi(to, subject, body, apiKey) {
    // TODO: Replace with real SendGrid/Mailgun/SES API call
    // Example SendGrid:
    // const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${apiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     personalizations: [{ to: [{ email: to }] }],
    //     from: { email: getSetting('sendgrid_from_email') },
    //     subject,
    //     content: [{ type: 'text/plain', value: body }],
    //   }),
    // });

    this.log(`[API] Would send email to ${to} via SendGrid`, 'info');
    await new Promise((r) => setTimeout(r, 300));
  }
}
