(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('filter-form'), qInput = $('q'), modeSel = $('mode');
  const domainBox = $('domain-buttons'), list = $('list');
  const emptyEl = $('empty'), errorEl = $('error'), statusEl = $('status');

  let all = [];
  let domain = 'All';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = (d) => {
    const t = new Date(d);
    return isNaN(t) ? esc(d) : t.toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
  };

  // Reusable card template
  function cardHTML(i) {
    const skills = (i.skills || []).map((s) => `<li>${esc(s)}</li>`).join('');
    return `
      <li>
        <article class="card" tabindex="-1" data-card aria-labelledby="t${i.id}">
          <h3 id="t${i.id}">${esc(i.title)}</h3>
          <p class="company">${esc(i.company)}</p>
          <ul class="meta">
            <li>${esc(i.domain)}</li><li>${esc(i.location)} (${esc(i.mode)})</li>
            <li>${esc(i.duration)}</li><li>${esc(i.stipend)}</li>
          </ul>
          <p class="summary">${esc(i.summary)}</p>
          <ul class="tags" aria-label="Skills">${skills}</ul>
          <p class="meta"><span>Apply by ${fmtDate(i.deadline)}</span></p>
          <button type="button" class="apply" aria-label="Apply to ${esc(i.title)} at ${esc(i.company)}">Apply</button>
        </article>
      </li>`;
  }

  function renderDomains() {
    const domains = ['All', ...new Set(all.map((i) => i.domain))];
    domainBox.innerHTML = domains.map((d) =>
      `<button type="button" class="chip" data-domain="${esc(d)}" aria-pressed="${d === domain}">${esc(d)}</button>`).join('');
  }

  function filtered() {
    const q = qInput.value.trim().toLowerCase();
    const mode = modeSel.value;
    return all.filter((i) => {
      if (domain !== 'All' && i.domain !== domain) return false;
      if (mode && i.mode !== mode) return false;
      if (!q) return true;
      const hay = [i.title, i.company, i.location, i.summary, ...(i.skills || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const items = filtered();
    errorEl.hidden = true;
    list.innerHTML = items.map(cardHTML).join('');
    emptyEl.hidden = items.length > 0;
    list.hidden = items.length === 0;
    statusEl.textContent = items.length
      ? `Showing ${items.length} of ${all.length} internships.` : 'No internships found.';
    setRovingTabindex();
  }

  // Keyboard navigation: one card is tabbable, arrows move between cards
  const cards = () => [...list.querySelectorAll('[data-card]')];
  function setRovingTabindex() {
    cards().forEach((c, n) => c.tabIndex = n === 0 ? 0 : -1);
  }
  function cardCols() {
    const c = cards(); if (c.length < 2) return 1;
    const top = c[0].getBoundingClientRect().top;
    return Math.max(1, c.filter((x) => Math.abs(x.getBoundingClientRect().top - top) < 4).length);
  }
  list.addEventListener('keydown', (e) => {
    const c = cards(); const cur = c.indexOf(e.target.closest('[data-card]'));
    if (cur < 0 || e.target.matches('button')) return;
    const cols = cardCols(); let next = cur;
    switch (e.key) {
      case 'ArrowRight': next = cur + 1; break;
      case 'ArrowLeft': next = cur - 1; break;
      case 'ArrowDown': next = cur + cols; break;
      case 'ArrowUp': next = cur - cols; break;
      case 'Home': next = 0; break;
      case 'End': next = c.length - 1; break;
      default: return;
    }
    e.preventDefault();
    if (next < 0 || next >= c.length) return;
    c.forEach((x) => x.tabIndex = -1);
    c[next].tabIndex = 0; c[next].focus();
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.apply'); if (!b) return;
    statusEl.textContent = `Application started for ${b.closest('article').querySelector('h3').textContent}. (Demo only)`;
  });

  domainBox.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    domain = b.dataset.domain;
    domainBox.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', x === b));
    render();
  });
  qInput.addEventListener('input', render);
  modeSel.addEventListener('change', render);
  form.addEventListener('submit', (e) => { e.preventDefault(); render(); });
  $('clear').addEventListener('click', () => {
    form.reset(); domain = 'All'; renderDomains(); render(); qInput.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.matches('input,select,textarea')) { e.preventDefault(); qInput.focus(); }
  });

  async function load() {
    statusEl.textContent = 'Loading internships…';
    errorEl.hidden = true; emptyEl.hidden = true;
    try {
      const res = await fetch('data/internships.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Unexpected data shape');
      all = data;
      renderDomains(); render();
    } catch (err) {
      list.innerHTML = ''; list.hidden = true;
      errorEl.hidden = false; statusEl.textContent = '';
      $('error-msg').textContent = `Could not load data/internships.json (${err.message}). Run the page from a local server, then try again.`;
    }
  }
  $('retry').addEventListener('click', () => { list.hidden = false; load(); });
  load();
})();
