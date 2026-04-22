import { BaseAgent } from './BaseAgent.js';
import { getDb, getSetting } from '../database.js';
import { logEmailUsage } from '../services/cost-tracker.js';
import { pickTemplate } from './email-templates.js';
import { Pricer } from './Pricer.js';

const quoter = new Pricer(() => {});

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

    // Variable quote per-business — $100 for a small florist, $1000+ for a
    // law firm with hundreds of reviews. Pricer picks the tier from signals.
    const price = quoter.quoteFor(business);

    const template = pickTemplate(business.category);
    const subject = template.subject(business, price);
    const body = template.body(business, previewUrl, price);

    const apiKey = getSetting('sendgrid_api_key');

    if (apiKey) {
      await this.sendViaApi(business.owner_email, subject, body, apiKey);
    } else {
      // Mock mode
      await new Promise((r) => setTimeout(r, Math.random() * 500 + 200));
      this.log(`Sent pitch to ${business.owner_email} for "${business.name}" — $${price}`, 'success');
    }

    this.sentThisHour++;
    this.completeTask();

    return { subject, body, to: business.owner_email, price };
  }

  async sendViaApi(to, subject, body, apiKey) {
    const fromEmail = getSetting('sendgrid_from_email');
    if (!fromEmail) {
      this.logIssue(
        'SENDGRID_FROM_EMAIL not set — cannot send real emails',
        'error',
        'Set SENDGRID_FROM_EMAIL in your .env and make sure the sending domain has SPF + DKIM configured in SendGrid.',
      );
      return;
    }

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: 'Website Scaler' },
          subject,
          content: [{ type: 'text/plain', value: body }],
          tracking_settings: {
            click_tracking: { enable: true, enable_text: false },
            open_tracking: { enable: true },
          },
        }),
      });

      // SendGrid returns 202 Accepted on success with empty body.
      if (res.status === 202) {
        logEmailUsage({ agent: this.name });
        this.log(`Sent pitch to ${to} via SendGrid`, 'success');
        return;
      }
      const errText = await res.text();
      this.logIssue(
        `SendGrid ${res.status} for ${to}: ${errText.slice(0, 200)}`,
        'error',
        'Verify the API key, sending domain authentication, and that the recipient isn\'t on a suppression list.',
      );
    } catch (err) {
      this.logIssue(`Email send failed for ${to}: ${err.message}`, 'error');
    }
  }
}
