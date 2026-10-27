# Test Report

- **Result:** PASS
- **Tests run:** 87  |  **Passed:** 87  |  **Failed:** 0
- **Generated:** 2026-10-27T02:21:29.100Z
- **Node:** v22.22.2
- **Command:** `npm run report` (runs `npm test`)

## What is covered

| Area | Passing checks |
|---|---|
| Server-side + client-side validation | 55 |
| API behaviour (list, filter, paging, apply, errors) | 16 |
| Security (headers, SQLi, traversal, limits, leaks) | 15 |
| Frontend states and CSP-safety (static checks) | 5 |

> Rows can overlap because a test may match more than one area; the totals above are authoritative.

## Manual browser checks (do these once, ~5 minutes)

These cover what automated tests here cannot (visual states in a real browser).

| # | Step | Expected |
|---|---|---|
| 1 | `npm start`, open http://localhost:3000 | Skeleton cards flash, then 6 listings and "Showing 1–6 of 12" |
| 2 | Type `sql` in Search | List narrows to matching roles; status line updates |
| 3 | Search `zzzz` | "No internships match" panel with Clear filters button |
| 4 | `npm run demo:failures`, open http://localhost:3000/?simulate=error | Red "We couldn't load the listings" panel with **Try again** |
| 5 | Open http://localhost:3000/?simulate=flaky | Status says "Retrying (1 of 2)…" then listings load |
| 6 | Open http://localhost:3000/?simulate=slow | Skeleton shows for ~2.5 s before listings appear |
| 7 | Click **Apply**, press **Send application** empty | Inline errors under each field, focus moves to first error |
| 8 | Fill the form correctly and send | "Application sent" confirmation |
| 9 | Apply again with the same email | Inline error: already applied with this email |
| 10 | Send 6 applications within a minute | Banner: too many requests, wait N seconds |

## Raw output

```text
✔ GET /api/health returns ok (52.615539ms)
✔ GET /api/internships returns the first page with metadata (9.56763ms)
✔ pagination returns the remaining items on page 2 and none past the end (15.347476ms)
✔ filters: mode, location and text search (18.262467ms)
✔ empty result is a normal 200 with total 0 (8.28885ms)
✔ invalid query parameters return 400 with field errors (9.535706ms)
✔ GET /api/internships/:id works, unknown id is 404 (15.47119ms)
✔ POST valid application returns 201 and stores a row (21.409827ms)
✔ POST invalid application returns 422 with per-field errors (server-side validation) (7.738579ms)
✔ POST duplicate application returns 409 (5.131433ms)
✔ same email may apply to a different internship (18.93844ms)
✔ POST to a missing internship returns 404 (7.123559ms)
✔ wrong methods return 405 with an Allow header (5.725159ms)
✔ unknown API route returns JSON 404 (2.237603ms)
✔ static: index page and assets are served with correct types (10.52899ms)
✔ index.html has no inline scripts, inline styles or inline event handlers (CSP-safe) (0.843496ms)
✔ page has loading, error (with retry), empty and ready states (0.223039ms)
✔ application form has labelled fields, error slots and relies on JS validation (0.122835ms)
✔ app.js never writes HTML from data (XSS guard) (0.159643ms)
✔ app.js uses client validation, aborts stale requests, and never auto-retries POST (0.088443ms)
✔ secure headers are present on API and static responses (74.797874ms)
✔ SQL injection in search/filter params is treated as plain text (65.605232ms)
✔ LIKE wildcards typed by the user are escaped (% and _ match literally) (21.753037ms)
✔ SQL text inside the free-text note is stored literally, not executed (15.454761ms)
✔ SQL injection via the id path segment returns 404 (5.364946ms)
✔ path traversal cannot read files outside /public (12.691713ms)
✔ malformed JSON returns 400 (7.17729ms)
✔ non-JSON content type returns 415 (5.724062ms)
✔ oversized request body returns 413 (4.282497ms)
✔ overlong URL returns 414 (2.647276ms)
✔ rate limit: submissions are capped and the 429 carries Retry-After (8.415115ms)
✔ rate limit: general API cap applies to reads (7.532829ms)
✔ rate limit window resets (409.370367ms)
✔ server errors do not leak internals (9.688514ms)
✔ failure-simulation switch only works when chaos mode is on (10.40623ms)
✔ server validation: valid application (3.620737ms)
✔ client validation: valid application (1.033517ms)
✔ client and server agree: valid application (0.305225ms)
✔ server validation: name too short (2.08326ms)
✔ client validation: name too short (0.160748ms)
✔ client and server agree: name too short (0.109512ms)
✔ server validation: name with digits and symbols (0.080769ms)
✔ client validation: name with digits and symbols (0.07638ms)
✔ client and server agree: name with digits and symbols (0.341614ms)
✔ server validation: accented name is fine (0.2992ms)
✔ client validation: accented name is fine (0.120603ms)
✔ client and server agree: accented name is fine (0.07569ms)
✔ server validation: email missing @ (0.063095ms)
✔ client validation: email missing @ (0.15183ms)
✔ client and server agree: email missing @ (0.069766ms)
✔ server validation: email with spaces (0.047616ms)
✔ client validation: email with spaces (0.048007ms)
✔ client and server agree: email with spaces (0.062732ms)
✔ server validation: empty email (0.045897ms)
✔ client validation: empty email (0.145503ms)
✔ client and server agree: empty email (0.064412ms)
✔ server validation: school optional and empty (0.057861ms)
✔ client validation: school optional and empty (0.047161ms)
✔ client and server agree: school optional and empty (0.048934ms)
✔ server validation: school too long (0.061479ms)
✔ client validation: school too long (0.099207ms)
✔ client and server agree: school too long (0.050933ms)
✔ server validation: cover note too short (0.060751ms)
✔ client validation: cover note too short (0.046289ms)
✔ client and server agree: cover note too short (0.048783ms)
✔ server validation: cover note too long (0.062189ms)
✔ client validation: cover note too long (0.047746ms)
✔ client and server agree: cover note too long (0.047321ms)
✔ server validation: consent not given (0.053621ms)
✔ client validation: consent not given (0.10772ms)
✔ client and server agree: consent not given (0.053534ms)
✔ server validation: consent as string is rejected (0.047392ms)
✔ client validation: consent as string is rejected (0.04364ms)
✔ client and server agree: consent as string is rejected (0.939217ms)
✔ server validation: internship id not an integer (0.148905ms)
✔ client validation: internship id not an integer (0.056875ms)
✔ client and server agree: internship id not an integer (0.162706ms)
✔ server validation: internship id zero (0.068736ms)
✔ client validation: internship id zero (0.048484ms)
✔ client and server agree: internship id zero (0.04611ms)
✔ server validation: several problems at once (0.057884ms)
✔ client validation: several problems at once (1.042209ms)
✔ client and server agree: several problems at once (0.094872ms)
✔ server rejects unknown fields (mass-assignment guard) (0.173052ms)
✔ server rejects non-object bodies (0.096903ms)
✔ server normalises email and whitespace (0.128608ms)
✔ list query validation (0.434594ms)
ℹ tests 87
ℹ suites 0
ℹ pass 87
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1172.412828
```
