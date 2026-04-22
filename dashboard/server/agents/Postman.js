import { BaseAgent } from './BaseAgent.js';
import { getDb, getSetting } from '../database.js';

// Templates pitch a 15-min call. We build the demo *after* the call is booked
// (via Calendly webhook). The `url` argument is the user's Calendly link.
const EMAIL_TEMPLATES = [
  {
    subject: (name) => `Quick idea for ${name} — 15 min?`,
    body: (biz, url) =>
      `Hi ${biz.owner_name || 'there'},\n\nI came across ${biz.name} on Google — ${biz.rating} stars with ${biz.review_count} reviews is genuinely impressive.\n\nI noticed you don't have a website yet. I'd love to jump on a quick 15-minute call and show you a custom demo I can put together for your business. No pitch deck, no pressure — just a preview of what it could look like.\n\nBook a time here: ${url}\n\nIf the timing's off, reply and I'll work around your schedule.\n\nBest,\nWebsite Scaler Team`,
  },
  {
    subject: (name) => `${name} deserves a great website — let's talk`,
    body: (biz, url) =>
      `Hey ${biz.owner_name || 'there'},\n\nYour ${biz.review_count} Google reviews speak for themselves — clearly ${biz.name} is doing something right.\n\nI help small businesses get online without the monthly-fee nonsense. Got 15 minutes this week? I'll have a custom demo of a site for you, ready to look at together.\n\nGrab any time that works: ${url}\n\nCheers,\nWebsite Scaler Team`,
  },
  {
    subject: (name) => `Free demo site for ${name}?`,
    body: (biz, url) =>
      `Hi ${biz.owner_name || 'there'},\n\nI build websites for local ${biz.category || 'businesses'}, and ${biz.name} caught my eye — ${biz.rating} stars doesn't happen by accident.\n\nI'd like to put together a free demo site for you and walk you through it on a 15-minute call. No slides, no hard sell — if you like it, we talk numbers. If not, no hard feelings.\n\nPick a slot: ${url}\n\nBest regards,\nWebsite Scaler Team`,
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

    // `previewUrl` is the Calendly link today. The demo site is built *after*
    // the call is booked (via the Calendly webhook), not up front.
    const calendlyLink = previewUrl || getSetting('calendly_link') || '';
    const template = EMAIL_TEMPLATES[Math.floor(Math.random() * EMAIL_TEMPLATES.length)];
    const subject = template.subject(business.name);
    const body = template.body(business, calendlyLink);

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
