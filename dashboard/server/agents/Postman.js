import { BaseAgent } from './BaseAgent.js';
import { getDb, getSetting } from '../database.js';
import crypto from 'crypto';

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

    // Suppression check — never send to a previously-unsubscribed address.
    if (business.owner_email && this.isSuppressed(business.owner_email)) {
      this.log(`Skipping ${business.owner_email} — on suppression list`, 'info');
      return { suppressed: true, to: business.owner_email };
    }

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
    const bodyCore = template.body(business, calendlyLink);

    // CAN-SPAM footer: unsubscribe link + physical address are required.
    const unsubUrl = this.buildUnsubscribeUrl(business.owner_email);
    const physical = getSetting('sender_physical_address') || '';
    const footerText = `\n\n---\nYou're receiving this because we found ${business.name} on Google Maps. If you'd rather not hear from us, unsubscribe here: ${unsubUrl}${physical ? `\n${physical}` : ''}`;
    const body = bodyCore + footerText;

    const apiKey = getSetting('sendgrid_api_key');

    if (apiKey) {
      await this.sendViaApi(business.owner_email, subject, body, apiKey, { unsubUrl });
    } else {
      // Mock mode
      await new Promise((r) => setTimeout(r, Math.random() * 500 + 200));
      this.log(`Sent pitch to ${business.owner_email} for "${business.name}"`, 'success');
    }

    this.sentThisHour++;
    this.completeTask();

    return { subject, body, to: business.owner_email, unsubUrl };
  }

  isSuppressed(email) {
    try {
      const row = getDb().prepare('SELECT id FROM suppressions WHERE email = ?').get(email.toLowerCase());
      return !!row;
    } catch {
      return false;
    }
  }

  // Signed unsubscribe token so the /unsubscribe endpoint can't be spoofed
  // to suppress arbitrary addresses.
  buildUnsubscribeUrl(email) {
    const base = getSetting('unsubscribe_base_url') || 'http://localhost:3001';
    const secret = getSetting('calendly_webhook_secret') || 'scaler-dev-secret';
    const token = crypto
      .createHmac('sha256', secret)
      .update(String(email || '').toLowerCase())
      .digest('hex')
      .slice(0, 16);
    const q = new URLSearchParams({ e: email || '', t: token });
    return `${base.replace(/\/+$/, '')}/api/unsubscribe?${q.toString()}`;
  }

  async sendViaApi(to, subject, body, apiKey, { unsubUrl } = {}) {
    const fromEmail = getSetting('sendgrid_from_email');
    if (!fromEmail) {
      this.logIssue(
        'SENDGRID_FROM_EMAIL not set — cannot send real emails',
        'error',
        'Set SENDGRID_FROM_EMAIL in your .env and make sure the sending domain has SPF + DKIM configured in SendGrid.',
      );
      return;
    }

    // Plaintext + minimal HTML multipart. The HTML version preserves line
    // breaks; recipients with HTML-only clients see a readable version.
    const htmlBody = this.toHtml(body, unsubUrl);

    // List-Unsubscribe + List-Unsubscribe-Post headers enable one-click
    // unsubscribe in Gmail / Yahoo / Apple Mail (now required for bulk
    // senders >5K/day to hit the inbox).
    const headers = {};
    if (unsubUrl) {
      headers['List-Unsubscribe'] = `<${unsubUrl}>, <mailto:unsubscribe@${fromEmail.split('@')[1] || 'example.com'}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
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
          headers,
          content: [
            { type: 'text/plain', value: body },
            { type: 'text/html', value: htmlBody },
          ],
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

  // Minimal HTML renderer for the plaintext body. Escapes, then converts
  // bare URLs and newlines. Keeps the email small — no heavy framework.
  toHtml(body, unsubUrl) {
    const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}">${u}</a>`);
    const html = linkify(escape(body)).replace(/\n/g, '<br>');
    return `<!DOCTYPE html><html><body style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:640px;margin:0 auto;padding:16px;">${html}</body></html>`;
  }
}
