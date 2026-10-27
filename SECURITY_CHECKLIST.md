# Security Checklist

Mark: ✅ done and tested · ⚠️ known limitation (see note)

## Required
- ✅ **Parameterized queries.** Every SQL value uses a `?` placeholder (`src/db.js`); SQL text is built only from fixed strings. LIKE wildcards (`%`, `_`) are escaped. *Tests: "SQL injection…" (4 tests), "LIKE wildcards…".*
- ✅ **Rate limiting.** 120 requests/min per IP on `/api/*`, and 5/min on `POST /api/applications`. Returns 429 with `Retry-After`. *Tests: 3 rate-limit tests.*
- ✅ **Secure headers on every response.** CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP/CORP; HSTS when behind HTTPS. *Test: "secure headers…".*
- ✅ **Server-side validation** of every field; never trusts the browser's checks. Unknown fields are rejected. *Tests: 48 validation cases.*
- ✅ **Client-side validation** for fast feedback (`public/validation.js`), proven to agree with the server on the same fixtures.

## Also covered
- ✅ **No XSS from data.** UI built with `textContent`; no `innerHTML`; CSP blocks inline and third-party scripts. *Tests: frontend static checks.*
- ✅ **Input limits.** Body ≤ 10 KB (413), URL ≤ 2048 chars (414), JSON content type required (415), page size ≤ 50.
- ✅ **Path traversal blocked** for static files; only `/public` is served, only known file types.
- ✅ **No internals leaked.** Unexpected errors return a generic 500; details go to the server log only.
- ✅ **No CORS headers**: API is same-origin only.
- ✅ **Duplicate protection.** `UNIQUE(internship_id, email)` in the database → 409.
- ✅ **No secrets in the repo; zero third-party dependencies** (nothing to be compromised via npm).
- ✅ **Server binds to 127.0.0.1 by default.** Set `HOST=0.0.0.0` deliberately to expose it.
- ✅ **No automatic retry of POST**, so a flaky network cannot create duplicate applications from the client.

## Known limitations (be honest in review)
- ⚠️ Rate limit is in-memory and per process; behind a proxy every user may share one IP, and multiple server instances do not share counts. Use a shared store (e.g. Redis) and trusted proxy handling in production.
- ⚠️ No authentication, CSRF tokens or CAPTCHA: the app has no logins or cookies, so CSRF is not applicable, but bots can still submit within the limit.
- ⚠️ Application data is stored unencrypted in SQLite; there is no admin view, deletion workflow or retention policy.
- ⚠️ Served over plain HTTP locally. Put it behind HTTPS before real use.
