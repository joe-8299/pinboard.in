# Internship Board

A responsive, accessible internship board built with semantic HTML, CSS and vanilla JavaScript.

**Live preview:** _add your deployed URL here_

## Features
- Reusable card template rendered from `data/internships.json`
- Search (title, company, location, skills) + work-mode select + domain filter chips
- Empty state (with "Clear filters") and error state (with "Try again")
- Keyboard support: skip link, `/` focuses search, arrow keys / Home / End move between cards, visible focus
- Labelled form controls, `aria-live` result count, `aria-pressed` filter buttons
- Responsive 1 → 2 → 3 column grid, dark mode, reduced-motion support

## Run locally
`fetch()` does not work from `file://`, so use a local server:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Test the states
- **Empty:** search for `zzzz`
- **Error:** rename `data/internships.json` temporarily and reload
- **Keyboard:** Tab to the first card, then use arrow keys

## Screenshots
Add to `screenshots/` and link here:
![Desktop](screenshots/desktop.png)
![Mobile](screenshots/mobile.png)
![Empty state](screenshots/empty.png)

## Structure
```
index.html  styles.css  app.js  data/internships.json  README.md
```
