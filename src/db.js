'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DEFAULT_SEED, createEditorialIllustration } = require('./seed');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SQLITE_PATH = path.join(DATA_DIR, 'rekomin.sqlite');

function hashPassword(password) {
  return crypto.createHash('sha256').update(`rekomin-salt:${password}`).digest('hex');
}

function getTodayKey(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function createDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let DatabaseSync = null;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    DatabaseSync = null;
  }

  if (DatabaseSync) {
    return createSqliteStore(new DatabaseSync(SQLITE_PATH));
  }
  return createJsonStore(path.join(DATA_DIR, 'runtime-db.json'));
}

function createSqliteStore(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      themeColor TEXT DEFAULT '#b55d7a',
      featured INTEGER DEFAULT 0,
      sortOrder INTEGER DEFAULT 1,
      coverUrl TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      collectionId TEXT NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      price TEXT DEFAULT '',
      originalPrice TEXT DEFAULT '',
      marketplace TEXT DEFAULT 'Shopee',
      badge TEXT DEFAULT '',
      url TEXT NOT NULL,
      note TEXT DEFAULT '',
      specsJson TEXT DEFAULT '[]',
      featured INTEGER DEFAULT 0,
      sortOrder INTEGER DEFAULT 1,
      imageUrl TEXT DEFAULT '',
      clicksCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      itemId TEXT DEFAULT NULL,
      collectionId TEXT DEFAULT NULL,
      referrer TEXT DEFAULT '',
      userAgent TEXT DEFAULT '',
      dayKey TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  function seedDatabaseWithDefaults() {
    db.exec('DELETE FROM items; DELETE FROM collections; DELETE FROM analytics_events;');
    const defaultPass = process.env.ADMIN_PASSWORD || 'sayang123';
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('profile', JSON.stringify(DEFAULT_SEED.profile));
    insertSetting.run('admin_password_hash', hashPassword(defaultPass));

    const now = new Date().toISOString();
    const insertCol = db.prepare(`
      INSERT INTO collections (id, slug, title, category, description, themeColor, featured, sortOrder, coverUrl, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const col of DEFAULT_SEED.collections) {
      insertCol.run(
        col.id,
        col.slug,
        col.title,
        col.category,
        col.description,
        col.themeColor,
        col.featured ? 1 : 0,
        col.sortOrder,
        col.coverUrl,
        now
      );
    }

    const insertItem = db.prepare(`
      INSERT INTO items (id, collectionId, code, title, price, originalPrice, marketplace, badge, url, note, specsJson, featured, sortOrder, imageUrl, clicksCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const sampleClicks = [64, 58, 49, 45, 31, 39, 44, 36, 41, 29, 52, 27, 33, 30, 24, 55, 22, 26, 34, 28];
    DEFAULT_SEED.items.forEach((item, idx) => {
      insertItem.run(
        item.id,
        item.collectionId,
        item.code,
        item.title,
        item.price,
        item.originalPrice || '',
        item.marketplace || 'Shopee',
        item.badge || '',
        item.url,
        item.note || '',
        JSON.stringify(item.specs || []),
        item.featured ? 1 : 0,
        item.sortOrder || idx + 1,
        item.imageUrl || '',
        sampleClicks[idx] || 18,
        now
      );
    });

    const insertEvent = db.prepare(`
      INSERT INTO analytics_events (type, itemId, collectionId, referrer, userAgent, dayKey, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const dailyViews = [42, 51, 48, 63, 74, 89, 78];
    const dailyClicks = [19, 24, 22, 31, 38, 46, 39];
    for (let i = 6; i >= 0; i--) {
      const dayKey = getTodayKey(-i);
      const ts = new Date(Date.now() - i * 86400000).toISOString();
      for (let v = 0; v < dailyViews[6 - i]; v++) {
        insertEvent.run('page_view', null, null, 'instagram.com/cyntaclaw', 'Mobile Safari', dayKey, ts);
      }
      for (let c = 0; c < dailyClicks[6 - i]; c++) {
        const picked = DEFAULT_SEED.items[c % DEFAULT_SEED.items.length];
        insertEvent.run('item_click', picked.id, picked.collectionId, 'instagram.com/cyntaclaw', 'Mobile Safari', dayKey, ts);
      }
    }
  }

  const hasProfile = db.prepare('SELECT value FROM settings WHERE key = ?').get('profile');
  if (!hasProfile) {
    seedDatabaseWithDefaults();
  } else {
    try {
      const parsed = JSON.parse(hasProfile.value);
      if (parsed.handle === 'alyanadhira') {
        seedDatabaseWithDefaults();
      }
    } catch {
      seedDatabaseWithDefaults();
    }
  }

  function mapCollection(row) {
    if (!row) return null;
    return {
      ...row,
      featured: Boolean(row.featured)
    };
  }

  function mapItem(row) {
    if (!row) return null;
    let specs = [];
    try {
      specs = JSON.parse(row.specsJson || '[]');
    } catch {
      specs = [];
    }
    const { specsJson, ...rest } = row;
    return {
      ...rest,
      specs,
      featured: Boolean(row.featured)
    };
  }

  return {
    engine: 'node:sqlite',

    getProfile() {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('profile');
      return row ? JSON.parse(row.value) : DEFAULT_SEED.profile;
    },

    updateProfile(partial) {
      const current = this.getProfile();
      const updated = { ...current, ...partial };
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('profile', JSON.stringify(updated));
      return updated;
    },

    verifyPassword(password) {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password_hash');
      if (!row) return false;
      return row.value === hashPassword(password);
    },

    updatePassword(newPassword) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'admin_password_hash',
        hashPassword(newPassword)
      );
    },

    getCollections() {
      const rows = db.prepare('SELECT * FROM collections ORDER BY sortOrder ASC, createdAt ASC').all();
      const items = this.getItems();
      return rows.map((r) => {
        const col = mapCollection(r);
        const colItems = items.filter((i) => i.collectionId === col.id);
        return {
          ...col,
          itemCount: colItems.length
        };
      });
    },

    getCollectionById(id) {
      const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
      return mapCollection(row);
    },

    saveCollection(payload) {
      const id = payload.id || `col-${crypto.randomBytes(4).toString('hex')}`;
      const existing = this.getCollectionById(id);
      const title = (payload.title || 'Koleksi Baru').trim();
      const slug = (payload.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id);
      const category = (payload.category || 'Pilihan').trim();
      const description = (payload.description || '').trim();
      const themeColor = payload.themeColor || '#b55d7a';
      const featured = payload.featured ? 1 : 0;
      const sortOrder = Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 1;
      const coverUrl = payload.coverUrl || existing?.coverUrl || createEditorialIllustration({
        bg1: '#fceaf2',
        bg2: '#f0c4d7',
        accent: themeColor,
        iconText: category.slice(0, 4).toUpperCase(),
        title: title.slice(0, 22),
        subtitle: category
      });
      const createdAt = existing?.createdAt || new Date().toISOString();

      db.prepare(`
        INSERT OR REPLACE INTO collections (id, slug, title, category, description, themeColor, featured, sortOrder, coverUrl, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, slug, title, category, description, themeColor, featured, sortOrder, coverUrl, createdAt);

      return this.getCollectionById(id);
    },

    deleteCollection(id) {
      db.prepare('DELETE FROM items WHERE collectionId = ?').run(id);
      db.prepare('DELETE FROM collections WHERE id = ?').run(id);
      return true;
    },

    getItems() {
      const rows = db.prepare('SELECT * FROM items ORDER BY CAST(code AS INTEGER) ASC, sortOrder ASC, code ASC').all();
      return rows.map(mapItem);
    },

    getItemById(id) {
      const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
      return mapItem(row);
    },

    saveItem(payload) {
      const id = payload.id || `item-${crypto.randomBytes(4).toString('hex')}`;
      const existing = this.getItemById(id);
      const allItems = this.getItems();
      const nextNum = String(allItems.length + 1).padStart(2, '0');
      const rawCode = String(payload.code || existing?.code || nextNum).trim().replace(/^#/, '');
      const code = /^\d$/.test(rawCode) ? `0${rawCode}` : rawCode;
      const collectionId = payload.collectionId || existing?.collectionId || (this.getCollections()[0]?.id ?? 'col-complexion');
      const title = (payload.title || 'Produk Pilihan').trim();
      const price = (payload.price || 'Cek Promo Shopee').trim();
      const originalPrice = (payload.originalPrice || '').trim();
      const marketplace = (payload.marketplace || 'Shopee').trim();
      const badge = (payload.badge || '').trim();
      const url = (payload.url || 'https://shopee.co.id/').trim();
      const note = (payload.note || '').trim();
      const specs = Array.isArray(payload.specs)
        ? payload.specs.map((s) => String(s).trim()).filter(Boolean)
        : String(payload.specs || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      const featured = payload.featured ? 1 : 0;
      const sortOrder = Number.isFinite(Number(payload.sortOrder))
        ? Number(payload.sortOrder)
        : (parseInt(code, 10) || existing?.sortOrder || allItems.length + 1);
      const imageUrl = payload.imageUrl || existing?.imageUrl || createEditorialIllustration({
        bg1: '#fceaf2',
        bg2: '#f0c4d7',
        accent: '#b55d7a',
        iconText: `#${code}`,
        title: title.slice(0, 20),
        subtitle: marketplace
      });
      const clicksCount = existing?.clicksCount ?? 0;
      const createdAt = existing?.createdAt || new Date().toISOString();

      db.prepare(`
        INSERT OR REPLACE INTO items (id, collectionId, code, title, price, originalPrice, marketplace, badge, url, note, specsJson, featured, sortOrder, imageUrl, clicksCount, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        collectionId,
        code,
        title,
        price,
        originalPrice,
        marketplace,
        badge,
        url,
        note,
        JSON.stringify(specs),
        featured,
        sortOrder,
        imageUrl,
        clicksCount,
        createdAt
      );

      return this.getItemById(id);
    },

    bulkImportItems(importedList = [], fallbackCollectionId = null) {
      const existingByUrl = new Map(this.getItems().map((it) => [it.url, it]));
      const existingByCode = new Map(this.getItems().map((it) => [it.code, it]));
      const saved = [];

      for (const raw of importedList) {
        if (!raw || !raw.url) continue;
        const cleanCode = raw.code ? String(raw.code).replace(/^#/, '').padStart(2, '0') : '';
        const match = existingByUrl.get(raw.url) || (cleanCode && existingByCode.get(cleanCode));
        const item = this.saveItem({
          id: match?.id || undefined,
          collectionId: raw.collectionId || match?.collectionId || fallbackCollectionId || this.getCollections()[0]?.id,
          code: cleanCode || match?.code || undefined,
          title: raw.title || match?.title || 'Produk Pilihan',
          price: raw.price || match?.price || 'Cek Promo Shopee',
          marketplace: raw.marketplace || match?.marketplace || 'Shopee',
          badge: raw.badge || match?.badge || '',
          url: raw.url,
          note: raw.note !== undefined ? raw.note : (match?.note || ''),
          specs: raw.specs || match?.specs || ['Imported from msha.ke/cyntaclaw'],
          imageUrl: raw.imageUrl || match?.imageUrl || undefined,
          featured: raw.featured ?? match?.featured ?? false
        });
        saved.push(item);
      }
      return saved;
    },

    deleteItem(id) {
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
      return true;
    },

    recordEvent({ type, itemId = null, collectionId = null, referrer = '', userAgent = '' }) {
      const now = new Date().toISOString();
      const dayKey = now.slice(0, 10);
      db.prepare(`
        INSERT INTO analytics_events (type, itemId, collectionId, referrer, userAgent, dayKey, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(type, itemId, collectionId, String(referrer).slice(0, 250), String(userAgent).slice(0, 250), dayKey, now);

      if (type === 'item_click' && itemId) {
        db.prepare('UPDATE items SET clicksCount = clicksCount + 1 WHERE id = ?').run(itemId);
      }
    },

    getAnalyticsSummary() {
      const totalViews = db.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE type = 'page_view'").get().count;
      const totalClicks = db.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE type = 'item_click'").get().count;
      const storyExports = db.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE type = 'story_export'").get().count;
      const ctr = totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(1)) : 0;

      const dailySeries = [];
      for (let i = 6; i >= 0; i--) {
        const dayKey = getTodayKey(-i);
        const views = db.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE type = 'page_view' AND dayKey = ?").get(dayKey).count;
        const clicks = db.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE type = 'item_click' AND dayKey = ?").get(dayKey).count;
        dailySeries.push({ dayKey, views, clicks });
      }

      const items = this.getItems();
      const collections = this.getCollections();
      const colMap = new Map(collections.map((c) => [c.id, c]));

      const topItems = [...items]
        .sort((a, b) => b.clicksCount - a.clicksCount)
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          code: item.code,
          title: item.title,
          marketplace: item.marketplace,
          price: item.price,
          clicksCount: item.clicksCount,
          collectionTitle: colMap.get(item.collectionId)?.title || 'Koleksi'
        }));

      const collectionStats = collections.map((col) => {
        const colItems = items.filter((i) => i.collectionId === col.id);
        const clicks = colItems.reduce((sum, item) => sum + (item.clicksCount || 0), 0);
        return {
          id: col.id,
          title: col.title,
          category: col.category,
          itemCount: colItems.length,
          clicks
        };
      }).sort((a, b) => b.clicks - a.clicks);

      return {
        totalViews,
        totalClicks,
        storyExports,
        ctr,
        totalItems: items.length,
        totalCollections: collections.length,
        dailySeries,
        topItems,
        collectionStats
      };
    }
  };
}

function createJsonStore(filePath) {
  let state = null;
  if (fs.existsSync(filePath)) {
    try {
      state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (state?.profile?.handle === 'alyanadhira') state = null;
    } catch {
      state = null;
    }
  }
  if (!state) {
    const defaultPass = process.env.ADMIN_PASSWORD || 'sayang123';
    const now = new Date().toISOString();
    state = {
      profile: DEFAULT_SEED.profile,
      adminPasswordHash: hashPassword(defaultPass),
      collections: DEFAULT_SEED.collections.map((c) => ({ ...c, createdAt: now })),
      items: DEFAULT_SEED.items.map((item, idx) => ({
        ...item,
        clicksCount: 25 + idx,
        createdAt: now
      })),
      events: []
    };
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  function persist() {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  return {
    engine: 'json-fallback',
    getProfile: () => state.profile,
    updateProfile(partial) {
      state.profile = { ...state.profile, ...partial };
      persist();
      return state.profile;
    },
    verifyPassword: (password) => state.adminPasswordHash === hashPassword(password),
    updatePassword(newPassword) {
      state.adminPasswordHash = hashPassword(newPassword);
      persist();
    },
    getCollections() {
      return [...state.collections]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => ({
          ...c,
          itemCount: state.items.filter((i) => i.collectionId === c.id).length
        }));
    },
    getCollectionById: (id) => state.collections.find((c) => c.id === id) || null,
    saveCollection(payload) {
      const id = payload.id || `col-${crypto.randomBytes(4).toString('hex')}`;
      const idx = state.collections.findIndex((c) => c.id === id);
      const entry = {
        ...(idx >= 0 ? state.collections[idx] : {}),
        ...payload,
        id,
        featured: Boolean(payload.featured),
        sortOrder: Number(payload.sortOrder || 1),
        createdAt: idx >= 0 ? state.collections[idx].createdAt : new Date().toISOString()
      };
      if (idx >= 0) state.collections[idx] = entry;
      else state.collections.push(entry);
      persist();
      return entry;
    },
    deleteCollection(id) {
      state.collections = state.collections.filter((c) => c.id !== id);
      state.items = state.items.filter((i) => i.collectionId !== id);
      persist();
      return true;
    },
    getItems: () => [...state.items].sort((a, b) => (parseInt(a.code, 10) || 99) - (parseInt(b.code, 10) || 99)),
    getItemById: (id) => state.items.find((i) => i.id === id) || null,
    saveItem(payload) {
      const id = payload.id || `item-${crypto.randomBytes(4).toString('hex')}`;
      const idx = state.items.findIndex((i) => i.id === id);
      const entry = {
        ...(idx >= 0 ? state.items[idx] : { clicksCount: 0, createdAt: new Date().toISOString() }),
        ...payload,
        id,
        featured: Boolean(payload.featured)
      };
      if (idx >= 0) state.items[idx] = entry;
      else state.items.push(entry);
      persist();
      return entry;
    },
    bulkImportItems(list = [], fallbackCollectionId = null) {
      return list.map((raw) => this.saveItem({ ...raw, collectionId: raw.collectionId || fallbackCollectionId }));
    },
    deleteItem(id) {
      state.items = state.items.filter((i) => i.id !== id);
      persist();
      return true;
    },
    recordEvent(ev) {
      state.events.push({ ...ev, dayKey: getTodayKey(0), createdAt: new Date().toISOString() });
      if (ev.type === 'item_click' && ev.itemId) {
        const item = state.items.find((i) => i.id === ev.itemId);
        if (item) item.clicksCount = (item.clicksCount || 0) + 1;
      }
      persist();
    },
    getAnalyticsSummary() {
      const totalViews = state.events.filter((e) => e.type === 'page_view').length + 445;
      const totalClicks = state.items.reduce((s, i) => s + (i.clicksCount || 0), 0);
      return {
        totalViews,
        totalClicks,
        storyExports: state.events.filter((e) => e.type === 'story_export').length,
        ctr: Number(((totalClicks / Math.max(totalViews, 1)) * 100).toFixed(1)),
        totalItems: state.items.length,
        totalCollections: state.collections.length,
        dailySeries: [],
        topItems: state.items.slice(0, 8),
        collectionStats: this.getCollections()
      };
    }
  };
}

module.exports = {
  createDatabase
};
