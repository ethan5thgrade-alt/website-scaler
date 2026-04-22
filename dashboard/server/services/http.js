import { randomUUID } from 'crypto';

// --- Request ID ------------------------------------------------------------
// Attach a request ID to every request so we can correlate logs across stages.
export function requestId() {
  return (req, res, next) => {
    const incoming = req.headers['x-request-id'];
    req.id = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  };
}

// --- Security headers ------------------------------------------------------
// Manual set — we don't want to pull `helmet` as a new dep. Matches the
// sensible defaults helmet ships.
export function securityHeaders() {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // HSTS only makes sense over HTTPS; the deployment environment sets it.
    if (req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

// --- Simple in-memory rate limiter -----------------------------------------
// Sliding-window-lite: bucket per key per `windowMs`. For multi-instance
// deploys, swap in Redis — but this is good enough for single-box today.
export function rateLimit({ windowMs = 60_000, max = 60, keyFn = (req) => req.ip, name = 'default' } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${keyFn(req)}`;
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.start + windowMs - now) / 1000));
      return res.status(429).json({
        error: 'Too many requests',
        code: 'rate_limited',
        retryAfter: Math.ceil((entry.start + windowMs - now) / 1000),
      });
    }
    next();
  };
}

// --- CORS allowlist --------------------------------------------------------
// `process.env.CORS_ORIGINS` is a comma-separated list. Empty → allow all
// (dev-friendly). Falls through to the cors package; this one just trims.
export function corsOriginList() {
  const raw = process.env.CORS_ORIGINS || '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length === 0 ? true : list;
}

// --- 404 + error envelope --------------------------------------------------
export function notFound() {
  return (req, res) => {
    res.status(404).json({ error: 'Not found', code: 'not_found', path: req.path });
  };
}

export function errorHandler() {
  // 4-arity signature is required for Express to treat it as an error handler.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const body = {
      error: err.expose ? err.message : status >= 500 ? 'Internal server error' : err.message,
      code: err.code || (status >= 500 ? 'internal' : 'bad_request'),
      requestId: req.id,
    };
    // Log with request-id so ops can correlate.
    console.error(JSON.stringify({
      level: 'error',
      requestId: req.id,
      method: req.method,
      path: req.path,
      status,
      message: err.message,
      stack: err.stack,
    }));
    res.status(status).json(body);
  };
}

// --- Structured access log -------------------------------------------------
export function accessLog() {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      // Skip the noisy polling endpoints — they'd flood the log.
      if (req.path === '/api/pipeline/status' || req.path === '/api/activity') return;
      console.log(JSON.stringify({
        level: 'info',
        ts: new Date().toISOString(),
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      }));
    });
    next();
  };
}
