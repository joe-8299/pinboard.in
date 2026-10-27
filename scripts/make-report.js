'use strict';
// Runs the whole test suite and writes TEST_REPORT.md.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const run = spawnSync(
  process.execPath,
  ['--disable-warning=ExperimentalWarning', '--test', '--test-reporter=spec', 'tests/**/*.test.js'],
  { cwd: root, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } }
);
const out = (run.stdout || '') + (run.stderr || '');
const num = (label) => Number((out.match(new RegExp(`ℹ ${label} (\\d+)`)) || [])[1] || 0);
const total = num('tests'), pass = num('pass'), fail = num('fail');

const lines = out.split('\n');
const group = (re) => lines.filter((l) => re.test(l) && /[✔✖]/.test(l)).length;
const areas = [
  ['Server-side + client-side validation', /validation|agree|mass-assignment|non-object|normalises|list query/i],
  ['API behaviour (list, filter, paging, apply, errors)', /GET |POST |filters|pagination|empty result|wrong methods|unknown API|static:|invalid query|same email/i],
  ['Security (headers, SQLi, traversal, limits, leaks)', /secure headers|SQL|LIKE|path traversal|malformed|content type|oversized|overlong|rate limit|leak|failure-simulation/i],
  ['Frontend states and CSP-safety (static checks)', /index\.html|loading, error|application form has|app\.js/i],
];

const body = `# Test Report

- **Result:** ${fail === 0 && total > 0 ? 'PASS' : 'FAIL'}
- **Tests run:** ${total}  |  **Passed:** ${pass}  |  **Failed:** ${fail}
- **Generated:** ${new Date().toISOString()}
- **Node:** ${process.version}
- **Command:** \`npm run report\` (runs \`npm test\`)

## What is covered

| Area | Passing checks |
|---|---|
${areas.map(([n, re]) => `| ${n} | ${lines.filter((l) => re.test(l) && l.includes('✔')).length} |`).join('\n')}

> Rows can overlap because a test may match more than one area; the totals above are authoritative.

## Manual browser checks (do these once, ~5 minutes)

These cover what automated tests here cannot (visual states in a real browser).

| # | Step | Expected |
|---|---|---|
| 1 | \`npm start\`, open http://localhost:3000 | Skeleton cards flash, then 6 listings and "Showing 1–6 of 12" |
| 2 | Type \`sql\` in Search | List narrows to matching roles; status line updates |
| 3 | Search \`zzzz\` | "No internships match" panel with Clear filters button |
| 4 | \`npm run demo:failures\`, open http://localhost:3000/?simulate=error | Red "We couldn't load the listings" panel with **Try again** |
| 5 | Open http://localhost:3000/?simulate=flaky | Status says "Retrying (1 of 2)…" then listings load |
| 6 | Open http://localhost:3000/?simulate=slow | Skeleton shows for ~2.5 s before listings appear |
| 7 | Click **Apply**, press **Send application** empty | Inline errors under each field, focus moves to first error |
| 8 | Fill the form correctly and send | "Application sent" confirmation |
| 9 | Apply again with the same email | Inline error: already applied with this email |
| 10 | Send 6 applications within a minute | Banner: too many requests, wait N seconds |

## Raw output

\`\`\`text
${out.trim()}
\`\`\`
`;
fs.writeFileSync(path.join(root, 'TEST_REPORT.md'), body);
console.log(`TEST_REPORT.md written: ${pass}/${total} passed.`);
process.exit(fail === 0 && total > 0 ? 0 : 1);
