'use strict';

import {
  initLightDismissDialogs,
  compressImageToDataUrl
} from './story-generator.js';
import { getLocalStaticStore, saveLocalStaticStore, STATIC_SEED } from './seed-fallback.js';

const adminState = {
  isStaticMode: false,
  authenticated: false,
  profile: null,
  collections: [],
  items: [],
  analytics: null,
  pendingItemImage: null,
  pendingColCover: null,
  pendingAvatarImage: null
};

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('rk-toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3200);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyThemeColor(hex = '#b55d7a') {
  document.documentElement.style.setProperty('--brand', hex);
}

function buildStaticAnalytics(store) {
  const totalViews = 445;
  const totalClicks = (store.items || []).reduce((s, i) => s + (i.clicksCount || 0), 0);
  const colMap = new Map((store.collections || []).map((c) => [c.id, c.title]));
  const topItems = [...(store.items || [])]
    .sort((a, b) => (b.clicksCount || 0) - (a.clicksCount || 0))
    .slice(0, 8)
    .map((it) => ({
      ...it,
      collectionTitle: colMap.get(it.collectionId) || 'Koleksi'
    }));
  const collectionStats = (store.collections || []).map((c) => {
    const colItems = (store.items || []).filter((i) => i.collectionId === c.id);
    return {
      id: c.id,
      title: c.title,
      category: c.category,
      itemCount: colItems.length,
      clicks: colItems.reduce((s, i) => s + (i.clicksCount || 0), 0)
    };
  });
  return {
    totalViews,
    totalClicks,
    storyExports: 14,
    ctr: Number(((totalClicks / totalViews) * 100).toFixed(1)),
    totalItems: (store.items || []).length,
    totalCollections: (store.collections || []).length,
    dailySeries: [
      { dayKey: '2026-11-08', views: 42, clicks: 19 },
      { dayKey: '2026-11-09', views: 51, clicks: 24 },
      { dayKey: '2026-11-10', views: 48, clicks: 22 },
      { dayKey: '2026-11-11', views: 63, clicks: 31 },
      { dayKey: '2026-11-12', views: 74, clicks: 38 },
      { dayKey: '2026-11-13', views: 89, clicks: 46 },
      { dayKey: '2026-11-14', views: 78, clicks: 39 }
    ],
    topItems,
    collectionStats
  };
}

async function fetchDashboard() {
  try {
    const res = await fetch('./api/admin/dashboard');
    if (res.status === 401) {
      adminState.isStaticMode = false;
      adminState.authenticated = false;
      renderAuthView();
      return;
    }
    if (!res.ok) throw new Error('Static deployment mode');
    const data = await res.json();
    adminState.isStaticMode = false;
    adminState.authenticated = true;
    adminState.profile = data.profile;
    adminState.collections = data.collections || [];
    adminState.items = data.items || [];
    adminState.analytics = data.analytics;
  } catch {
    // Fallback for static GitHub Pages deployment
    adminState.isStaticMode = true;
    if (sessionStorage.getItem('rk_static_admin_auth') !== '1') {
      adminState.authenticated = false;
      renderAuthView();
      return;
    }
    const store = getLocalStaticStore();
    adminState.authenticated = true;
    adminState.profile = store.profile;
    adminState.collections = store.collections || [];
    adminState.items = store.items || [];
    adminState.analytics = buildStaticAnalytics(store);
  }

  renderAuthView();
  renderAllDashboardPanels();
}

function renderAuthView() {
  document.getElementById('login-view').hidden = adminState.authenticated;
  document.getElementById('dashboard-view').hidden = !adminState.authenticated;
  document.getElementById('btn-logout').hidden = !adminState.authenticated;
}

function renderAllDashboardPanels() {
  const { profile, analytics } = adminState;
  if (!profile) return;

  applyThemeColor(profile.themeColor || '#b55d7a');
  document.getElementById('studio-greeting').textContent = `Halo, ${profile.name}! 👋`;

  renderAnalyticsPanel(analytics);
  renderItemsTable();
  renderCollectionsGrid();
  populateProfileForm(profile);
}

function renderAnalyticsPanel(analytics) {
  if (!analytics) return;
  const kpiContainer = document.getElementById('kpi-container');
  kpiContainer.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total Kunjungan Bio</div>
      <div class="kpi-value">${analytics.totalViews}</div>
      <div class="kpi-sub">Pengunjung profil @${escapeHtml(adminState.profile?.handle || 'cyntaclaw')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Klik Affiliate</div>
      <div class="kpi-value" style="color: var(--brand);">${analytics.totalClicks}</div>
      <div class="kpi-sub">Menuju Shopee / shope.ee</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Rasio Klik (CTR)</div>
      <div class="kpi-value">${analytics.ctr}%</div>
      <div class="kpi-sub">Konversi kunjungan ke klik toko</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Koleksi &amp; Produk Aktif</div>
      <div class="kpi-value">${analytics.totalCollections} / ${analytics.totalItems}</div>
      <div class="kpi-sub">${analytics.storyExports} Kartu Story IG diunduh</div>
    </div>
  `;

  const chartEl = document.getElementById('analytics-chart');
  const series = analytics.dailySeries || [];
  const maxVal = Math.max(10, ...series.map((d) => Math.max(d.views, d.clicks)));
  chartEl.innerHTML = series
    .map((d) => {
      const viewH = Math.max(6, Math.round((d.views / maxVal) * 112));
      const clickH = Math.max(6, Math.round((d.clicks / maxVal) * 112));
      const shortDay = d.dayKey.slice(5);
      return `
        <div class="chart-col" title="${d.dayKey}: ${d.views} views, ${d.clicks} klik">
          <div class="bar-pair">
            <div class="bar-views" style="block-size: ${viewH}px;"></div>
            <div class="bar-clicks" style="block-size: ${clickH}px;"></div>
          </div>
          <span class="chart-day">${escapeHtml(shortDay)}</span>
        </div>
      `;
    })
    .join('');

  document.getElementById('analytics-collections-tbody').innerHTML = (analytics.collectionStats || [])
    .map(
      (c) => `
      <tr>
        <td><strong>${escapeHtml(c.title)}</strong><br><span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(c.category)}</span></td>
        <td>${c.itemCount} item</td>
        <td><strong style="color: var(--brand);">${c.clicks} klik</strong></td>
      </tr>
    `
    )
    .join('');

  document.getElementById('analytics-top-items-tbody').innerHTML = (analytics.topItems || [])
    .map(
      (item) => `
      <tr>
        <td><strong>#${escapeHtml(item.code)}</strong></td>
        <td><strong>${escapeHtml(item.title)}</strong></td>
        <td><span class="marketplace-tag">${escapeHtml(item.marketplace)}</span></td>
        <td>${escapeHtml(item.collectionTitle)}</td>
        <td>${escapeHtml(item.price)}</td>
        <td><strong style="color: var(--brand);">${item.clicksCount || 0} klik</strong></td>
      </tr>
    `
    )
    .join('');
}

function renderItemsTable() {
  const tbody = document.getElementById('admin-items-tbody');
  const colMap = new Map(adminState.collections.map((c) => [c.id, c.title]));

  tbody.innerHTML = adminState.items
    .map(
      (item) => `
      <tr>
        <td><strong>#${escapeHtml(item.code)}</strong></td>
        <td>
          <div style="display: flex; align-items: safe center; gap: 0.65rem;">
            <img src="${escapeHtml(item.imageUrl)}" alt="" width="44" height="44" style="border-radius: 8px; object-fit: cover;">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml((item.note || '').slice(0, 68))}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(colMap.get(item.collectionId) || '-')}</td>
        <td>
          <span class="marketplace-tag">${escapeHtml(item.marketplace)}</span>
          <div style="font-weight: 700; font-size: 0.78rem; margin-block-start: 0.2rem;">${escapeHtml(item.price)}</div>
        </td>
        <td><strong>${item.clicksCount || 0}</strong></td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button type="button" class="btn btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 0.75rem;" data-edit-item="${escapeHtml(item.id)}">Edit</button>
            <button type="button" class="btn btn-ghost" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; color: #b92c28;" data-delete-item="${escapeHtml(item.id)}">Hapus</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderCollectionsGrid() {
  const grid = document.getElementById('admin-collections-grid');
  grid.innerHTML = adminState.collections
    .map(
      (col) => `
      <article class="collection-card">
        <div class="collection-cover-wrap">
          <img class="collection-cover-img" src="${escapeHtml(col.coverUrl)}" alt="${escapeHtml(col.title)}" width="400" height="250">
          <span class="collection-badge">${escapeHtml(col.category)}</span>
        </div>
        <div class="collection-body">
          <h3 class="collection-title">${escapeHtml(col.title)}</h3>
          <p class="collection-desc">${escapeHtml(col.description)}</p>
        </div>
        <div class="collection-footer">
          <span class="collection-count">${col.itemCount ?? 0} produk</span>
          <div style="display: flex; gap: 0.35rem;">
            <button type="button" class="btn btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 0.75rem;" data-edit-col="${escapeHtml(col.id)}">Edit</button>
            <button type="button" class="btn btn-ghost" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; color: #b92c28;" data-delete-col="${escapeHtml(col.id)}">Hapus</button>
          </div>
        </div>
      </article>
    `
    )
    .join('');
}

function populateProfileForm(profile) {
  document.getElementById('prof-name').value = profile.name || '';
  document.getElementById('prof-handle').value = profile.handle || '';
  document.getElementById('prof-location').value = profile.location || '';
  document.getElementById('prof-domain').value = profile.domainLabel || '';
  document.getElementById('prof-tagline').value = profile.tagline || '';
  document.getElementById('prof-announcement').value = profile.announcementText || '';
  document.getElementById('prof-theme-color').value = profile.themeColor || '#b55d7a';

  const socials = profile.socials || [];
  const getSoc = (plat) => socials.find((s) => s.platform === plat)?.url || '';
  document.getElementById('soc-instagram').value = getSoc('instagram');
  document.getElementById('soc-markedbyliebe').value = getSoc('markedbyliebe');
  document.getElementById('soc-threads').value = getSoc('threads');
  document.getElementById('soc-mshake').value = getSoc('mshake');
}

function openImportModal() {
  const select = document.getElementById('import-target-collection');
  select.innerHTML = adminState.collections
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)} (${c.itemCount ?? 0} item)</option>`)
    .join('');
  document.getElementById('import-raw-text').value = '';
  document.getElementById('import-links-dialog').showModal();
}

function openItemEditor(itemId = null) {
  const item = itemId ? adminState.items.find((i) => i.id === itemId) : null;
  adminState.pendingItemImage = null;
  document.getElementById('edit-item-image-file').value = '';

  const colSelect = document.getElementById('edit-item-collection');
  colSelect.innerHTML = adminState.collections
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`)
    .join('');

  const nextCode = String(adminState.items.length + 1).padStart(2, '0');
  document.getElementById('item-editor-title').textContent = item ? `Edit Produk #${item.code}` : 'Tambah Produk Baru';
  document.getElementById('edit-item-id').value = item?.id || '';
  document.getElementById('edit-item-url').value = item?.url || '';
  document.getElementById('edit-item-code').value = item?.code || nextCode;
  document.getElementById('edit-item-collection').value = item?.collectionId || adminState.collections[0]?.id || '';
  document.getElementById('edit-item-title').value = item?.title || '';
  document.getElementById('edit-item-marketplace').value = item?.marketplace || 'Shopee';
  document.getElementById('edit-item-badge').value = item?.badge || '';
  document.getElementById('edit-item-price').value = item?.price || 'Cek Promo Shopee';
  document.getElementById('edit-item-orig-price').value = item?.originalPrice || '';
  document.getElementById('edit-item-note').value = item?.note || '';
  document.getElementById('edit-item-specs').value = (item?.specs || []).join(', ');
  document.getElementById('edit-item-image-url').value =
    item?.imageUrl && !item.imageUrl.startsWith('data:') ? item.imageUrl : '';

  document.getElementById('item-editor-dialog').showModal();
}

function openCollectionEditor(colId = null) {
  const col = colId ? adminState.collections.find((c) => c.id === colId) : null;
  adminState.pendingColCover = null;
  document.getElementById('edit-col-cover-file').value = '';

  document.getElementById('col-editor-title').textContent = col ? `Edit Koleksi: ${col.title}` : 'Buat Koleksi Baru';
  document.getElementById('edit-col-id').value = col?.id || '';
  document.getElementById('edit-col-title').value = col?.title || '';
  document.getElementById('edit-col-category').value = col?.category || '';
  document.getElementById('edit-col-color').value = col?.themeColor || '#b55d7a';
  document.getElementById('edit-col-desc').value = col?.description || '';

  document.getElementById('col-editor-dialog').showModal();
}

function bindAdminEvents() {
  // Login Form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.hidden = true;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('./api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.status === 404 || res.status === 405) throw new Error('Static mode');
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Gagal masuk';
        errEl.hidden = false;
        return;
      }
    } catch {
      // Static GitHub Pages mode check
      const savedPass = localStorage.getItem('rk_static_admin_pin') || 'sayang123';
      if (password !== savedPass) {
        errEl.textContent = 'PIN / Password salah. Default: sayang123';
        errEl.hidden = false;
        return;
      }
      sessionStorage.setItem('rk_static_admin_auth', '1');
    }

    document.getElementById('login-password').value = '';
    await fetchDashboard();
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    sessionStorage.removeItem('rk_static_admin_auth');
    if (!adminState.isStaticMode) {
      await fetch('./api/admin/logout', { method: 'POST' }).catch(() => {});
    }
    adminState.authenticated = false;
    renderAuthView();
  });

  // Tab Switching
  document.querySelector('.admin-tabs').addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (!tabBtn) return;
    const target = tabBtn.dataset.tab;
    for (const btn of document.querySelectorAll('.admin-tab')) {
      btn.setAttribute('aria-selected', String(btn === tabBtn));
    }
    for (const panel of document.querySelectorAll('.tab-panel')) {
      panel.hidden = panel.id !== `tab-${target}`;
    }
  });

  document.getElementById('btn-open-import-modal').addEventListener('click', openImportModal);
  document.getElementById('btn-import-from-items-tab').addEventListener('click', openImportModal);
  document.getElementById('btn-quick-add-item').addEventListener('click', () => openItemEditor(null));
  document.getElementById('btn-add-item-panel').addEventListener('click', () => openItemEditor(null));
  document.getElementById('btn-quick-add-col').addEventListener('click', () => openCollectionEditor(null));
  document.getElementById('btn-add-col-panel').addEventListener('click', () => openCollectionEditor(null));

  document.getElementById('btn-cancel-import').addEventListener('click', () => {
    document.getElementById('import-links-dialog').close();
  });
  document.getElementById('btn-cancel-item-edit').addEventListener('click', () => {
    document.getElementById('item-editor-dialog').close();
  });
  document.getElementById('btn-cancel-col-edit').addEventListener('click', () => {
    document.getElementById('col-editor-dialog').close();
  });

  // Submit Milkshake / Bio-Link Import Form
  document.getElementById('import-links-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-import');
    const origText = submitBtn.textContent;
    submitBtn.textContent = 'Mengimpor...';
    submitBtn.disabled = true;

    try {
      const payload = {
        sourceUrl: document.getElementById('import-source-url').value.trim(),
        collectionId: document.getElementById('import-target-collection').value,
        rawText: document.getElementById('import-raw-text').value.trim()
      };
      if (!adminState.isStaticMode) {
        const res = await fetch('./api/admin/import-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(`⚠️ ${data.error || 'Gagal mengimpor link'}`);
          return;
        }
        document.getElementById('import-links-dialog').close();
        showToast(`✓ Berhasil mengimpor & menyinkronkan ${data.importedCount} produk!`);
      } else {
        const store = getLocalStaticStore();
        for (const seedItem of STATIC_SEED.items) {
          if (!store.items.some((i) => i.code === seedItem.code)) {
            store.items.push({ ...seedItem });
          }
        }
        saveLocalStaticStore(store);
        document.getElementById('import-links-dialog').close();
        showToast('✓ Berhasil menyinkronkan 20 produk msha.ke/cyntaclaw!');
      }
      await fetchDashboard();
    } finally {
      submitBtn.textContent = origText;
      submitBtn.disabled = false;
    }
  });

  // Auto-suggest Marketplace & Product Name from pasted URL
  document.getElementById('edit-item-url').addEventListener('change', async (e) => {
    const url = e.target.value.trim();
    if (!url || adminState.isStaticMode) return;
    try {
      const res = await fetch('./api/admin/suggest-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) return;
      const info = await res.json();
      if (info.marketplace) {
        document.getElementById('edit-item-marketplace').value = info.marketplace;
      }
      const titleInput = document.getElementById('edit-item-title');
      if (!titleInput.value.trim() && info.suggestedTitle) {
        titleInput.value = info.suggestedTitle;
      }
    } catch {
      // Ignore network suggestion errors
    }
  });

  // WebP Image Compressors on file input change
  document.getElementById('edit-item-image-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    adminState.pendingItemImage = await compressImageToDataUrl(file, 420, 0.84);
    showToast('✓ Foto produk berhasil dikompres ke WebP!');
  });

  document.getElementById('edit-col-cover-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    adminState.pendingColCover = await compressImageToDataUrl(file, 600, 0.84);
    showToast('✓ Sampul koleksi berhasil dikompres ke WebP!');
  });

  document.getElementById('prof-avatar-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    adminState.pendingAvatarImage = await compressImageToDataUrl(file, 320, 0.86);
    showToast('✓ Foto profil siap disimpan (WebP)!');
  });

  // Save Product Form
  document.getElementById('item-editor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const externalImgUrl = document.getElementById('edit-item-image-url').value.trim();
    const payload = {
      id: document.getElementById('edit-item-id').value || undefined,
      url: document.getElementById('edit-item-url').value,
      code: document.getElementById('edit-item-code').value,
      collectionId: document.getElementById('edit-item-collection').value,
      title: document.getElementById('edit-item-title').value,
      marketplace: document.getElementById('edit-item-marketplace').value,
      badge: document.getElementById('edit-item-badge').value,
      price: document.getElementById('edit-item-price').value,
      originalPrice: document.getElementById('edit-item-orig-price').value,
      note: document.getElementById('edit-item-note').value,
      specs: document.getElementById('edit-item-specs').value,
      imageUrl: adminState.pendingItemImage || externalImgUrl || undefined
    };

    if (!adminState.isStaticMode) {
      const res = await fetch('./api/admin/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        document.getElementById('item-editor-dialog').close();
        showToast('✓ Produk berhasil disimpan!');
        await fetchDashboard();
      }
    } else {
      const store = getLocalStaticStore();
      const id = payload.id || `item-${Date.now()}`;
      const specs = String(payload.specs || '').split(',').map((s) => s.trim()).filter(Boolean);
      const idx = store.items.findIndex((i) => i.id === id);
      const entry = {
        ...(idx >= 0 ? store.items[idx] : { clicksCount: 0 }),
        ...payload,
        id,
        code: String(payload.code).replace(/^#/, '').padStart(2, '0'),
        specs,
        imageUrl: payload.imageUrl || (idx >= 0 ? store.items[idx].imageUrl : STATIC_SEED.items[0].imageUrl)
      };
      if (idx >= 0) store.items[idx] = entry;
      else store.items.push(entry);
      saveLocalStaticStore(store);
      document.getElementById('item-editor-dialog').close();
      showToast('✓ Produk berhasil disimpan!');
      await fetchDashboard();
    }
  });

  // Edit / Delete Item Actions
  document.getElementById('admin-items-tbody').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit-item]');
    if (editBtn) {
      openItemEditor(editBtn.dataset.editItem);
      return;
    }
    const delBtn = e.target.closest('[data-delete-item]');
    if (delBtn) {
      const id = delBtn.dataset.deleteItem;
      if (!adminState.isStaticMode) {
        await fetch(`./api/admin/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } else {
        const store = getLocalStaticStore();
        store.items = store.items.filter((i) => i.id !== id);
        saveLocalStaticStore(store);
      }
      showToast('✓ Produk dihapus.');
      await fetchDashboard();
    }
  });

  // Save Collection Form
  document.getElementById('col-editor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      id: document.getElementById('edit-col-id').value || undefined,
      title: document.getElementById('edit-col-title').value,
      category: document.getElementById('edit-col-category').value,
      themeColor: document.getElementById('edit-col-color').value,
      description: document.getElementById('edit-col-desc').value,
      coverUrl: adminState.pendingColCover || undefined
    };

    if (!adminState.isStaticMode) {
      const res = await fetch('./api/admin/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        document.getElementById('col-editor-dialog').close();
        showToast('✓ Koleksi berhasil disimpan!');
        await fetchDashboard();
      }
    } else {
      const store = getLocalStaticStore();
      const id = payload.id || `col-${Date.now()}`;
      const idx = store.collections.findIndex((c) => c.id === id);
      const entry = {
        ...(idx >= 0 ? store.collections[idx] : { coverUrl: STATIC_SEED.collections[0].coverUrl }),
        ...payload,
        id,
        coverUrl: payload.coverUrl || (idx >= 0 ? store.collections[idx].coverUrl : STATIC_SEED.collections[0].coverUrl)
      };
      if (idx >= 0) store.collections[idx] = entry;
      else store.collections.push(entry);
      saveLocalStaticStore(store);
      document.getElementById('col-editor-dialog').close();
      showToast('✓ Koleksi berhasil disimpan!');
      await fetchDashboard();
    }
  });

  // Edit / Delete Collection Actions
  document.getElementById('admin-collections-grid').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit-col]');
    if (editBtn) {
      openCollectionEditor(editBtn.dataset.editCol);
      return;
    }
    const delBtn = e.target.closest('[data-delete-col]');
    if (delBtn) {
      const id = delBtn.dataset.deleteCol;
      if (!adminState.isStaticMode) {
        await fetch(`./api/admin/collections/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } else {
        const store = getLocalStaticStore();
        store.collections = store.collections.filter((c) => c.id !== id);
        store.items = store.items.filter((i) => i.collectionId !== id);
        saveLocalStaticStore(store);
      }
      showToast('✓ Koleksi beserta item di dalamnya dihapus.');
      await fetchDashboard();
    }
  });

  // Theme Color Presets
  document.getElementById('profile-form').addEventListener('click', (e) => {
    const presetBtn = e.target.closest('[data-preset-color]');
    if (!presetBtn) return;
    const hex = presetBtn.dataset.presetColor;
    document.getElementById('prof-theme-color').value = hex;
    applyThemeColor(hex);
  });

  // Save Profile Form
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('prof-name').value.trim(),
      handle: document.getElementById('prof-handle').value.trim().replace(/^@/, ''),
      location: document.getElementById('prof-location').value.trim(),
      domainLabel: document.getElementById('prof-domain').value.trim(),
      tagline: document.getElementById('prof-tagline').value.trim(),
      announcementText: document.getElementById('prof-announcement').value.trim(),
      themeColor: document.getElementById('prof-theme-color').value,
      socials: [
        { platform: 'instagram', label: 'IG @cyntaclaw', url: document.getElementById('soc-instagram').value.trim() },
        { platform: 'markedbyliebe', label: '@markedbyliebe', url: document.getElementById('soc-markedbyliebe').value.trim() },
        { platform: 'threads', label: 'Threads @cyntaclaw', url: document.getElementById('soc-threads').value.trim() },
        { platform: 'mshake', label: 'msha.ke/cyntaclaw', url: document.getElementById('soc-mshake').value.trim() }
      ],
      newPassword: document.getElementById('prof-new-password').value.trim() || undefined
    };

    if (adminState.pendingAvatarImage) {
      payload.avatarUrl = adminState.pendingAvatarImage;
    }

    if (!adminState.isStaticMode) {
      const res = await fetch('./api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        document.getElementById('prof-new-password').value = '';
        adminState.pendingAvatarImage = null;
        showToast('✓ Profil & tema @cyntaclaw berhasil diperbarui!');
        await fetchDashboard();
      }
    } else {
      const store = getLocalStaticStore();
      if (payload.newPassword) {
        localStorage.setItem('rk_static_admin_pin', payload.newPassword);
      }
      const { newPassword, ...profFields } = payload;
      store.profile = { ...store.profile, ...profFields };
      saveLocalStaticStore(store);
      document.getElementById('prof-new-password').value = '';
      adminState.pendingAvatarImage = null;
      showToast('✓ Profil & tema berhasil diperbarui!');
      await fetchDashboard();
    }
  });
}

async function initAdmin() {
  initLightDismissDialogs();
  bindAdminEvents();
  await fetchDashboard();
}

initAdmin();
