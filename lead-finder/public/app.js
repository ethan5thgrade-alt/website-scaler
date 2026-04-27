const $ = (id) => document.getElementById(id);

let currentSearchId = null;
let currentLeads = [];

async function api(path, opts = {}) {
  const resp = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

async function init() {
  const me = await api('/api/auth/me');
  if (!me.data.user) { location.href = '/login'; return; }
  $('user-email').textContent = me.data.user.email;

  if (!me.data.user.subscription_active) {
    $('paywall').style.display = 'block';
  }

  const types = await api('/api/business-types');
  const sel = $('businessType');
  for (const t of types.data.types) {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    sel.appendChild(opt);
  }

  await loadHistory();

  // Auto-refresh user state if returning from Stripe success.
  if (new URLSearchParams(location.search).get('checkout') === 'success') {
    setTimeout(async () => {
      const m = await api('/api/auth/me');
      if (m.data.user?.subscription_active) $('paywall').style.display = 'none';
    }, 2500);
  }
}

async function loadHistory() {
  const { data } = await api('/api/searches');
  const el = $('history');
  if (!data.searches?.length) {
    el.textContent = 'None yet.';
    return;
  }
  el.innerHTML = '';
  for (const s of data.searches.slice(0, 10)) {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = `${s.business_type} · ${s.zip} (${s.result_count})`;
    a.style.display = 'block';
    a.style.padding = '4px 0';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      loadSearch(s.id);
    });
    el.appendChild(a);
  }
}

async function loadSearch(id) {
  const { ok, data } = await api(`/api/searches/${id}`);
  if (!ok) return;
  currentSearchId = id;
  currentLeads = data.leads;
  renderResults(data.search, data.leads);
}

function renderResults(search, leads) {
  $('results-title').textContent = `${leads.length} leads — ${search.business_type} · ${search.zip}`;
  $('results-meta').textContent = leads.length
    ? 'Filtered to operational businesses with no real website, ≥3 reviews, ≥3.0 stars, and a phone number.'
    : 'No leads matched. Try a different ZIP or business type.';

  const csv = $('csv-link');
  csv.href = `/api/searches/${search.id}/csv`;
  csv.style.display = leads.length ? 'inline-block' : 'none';

  const wrap = $('results');
  wrap.innerHTML = '';
  for (const l of leads) {
    wrap.appendChild(renderLead(l));
  }
}

function renderLead(l) {
  const div = document.createElement('div');
  div.className = 'lead';
  div.innerHTML = `
    <h4>${escapeHtml(l.name)}</h4>
    <div>
      <span class="tag no-site">no website</span>
      ${l.social_link ? '<span class="tag social">social-only</span>' : ''}
      ${l.category ? `<span class="tag">${escapeHtml(l.category)}</span>` : ''}
    </div>
    <div class="meta">${escapeHtml(l.address || '')}</div>
    <div class="meta">${l.rating ? l.rating + '★' : ''}${l.review_count ? ' · ' + l.review_count + ' reviews' : ''}</div>
    <div class="contact">
      ${l.phone ? `<span>📞 <a href="tel:${escapeAttr(l.phone)}">${escapeHtml(l.phone)}</a></span>` : ''}
      ${l.email ? `<span>✉ <a href="mailto:${escapeAttr(l.email)}">${escapeHtml(l.email)}</a></span>` : '<span class="muted">no email found</span>'}
      ${l.google_maps_uri ? `<span><a href="${escapeAttr(l.google_maps_uri)}" target="_blank" rel="noopener">Google Maps</a></span>` : ''}
    </div>
    <div class="actions">
      <button class="btn small" data-pitch="${l.id}">✨ Generate pitch email</button>
    </div>
  `;
  div.querySelector('[data-pitch]').addEventListener('click', () => openPitch(l));
  return div;
}

async function openPitch(lead) {
  $('pitch-title').textContent = 'Pitch email';
  $('pitch-for').textContent = `For ${lead.name} — generating...`;
  $('pitch-subject').value = '';
  $('pitch-body').value = '';
  $('pitch-modal').classList.add('open');

  const { ok, data } = await api(`/api/leads/${lead.id}/pitch`, {
    method: 'POST',
    body: JSON.stringify({ sender: {} }),
  });
  if (!ok) {
    $('pitch-for').textContent = 'Could not generate. ' + (data.error || '');
    return;
  }
  $('pitch-for').textContent = `For ${lead.name}`;
  $('pitch-subject').value = data.pitch.subject || '';
  $('pitch-body').value = data.pitch.body || '';

  $('pitch-mailto').onclick = () => {
    const to = lead.email || '';
    const subject = encodeURIComponent($('pitch-subject').value);
    const body = encodeURIComponent($('pitch-body').value);
    location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };
}

$('pitch-close').addEventListener('click', () => $('pitch-modal').classList.remove('open'));
$('pitch-copy').addEventListener('click', async () => {
  const text = `Subject: ${$('pitch-subject').value}\n\n${$('pitch-body').value}`;
  await navigator.clipboard.writeText(text);
  $('pitch-copy').textContent = 'Copied!';
  setTimeout(() => ($('pitch-copy').textContent = 'Copy'), 1500);
});

$('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('search-error').style.display = 'none';
  const zip = $('zip').value.trim();
  const businessType = $('businessType').value;
  $('search-btn').disabled = true;
  $('search-btn').textContent = 'Searching...';
  $('results-title').textContent = `Searching ${businessType} in ${zip}...`;
  $('results-meta').textContent = '';
  $('results').innerHTML = '';
  try {
    const { ok, status, data } = await api('/api/search', {
      method: 'POST',
      body: JSON.stringify({ zip, businessType }),
    });
    if (!ok) {
      if (status === 402) $('paywall').style.display = 'block';
      throw new Error(data.error || 'Search failed');
    }
    currentSearchId = data.searchId;
    currentLeads = data.leads;
    renderResults({ id: data.searchId, business_type: businessType, zip }, data.leads);
    await loadHistory();
  } catch (err) {
    $('search-error').textContent = err.message;
    $('search-error').style.display = 'block';
    $('results-title').textContent = 'Your leads will appear here.';
  } finally {
    $('search-btn').disabled = false;
    $('search-btn').textContent = 'Find leads';
  }
});

$('subscribe-btn').addEventListener('click', async () => {
  $('subscribe-error').style.display = 'none';
  const { ok, data } = await api('/api/billing/checkout', { method: 'POST' });
  if (!ok) {
    $('subscribe-error').textContent = data.error || 'Could not start checkout';
    $('subscribe-error').style.display = 'block';
    return;
  }
  location.href = data.url;
});

$('manage-billing').addEventListener('click', async (e) => {
  e.preventDefault();
  const { ok, data } = await api('/api/billing/portal', { method: 'POST' });
  if (ok && data.url) location.href = data.url;
  else alert(data.error || 'Billing not configured');
});

$('logout').addEventListener('click', async (e) => {
  e.preventDefault();
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/';
});

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }

init();
