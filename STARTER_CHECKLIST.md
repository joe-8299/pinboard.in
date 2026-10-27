# Starter Checklist (mapped to this repo)

- [x] Load and render API data with visible loading and failure states: `public/app.js` (`loadList`, `show`), states in `public/index.html`: skeleton, error + retry, empty, ready. Automatic retry with backoff on GET, 8 s timeout, stale-request cancel.
- [x] Application form validated on both client and server: `public/validation.js` and `src/validate.js`; server errors map back to inline field errors.
- [x] Rate limits: `src/security.js`, wired in `src/app.js`.
- [x] Secure headers: `src/security.js`.
- [x] Parameterized queries: `src/db.js`.
- [x] Test report: `TEST_REPORT.md` (`npm run report`).
- [x] Short security checklist: `SECURITY_CHECKLIST.md`.
- [ ] Submit one public/view-only link: push this folder to GitHub (see README) and submit the repo URL.
