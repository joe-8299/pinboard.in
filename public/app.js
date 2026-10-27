(function () {
  'use strict';

  // ---------- tiny helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  // Build DOM with textContent only, so API data can never inject markup.
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      if (k === 'class') el.className = props[k];
      else if (k === 'text') el.textContent = props[k];
      else el.setAttribute(k, props[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function sleep(ms, signal) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(resolve, ms);
      if (signal) signal.addEventListener('abort', function () { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); });
    });
  }

  // ---------- API client: timeout + retry with backoff (GET only) ----------
  function ApiError(status, info, retryAfter) {
    this.status = status;
    this.code = info && info.code;
    this.message = (info && info.message) || 'Request failed.';
    this.fields = info && info.fields;
    this.retryAfter = retryAfter || 0;
  }

  async function request(url, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var retries = opts.retries != null ? opts.retries : (method === 'GET' ? 2 : 0); // never auto-retry POST
    var attempt = 0;
    for (;;) {
      var ctrl = new AbortController();
      var timedOut = false;
      var timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, 8000);
      var onAbort = function () { ctrl.abort(); };
      if (opts.signal) opts.signal.addEventListener('abort', onAbort);
      try {
        var res = await fetch(url, {
          method: method,
          headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: ctrl.signal,
        });
        var payload = null;
        try { payload = await res.json(); } catch (e) { /* non-JSON body */ }
        if (res.ok) return payload;
        throw new ApiError(res.status, payload && payload.error, Number(res.headers.get('Retry-After')) || 0);
      } catch (err) {
        if (opts.signal && opts.signal.aborted) throw err; // cancelled on purpose
        if (timedOut) err = Object.assign(new Error('timeout'), { timeout: true });
        var retriable = !(err instanceof ApiError) || err.status >= 500 || err.status === 429;
        if (!retriable || attempt >= retries) throw err;
        attempt += 1;
        if (opts.onRetry) opts.onRetry(attempt, retries);
        await sleep(Math.min((err.retryAfter || 0) * 1000 || 500 * Math.pow(2, attempt - 1), 4000), opts.signal);
      } finally {
        clearTimeout(timer);
        if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      }
    }
  }

  function describeError(err) {
    if (err instanceof ApiError) {
      if (err.status === 429) return 'Too many requests right now. Please wait ' + (err.retryAfter || 30) + ' seconds and try again.';
      if (err.status >= 500) return 'The server had a problem. This is not your fault; please try again.';
      return err.message;
    }
    if (err && err.timeout) return 'The server took too long to answer. Check your connection and try again.';
    return 'We could not reach the server. Check your connection and try again.';
  }

  // ---------- listing state ----------
  var state = { q: '', type: '', location: '', page: 1 };
  var listCtrl = null;
  var items = {}; // id -> internship, used by the apply dialog
  var simulate = new URLSearchParams(location.search).get('simulate'); // only does anything with `npm run demo:failures`

  function show(which) {
    ['loading', 'error', 'empty', 'grid'].forEach(function (id) { $(id).hidden = id !== which; });
    $('loading').setAttribute('aria-hidden', which === 'loading' ? 'false' : 'true');
    if (which !== 'grid') $('pager').hidden = true;
  }

  function fmtDate(iso) {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  var MODE_LABEL = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };

  function card(it) {
    var applyBtn = h('button', { type: 'button', class: 'btn', 'data-id': String(it.id), text: 'Apply' });
    applyBtn.setAttribute('aria-label', 'Apply for ' + it.title + ' at ' + it.company);
    return h('article', { class: 'card' },
      h('p', { class: 'deadline', text: 'Closes ' + fmtDate(it.deadline) }),
      h('h2', { text: it.title }),
      h('p', { class: 'meta', text: it.company + ' · ' + it.location + ' · ' + (MODE_LABEL[it.mode] || it.mode) }),
      h('p', { class: 'desc', text: it.description }),
      h('ul', { class: 'chips', 'aria-label': 'Skills' }, ...it.skills.map(function (s) { return h('li', { text: s }); })),
      h('div', { class: 'card-foot' },
        h('p', { class: 'pay', text: it.stipend + ' · ' + it.durationWeeks + ' weeks' }),
        applyBtn));
  }

  async function loadList() {
    if (listCtrl) listCtrl.abort();
    listCtrl = new AbortController();
    var ctrl = listCtrl;
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.type) params.set('type', state.type);
    if (state.location) params.set('location', state.location);
    params.set('page', String(state.page));
    params.set('pageSize', '6');
    if (simulate) params.set('simulate', simulate);

    show('loading');
    $('status').textContent = 'Loading internships…';
    try {
      var body = await request('/api/internships?' + params, {
        signal: ctrl.signal,
        onRetry: function (n, max) { $('status').textContent = 'Having trouble connecting. Retrying (' + n + ' of ' + max + ')…'; },
      });
      if (ctrl.signal.aborted) return;
      render(body);
    } catch (err) {
      if (ctrl.signal.aborted) return; // a newer search replaced this one
      $('error-message').textContent = describeError(err);
      $('status').textContent = 'Could not load internships.';
      show('error');
      $('retry').focus();
    }
  }

  function render(body) {
    var meta = body.meta;
    var grid = $('grid');
    grid.replaceChildren();
    items = {};
    if (!body.data.length) {
      $('status').textContent = 'No results.';
      show('empty');
      return;
    }
    body.data.forEach(function (it) { items[it.id] = it; grid.appendChild(card(it)); });
    var from = (meta.page - 1) * meta.pageSize + 1;
    $('status').textContent = 'Showing ' + from + '–' + (from + body.data.length - 1) + ' of ' + meta.total + ' internships';
    $('page-info').textContent = 'Page ' + meta.page + ' of ' + meta.totalPages;
    $('prev').disabled = meta.page <= 1;
    $('next').disabled = meta.page >= meta.totalPages;
    show('grid');
    $('pager').hidden = meta.totalPages <= 1;
  }

  // ---------- filters ----------
  var debounce;
  function readFilters() {
    state.q = $('f-q').value.trim();
    state.type = $('f-type').value;
    state.location = $('f-location').value.trim();
    state.page = 1;
  }
  function onFilterInput() { clearTimeout(debounce); debounce = setTimeout(function () { readFilters(); loadList(); }, 300); }
  function clearFilters() {
    $('f-q').value = ''; $('f-type').value = ''; $('f-location').value = '';
    readFilters(); loadList(); $('f-q').focus();
  }
  $('f-q').addEventListener('input', onFilterInput);
  $('f-location').addEventListener('input', onFilterInput);
  $('f-type').addEventListener('change', onFilterInput);
  $('filters').addEventListener('submit', function (e) { e.preventDefault(); });
  $('clear').addEventListener('click', clearFilters);
  $('empty-clear').addEventListener('click', clearFilters);
  $('retry').addEventListener('click', loadList);
  $('prev').addEventListener('click', function () { state.page -= 1; loadList(); $('results').focus(); });
  $('next').addEventListener('click', function () { state.page += 1; loadList(); $('results').focus(); });

  // ---------- apply dialog + form ----------
  var dialog = $('apply-dialog');
  var form = $('apply-form');
  var FIELDS = ['fullName', 'email', 'school', 'coverNote', 'consent'];
  var currentId = null;
  var submitting = false;

  function readForm() {
    return {
      internshipId: currentId,
      fullName: form.fullName.value,
      email: form.email.value,
      school: form.school.value,
      coverNote: form.coverNote.value,
      consent: form.consent.checked,
    };
  }
  function setFieldError(name, msg) {
    var el = form.elements[name];
    $('err-' + name).textContent = msg || '';
    if (el) { if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
  }
  function clearErrors() { FIELDS.forEach(function (f) { setFieldError(f, ''); }); banner(''); }
  function banner(msg) { var b = $('form-banner'); b.textContent = msg; b.hidden = !msg; }
  function showErrors(errors) {
    var first = null;
    FIELDS.forEach(function (f) { setFieldError(f, errors[f]); if (errors[f] && !first) first = f; });
    if (errors._form) banner(errors._form);
    if (first) form.elements[first].focus();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-id]');
    if (!btn) return;
    openDialog(Number(btn.getAttribute('data-id')), btn);
  });

  var opener = null;
  function openDialog(id, from) {
    var it = items[id];
    if (!it) return;
    opener = from;
    currentId = id;
    form.reset();
    clearErrors();
    $('count').textContent = '0 / 1000';
    form.hidden = false; $('success').hidden = true;
    $('dialog-title').textContent = 'Apply: ' + it.title;
    $('dialog-sub').textContent = it.company + ' · ' + it.location;
    setSubmitting(false);
    dialog.showModal();
    form.fullName.focus();
  }
  function closeDialog() { if (submitting) return; dialog.close(); }
  dialog.addEventListener('close', function () { if (opener && document.contains(opener)) opener.focus(); });
  $('dialog-close').addEventListener('click', closeDialog);
  $('cancel').addEventListener('click', closeDialog);
  $('success-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('cancel', function (e) { if (submitting) e.preventDefault(); });

  form.addEventListener('input', function (e) {
    if (e.target === form.coverNote) $('count').textContent = form.coverNote.value.length + ' / 1000';
    if (e.target.name && $('err-' + e.target.name).textContent) validateOne(e.target.name); // clear errors as the user fixes them
  });
  form.addEventListener('focusout', function (e) {
    if (e.target.name && FIELDS.indexOf(e.target.name) !== -1) validateOne(e.target.name);
  });
  function validateOne(name) {
    var r = Validation.validateApplication(readForm());
    setFieldError(name, r.errors[name]);
  }

  function setSubmitting(on) {
    submitting = on;
    var b = $('submit');
    b.disabled = on;
    b.textContent = on ? 'Sending…' : 'Send application';
    form.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (submitting) return;
    clearErrors();
    var r = Validation.validateApplication(readForm()); // 1) client validation
    if (!r.ok) { showErrors(r.errors); return; }

    setSubmitting(true);
    try {
      await request('/api/applications', { method: 'POST', body: r.values }); // 2) server validates again
      form.hidden = true;
      $('success-message').textContent = 'Thanks, ' + r.values.fullName.split(' ')[0] + '. Your application for ' +
        items[currentId].title + ' at ' + items[currentId].company + ' was received.';
      $('success').hidden = false;
      $('success-close').focus();
    } catch (err) {
      if (err instanceof ApiError && err.fields) showErrors(err.fields);
      else if (err instanceof ApiError && err.status === 429) banner(describeError(err));
      else if (err instanceof ApiError && err.status === 404) banner('This internship is no longer available. Close this window and refresh the list.');
      else banner(describeError(err) + ' Your answers are still here; press “Send application” to retry.');
    } finally {
      setSubmitting(false);
    }
  });

  loadList();
})();
