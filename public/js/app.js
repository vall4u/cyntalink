'use strict';

import {
  initLightDismissDialogs,
  copyTextWithFallback,
  renderStoryCanvas,
  canvasToPngBlob
} from './story-generator.js';
import { getLocalStaticStore, saveLocalStaticStore } from './seed-fallback.js';

const state = {
  isStaticMode: false,
  profile: null,
  collections: [],
  items: [],
  selectedCollectionId: 'all',
  searchQuery: '',
  activeStoryCollectionId: null,
  activeStoryTemplate: 'foto',
  activeDetailItem: null
};

let toastTimer = null;
function showToast(message) {
  const el = document.getElementById('rk-toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getItemHref(item) {
  if (state.isStaticMode) {
    return item.url || '#';
  }
  return `./r/${encodeURIComponent(item.id)}`;
}

function applyThemeColor(hex = '#b55d7a') {
  document.documentElement.style.setProperty('--brand', hex);
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    document.documentElement.style.setProperty('--brand-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);
    document.documentElement.style.setProperty('--brand-border', `rgba(${r}, ${g}, ${b}, 0.3)`);
  }
}

function renderProfile() {
  const { profile, collections, items } = state;
  if (!profile) return;

  document.title = `Spill the 🍵 • @${profile.handle} — Recommendations Products`;
  if (profile.themeColor) applyThemeColor(profile.themeColor);

  const announcementBar = document.getElementById('announcement-bar');
  if (profile.announcementText) {
    announcementBar.textContent = profile.announcementText;
    announcementBar.hidden = false;
  } else {
    announcementBar.hidden = true;
  }

  document.getElementById('nav-domain-label').textContent =
    profile.domainLabel || `${profile.handle}.rekomin.bio`;
  const avatarEl = document.getElementById('profile-avatar');
  if (profile.avatarUrl) avatarEl.src = profile.avatarUrl;
  avatarEl.alt = `Foto profil ${profile.name}`;

  document.getElementById('profile-verified').hidden = !profile.verified;
  document.getElementById('profile-name').textContent = profile.name;
  document.getElementById('profile-handle').textContent =
    `@${profile.handle}${profile.location ? ` • ${profile.location}` : ''}`;
  document.getElementById('profile-tagline').textContent = profile.tagline || '';

  document.getElementById('stat-collections-count').textContent = String(collections.length);
  document.getElementById('stat-items-count').textContent = String(items.length);

  const socialsList = document.getElementById('social-links-list');
  socialsList.innerHTML = (profile.socials || [])
    .filter((s) => s.url)
    .map(
      (s) => `
      <li>
        <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" class="social-pill">
          <span>${escapeHtml(s.label || s.platform)}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </li>
    `
    )
    .join('');
}

function renderCategoryPills() {
  const bar = document.getElementById('category-pills-bar');
  const allBtn = `
    <button type="button" class="cat-pill" data-col-id="all" aria-pressed="${state.selectedCollectionId === 'all'}">
      Semua (${state.items.length})
    </button>
  `;
  const colBtns = state.collections
    .map(
      (col) => `
      <button type="button" class="cat-pill" data-col-id="${escapeHtml(col.id)}" aria-pressed="${state.selectedCollectionId === col.id}">
        ${escapeHtml(col.category || col.title)} (${col.itemCount ?? 0})
      </button>
    `
    )
    .join('');

  bar.innerHTML = allBtn + colBtns;
}

function renderCollections() {
  const grid = document.getElementById('collections-grid');
  if (!state.collections.length) {
    grid.innerHTML = '<div class="empty-state">Belum ada koleksi yang ditambahkan.</div>';
    return;
  }

  grid.innerHTML = state.collections
    .map((col) => {
      const isActive = state.selectedCollectionId === col.id;
      return `
        <article class="collection-card ${isActive ? 'is-active' : ''}" data-collection-card="${escapeHtml(col.id)}">
          <div class="collection-cover-wrap">
            <img
              class="collection-cover-img"
              src="${escapeHtml(col.coverUrl)}"
              alt="Sampul koleksi ${escapeHtml(col.title)}"
              width="400"
              height="250"
              loading="lazy"
            >
            <span class="collection-badge">${escapeHtml(col.category)}</span>
          </div>
          <div class="collection-body">
            <h3 class="collection-title">${escapeHtml(col.title)}</h3>
            <p class="collection-desc">${escapeHtml(col.description)}</p>
          </div>
          <div class="collection-footer">
            <button type="button" class="btn btn-ghost" style="padding: 0.3rem 0.65rem; font-size: 0.76rem;" data-filter-col="${escapeHtml(col.id)}">
              ${isActive ? '✓ Sedang Difilter' : `Lihat ${col.itemCount ?? 0} Produk`}
            </button>
            <button type="button" class="story-trigger-btn" data-story-col="${escapeHtml(col.id)}" aria-label="Buat Kartu Story untuk ${escapeHtml(col.title)}">
              ✨ Story IG
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

function getFilteredItems() {
  const q = state.searchQuery.trim().toLowerCase().replace(/^#/, '');
  return state.items.filter((item) => {
    if (state.selectedCollectionId !== 'all' && item.collectionId !== state.selectedCollectionId) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      item.code,
      `#${item.code}`,
      String(parseInt(item.code, 10)),
      item.title,
      item.marketplace,
      item.badge,
      item.note,
      ...(item.specs || [])
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

function renderItems() {
  const grid = document.getElementById('items-grid');
  const statusEl = document.getElementById('items-filter-status');
  const filtered = getFilteredItems();

  const activeCol = state.collections.find((c) => c.id === state.selectedCollectionId);
  if (state.searchQuery.trim()) {
    statusEl.textContent = `Menemukan ${filtered.length} produk untuk pencarian "${state.searchQuery}"`;
  } else if (activeCol) {
    statusEl.textContent = `Menampilkan ${filtered.length} produk dalam koleksi "${activeCol.title}"`;
  } else {
    statusEl.textContent = `Menampilkan semua ${filtered.length} produk rekomendasi`;
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <p style="margin-block: 0 0.75rem; font-weight: 600;">Produk yang kamu cari belum ditemukan.</p>
        <button type="button" class="btn btn-secondary" data-reset-filters="1">Tampilkan Semua Produk</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (item) => `
      <article class="item-card">
        <div class="item-media">
          <img
            class="item-thumb"
            src="${escapeHtml(item.imageUrl)}"
            alt="${escapeHtml(item.title)}"
            width="320"
            height="320"
            loading="lazy"
          >
          <span class="item-code-pill">#${escapeHtml(item.code)}</span>
          ${item.badge ? `<span class="item-badge-pill">${escapeHtml(item.badge)}</span>` : ''}
        </div>
        <div class="item-content">
          <div class="item-meta-row">
            <span class="marketplace-tag">${escapeHtml(item.marketplace || 'Shopee')}</span>
          </div>
          <h3 class="item-title">${escapeHtml(item.title)}</h3>
          <p class="item-note">${escapeHtml(item.note || '')}</p>
        </div>
        <div class="item-footer">
          <div class="price-block">
            <span class="price-current">${escapeHtml(item.price || 'Cek Promo Shopee')}</span>
            ${item.originalPrice ? `<span class="price-original">${escapeHtml(item.originalPrice)}</span>` : ''}
          </div>
          <div class="item-actions">
            <button type="button" class="btn btn-secondary" style="padding: 0.42rem 0.7rem; font-size: 0.76rem;" data-open-item="${escapeHtml(item.id)}">
              Detail
            </button>
            <a href="${escapeHtml(getItemHref(item))}" data-track-item="${escapeHtml(item.id)}" target="_blank" rel="noopener" class="btn btn-primary" style="padding: 0.42rem 0.8rem; font-size: 0.76rem;">
              Beli ↗
            </a>
          </div>
        </div>
      </article>
    `
    )
    .join('');
}

function openItemDetailModal(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  state.activeDetailItem = item;

  const col = state.collections.find((c) => c.id === item.collectionId);
  const dialog = document.getElementById('item-detail-dialog');
  document.getElementById('item-dialog-title').textContent = `#${item.code} — ${item.title}`;

  const specsHtml = (item.specs || []).length
    ? `<ul style="margin-block: 0.65rem 0; padding-inline-start: 1.2rem; font-size: 0.85rem; color: var(--text-secondary);">
        ${item.specs.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
      </ul>`
    : '';

  document.getElementById('item-dialog-body').innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem; align-items: start;">
      <img
        src="${escapeHtml(item.imageUrl)}"
        alt="${escapeHtml(item.title)}"
        width="360"
        height="360"
        style="border-radius: var(--radius-md); aspect-ratio: 1 / 1; object-fit: cover; inline-size: 100%;"
      >
      <div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-block-end: 0.5rem;">
          <span class="marketplace-tag">${escapeHtml(item.marketplace)}</span>
          ${col ? `<span class="marketplace-tag" style="background: var(--bg-muted); color: var(--text-secondary);">${escapeHtml(col.title)}</span>` : ''}
        </div>
        <div style="margin-block-end: 0.75rem;">
          <strong style="font-size: 1.15rem; color: var(--brand);">${escapeHtml(item.price || 'Cek Promo Shopee')}</strong>
          ${item.originalPrice ? `<span class="price-original" style="margin-inline-start: 0.45rem;">${escapeHtml(item.originalPrice)}</span>` : ''}
        </div>
        <div style="background: var(--bg-page); border-radius: var(--radius-sm); padding: 0.75rem; border: 1px solid var(--border-subtle);">
          <strong style="display: block; font-size: 0.78rem; color: var(--text-muted); margin-block-end: 0.25rem;">SPILL REVIEW @CYNTACLAW:</strong>
          <p style="margin: 0; font-size: 0.88rem;">${escapeHtml(item.note || 'Produk rekomendasi pilihan.')}</p>
        </div>
        ${specsHtml}
      </div>
    </div>
  `;

  const visitBtn = document.getElementById('btn-visit-item-store');
  visitBtn.href = getItemHref(item);
  visitBtn.textContent = `Beli di ${item.marketplace || 'Shopee'} ↗`;

  dialog.showModal();
}

async function openStoryModal(collectionId) {
  const select = document.getElementById('story-collection-select');
  select.innerHTML = state.collections
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)} (${c.itemCount ?? 0} item)</option>`)
    .join('');

  state.activeStoryCollectionId = collectionId || state.collections[0]?.id || null;
  if (state.activeStoryCollectionId) {
    select.value = state.activeStoryCollectionId;
  }

  await refreshStoryPreview();
  document.getElementById('story-dialog').showModal();
}

async function refreshStoryPreview() {
  const canvas = document.getElementById('story-canvas');
  const col = state.collections.find((c) => c.id === state.activeStoryCollectionId) || state.collections[0];
  const colItems = state.items.filter((i) => i.collectionId === col?.id);

  await renderStoryCanvas(canvas, {
    profile: state.profile,
    collection: col,
    items: colItems,
    template: state.activeStoryTemplate
  });
}

function bindEvents() {
  const searchInput = document.getElementById('visitor-search-input');
  const clearBtn = document.getElementById('btn-clear-search');

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearBtn.hidden = !state.searchQuery.trim();
    renderItems();
  });

  clearBtn.addEventListener('click', () => {
    state.searchQuery = '';
    searchInput.value = '';
    clearBtn.hidden = true;
    renderItems();
    searchInput.focus();
  });

  document.getElementById('category-pills-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-col-id]');
    if (!btn) return;
    state.selectedCollectionId = btn.dataset.colId;
    renderCategoryPills();
    renderCollections();
    renderItems();
  });

  document.getElementById('collections-grid').addEventListener('click', (e) => {
    const storyBtn = e.target.closest('[data-story-col]');
    if (storyBtn) {
      openStoryModal(storyBtn.dataset.storyCol);
      return;
    }
    const filterBtn = e.target.closest('[data-filter-col]');
    if (filterBtn) {
      const colId = filterBtn.dataset.filterCol;
      state.selectedCollectionId = state.selectedCollectionId === colId ? 'all' : colId;
      renderCategoryPills();
      renderCollections();
      renderItems();
      document.getElementById('heading-items').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  document.getElementById('items-grid').addEventListener('click', (e) => {
    const resetBtn = e.target.closest('[data-reset-filters]');
    if (resetBtn) {
      state.selectedCollectionId = 'all';
      state.searchQuery = '';
      searchInput.value = '';
      clearBtn.hidden = true;
      renderCategoryPills();
      renderCollections();
      renderItems();
      return;
    }
    const detailBtn = e.target.closest('[data-open-item]');
    if (detailBtn) {
      openItemDetailModal(detailBtn.dataset.openItem);
      return;
    }
    const trackBtn = e.target.closest('[data-track-item]');
    if (trackBtn && state.isStaticMode) {
      const id = trackBtn.dataset.trackItem;
      const store = getLocalStaticStore();
      const target = store.items.find((i) => i.id === id);
      if (target) {
        target.clicksCount = (target.clicksCount || 0) + 1;
        saveLocalStaticStore(store);
      }
    }
  });

  document.getElementById('btn-copy-item-link').addEventListener('click', async () => {
    if (!state.activeDetailItem) return;
    const shareUrl = state.isStaticMode
      ? state.activeDetailItem.url
      : `${window.location.origin}/r/${encodeURIComponent(state.activeDetailItem.id)}`;
    await copyTextWithFallback(shareUrl);
    showToast(`✓ Link produk #${state.activeDetailItem.code} berhasil disalin!`);
  });

  document.getElementById('btn-share-bio').addEventListener('click', async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          text: state.profile?.tagline || 'Cek rekomendasi produk pilihanku!',
          url
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    await copyTextWithFallback(url);
    showToast('✓ Link halaman bio berhasil disalin!');
  });

  document.getElementById('btn-open-profile-story').addEventListener('click', () => {
    openStoryModal(state.selectedCollectionId !== 'all' ? state.selectedCollectionId : state.collections[0]?.id);
  });

  document.getElementById('story-collection-select').addEventListener('change', (e) => {
    state.activeStoryCollectionId = e.target.value;
    refreshStoryPreview();
  });

  document.getElementById('story-template-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-template]');
    if (!btn) return;
    state.activeStoryTemplate = btn.dataset.template;
    for (const b of document.querySelectorAll('#story-template-picker .tpl-btn')) {
      b.setAttribute('aria-pressed', String(b === btn));
    }
    refreshStoryPreview();
  });

  document.getElementById('btn-download-story-png').addEventListener('click', async () => {
    const canvas = document.getElementById('story-canvas');
    const col = state.collections.find((c) => c.id === state.activeStoryCollectionId) || state.collections[0];
    const blob = await canvasToPngBlob(canvas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyntaclaw-story-${col?.slug || 'koleksi'}-${state.activeStoryTemplate}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (!state.isStaticMode) {
      fetch('./api/public/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'story_export', collectionId: col?.id || null })
      }).catch(() => {});
    }

    showToast('✓ Gambar Kartu Story (1080×1920) berhasil diunduh!');
  });

  document.getElementById('btn-share-story-file').addEventListener('click', async () => {
    const canvas = document.getElementById('story-canvas');
    const col = state.collections.find((c) => c.id === state.activeStoryCollectionId) || state.collections[0];
    const blob = await canvasToPngBlob(canvas);
    const file = new File([blob], `story-${col?.slug || 'cyntaclaw'}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: col?.title || 'Rekomendasi Pilihan',
          text: `Cek koleksi ${col?.title || ''} di ${window.location.origin}`
        });
        return;
      } catch {
        // Fallback to download
      }
    }
    document.getElementById('btn-download-story-png').click();
  });
}

async function init() {
  initLightDismissDialogs();
  bindEvents();

  try {
    const res = await fetch('./api/public/bootstrap?trackView=1');
    if (!res.ok) throw new Error('Static deployment mode');
    const data = await res.json();
    state.isStaticMode = false;
    state.profile = data.profile;
    state.collections = data.collections || [];
    state.items = data.items || [];
  } catch {
    // Running on GitHub Pages or static hosting without Node.js server
    state.isStaticMode = true;
    const localData = getLocalStaticStore();
    state.profile = localData.profile;
    state.collections = localData.collections || [];
    state.items = localData.items || [];
  }

  renderProfile();
  renderCategoryPills();
  renderCollections();
  renderItems();
}

init();
