import crypto from 'crypto';

// Calendly: `Calendly-Webhook-Signature: t=<unix>,v1=<hex>` where v1 is
// HMAC-SHA256 of `${t}.${rawBody}` with the signing key.
export function verifyCalendly(rawBody, headerValue, signingKey, toleranceSec = 300) {
  if (!signingKey) return { ok: true, skipped: true };
  if (!headerValue || typeof headerValue !== 'string') return { ok: false, reason: 'missing_header' };

  const parts = Object.fromEntries(
    headerValue.split(',').map((p) => {
      const i = p.indexOf('=');
      return i < 0 ? [p, ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return { ok: false, reason: 'malformed_header' };

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > toleranceSec) return { ok: false, reason: 'stale' };

  const expected = crypto
    .createHmac('sha256', signingKey)
    .update(`${t}.${rawBody}`)
    .digest('hex');
  return constantEq(expected, v1)
    ? { ok: true }
    : { ok: false, reason: 'bad_signature' };
}

// SendGrid: signed with an ECDSA public key. Verify using
// `X-Twilio-Email-Event-Webhook-Signature` + `-Timestamp` headers and the
// configured public key.
export function verifySendGrid(rawBody, signature, timestamp, publicKey) {
  if (!publicKey) return { ok: true, skipped: true };
  if (!signature || !timestamp) return { ok: false, reason: 'missing_header' };

  try {
    const verifier = crypto.createVerify('sha256');
    verifier.update(timestamp + rawBody);
    verifier.end();
    const keyPem = publicKey.includes('-----BEGIN')
      ? publicKey
      : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
    const ok = verifier.verify(keyPem, signature, 'base64');
    return ok ? { ok: true } : { ok: false, reason: 'bad_signature' };
  } catch (err) {
    return { ok: false, reason: `verify_error:${err.message}` };
  }
}

function constantEq(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
