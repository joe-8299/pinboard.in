# Internship Board

A small full-stack app: a vanilla-JS frontend and a Node.js + SQLite backend, integrated safely.
**Zero dependencies. No `npm install` needed.**

## Run it

You need **Node.js 22.13 or newer** (check with `node -v`). Then, in a terminal:

```bash
cd internship-board
npm start
```

Open **http://localhost:3000**. Stop with `Ctrl+C`.

| Command | What it does |
|---|---|
| `npm start` | Run the app on http://localhost:3000 |
| `npm test` | Run all 87 automated tests |
| `npm run report` | Run the tests and write `TEST_REPORT.md` |
| `npm run demo:failures` | Run with failure simulation so you can see error/retry/slow states |

Options: `PORT=4000 npm start` (macOS/Linux) or `$env:PORT=4000; npm start` (Windows PowerShell).

### See the loading and failure states
Start with `npm run demo:failures`, then open:

- http://localhost:3000/?simulate=slow  (skeleton loading for about 2.5 s)
- http://localhost:3000/?simulate=error  (failure panel + **Try again** button)
- http://localhost:3000/?simulate=flaky  (fails twice, then succeeds: shows automatic retry)

The `simulate` switch is ignored unless the server was started with `--chaos`.

## What is where

```
src/server.js      starts the server (reads PORT, HOST, DB_FILE)
src/app.js         routing, rate limits, body limits, static files, error handling
src/security.js    secure headers + rate limiter
src/validate.js    SERVER-side validation
src/db.js          SQLite schema, seed, parameterized queries
public/            index.html, app.js (UI states + API client), validation.js (CLIENT-side), styles.css
data/internships.json   seed records (12 listings)
tests/             validation, API, security and frontend tests
TEST_REPORT.md     latest test results + manual browser checklist
SECURITY_CHECKLIST.md   short security checklist with evidence
```

## API

| Method & path | Notes |
|---|---|
| `GET /api/internships?q=&type=&location=&page=&pageSize=` | `type`: `remote`, `hybrid`, `onsite`. Returns `{ data: [...], meta: { page, pageSize, total, totalPages } }` |
| `GET /api/internships/:id` | One listing, or 404 |
| `POST /api/applications` | JSON body: `internshipId, fullName, email, school?, coverNote, consent`. 201 on success |
| `GET /api/health` | `{ "status": "ok" }` |

Errors always look like `{ "error": { "code", "message", "fields?" } }`.
Statuses used: 400 bad query/JSON, 404, 405, 409 duplicate, 413 too large, 414 URL too long,
415 wrong content type, 422 validation failed, 429 rate limited (with `Retry-After`), 500 generic.

## Notes on the supplied materials
The brief, API contract and test-record JSON were not available to me when this was built, so the API
contract above is my own, written to the requirements you listed. If your brief specifies different
field names, change them in `data/internships.json`, `src/db.js` (`toApi`) and `public/app.js`.
