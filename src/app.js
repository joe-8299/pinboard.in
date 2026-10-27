'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { applySecurityHeaders, createRateLimiter } = require('./security');
const { validateApplication, validateListQuery } = require('./validate');
const repo = require('./db');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let done = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) {
        done = true;
        req.resume();
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', `Request body must be ${limit} bytes or fewer.`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'INVALID_JSON', 'Request body is not valid JSON.'));
      }
    });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

/**
 * createApp({ db, publicDir, chaos, limits, log }) -> http.Server (not yet listening)
 *  - chaos: enables ?simulate=slow|error|flaky on GET /api/internships (demo/testing only)
 *  - limits: override rate-limit and body-size settings (used by tests)
 */
function createApp({ db, publicDir = path.join(__dirname, '..', 'public'), chaos = false, limits = {}, log = () => {} }) {
  const cfg = { windowMs: 60_000, max: 120, writeMax: 5, maxBodyBytes: 10 * 1024, ...limits };
  const root = path.resolve(publicDir);
  const general = createRateLimiter({ windowMs: cfg.windowMs, max: cfg.max });
  const writes = createRateLimiter({ windowMs: cfg.windowMs, max: cfg.writeMax });
  let flakyCounter = 0;

  function setRateHeaders(res, rl) {
    res.setHeader('RateLimit-Limit', String(rl.limit));
    res.setHeader('RateLimit-Remaining', String(rl.remaining));
    if (!rl.allowed) res.setHeader('Retry-After', String(rl.retryAfter));
  }
  const tooMany = (rl) =>
    new HttpError(429, 'RATE_LIMITED', `Too many requests. Try again in ${rl.retryAfter} seconds.`);

  async function maybeChaos(url) {
    if (!chaos) return;
    const mode = url.searchParams.get('simulate');
    if (mode === 'slow') await sleep(2500);
    else if (mode === 'error') throw new HttpError(500, 'SIMULATED_ERROR', 'Simulated server error.');
    else if (mode === 'flaky') {
      flakyCounter += 1;
      if (flakyCounter % 3 !== 0) throw new HttpError(503, 'SIMULATED_UNAVAILABLE', 'Simulated temporary outage.');
    }
  }

  async function api(req, res, url, ip) {
    const p = url.pathname;
    const method = req.method;
    const only = (allowed) => {
      if (method !== allowed) {
        res.setHeader('Allow', allowed);
        throw new HttpError(405, 'METHOD_NOT_ALLOWED', `Use ${allowed} for this endpoint.`);
      }
    };

    if (p === '/api/health') {
      only('GET');
      return sendJson(res, 200, { status: 'ok' });
    }

    if (p === '/api/internships') {
      only('GET');
      await maybeChaos(url);
      const v = validateListQuery(url.searchParams);
      if (!v.ok) throw new HttpError(400, 'INVALID_QUERY', 'One or more query parameters are invalid.', v.errors);
      return sendJson(res, 200, repo.listInternships(db, v.values));
    }

    const one = /^\/api\/internships\/(\d{1,9})$/.exec(p);
    if (one) {
      only('GET');
      const item = repo.getInternship(db, Number(one[1]));
      if (!item) throw new HttpError(404, 'NOT_FOUND', 'Internship not found.');
      return sendJson(res, 200, { data: item });
    }

    if (p === '/api/applications') {
      only('POST');
      const rl = writes.check(ip);
      setRateHeaders(res, rl);
      if (!rl.allowed) throw tooMany(rl);

      const type = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (type !== 'application/json') {
        throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
      }
      const body = await readJson(req, cfg.maxBodyBytes);
      const v = validateApplication(body);
      if (!v.ok) throw new HttpError(422, 'VALIDATION_FAILED', 'Please fix the highlighted fields.', v.errors);
      if (!repo.getInternship(db, v.values.internshipId)) {
        throw new HttpError(404, 'NOT_FOUND', 'That internship no longer exists.');
      }
      const result = repo.createApplication(db, v.values);
      if (!result.ok) {
        throw new HttpError(409, 'DUPLICATE_APPLICATION', 'You have already applied to this internship with that email.',
          { email: 'You have already applied with this email.' });
      }
      return sendJson(res, 201, { data: { id: result.id, internshipId: v.values.internshipId } });
    }

    throw new HttpError(404, 'NOT_FOUND', 'No such endpoint.');
  }

  async function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Only GET and HEAD are allowed.');
    }
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, 'BAD_PATH', 'Malformed path.'); }
    if (rel.includes('\0')) throw new HttpError(400, 'BAD_PATH', 'Malformed path.');
    if (rel === '/') rel = '/index.html';

    // Path-traversal guard: resolved path must stay inside the public folder.
    const full = path.resolve(root, '.' + rel);
    if (!full.startsWith(root + path.sep)) throw new HttpError(404, 'NOT_FOUND', 'Not found.');
    const mime = MIME[path.extname(full).toLowerCase()];
    if (!mime) throw new HttpError(404, 'NOT_FOUND', 'Not found.');

    let data;
    try { data = await fs.readFile(full); } catch { throw new HttpError(404, 'NOT_FOUND', 'Not found.'); }
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length, 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  async function handle(req, res) {
    applySecurityHeaders(req, res);
    if (req.url.length > 2048) throw new HttpError(414, 'URI_TOO_LONG', 'URL is too long.');
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { throw new HttpError(400, 'BAD_URL', 'Malformed URL.'); }

    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      const ip = req.socket.remoteAddress || 'unknown';
      const rl = general.check(ip);
      setRateHeaders(res, rl);
      if (!rl.allowed) throw tooMany(rl);
      return api(req, res, url, ip);
    }
    return serveStatic(req, res, url);
  }

  function fail(req, res, err) {
    let status = 500;
    let payload = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' } };
    if (err instanceof HttpError) {
      status = err.status;
      payload = { error: { code: err.code, message: err.message } };
      if (err.fields) payload.error.fields = err.fields;
    } else {
      log('unhandled error:', err); // details stay in server logs, never in the response
    }
    if (res.headersSent) { res.destroy(); return; }
    if (status === 413) res.setHeader('Connection', 'close');
    sendJson(res, status, payload);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => fail(req, res, err));
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.on('close', () => { general.close(); writes.close(); });
  return server;
}

module.exports = { createApp };
