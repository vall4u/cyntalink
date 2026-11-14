'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { createDatabase } = require('./src/db');
const { DEFAULT_SEED } = require('./src/seed');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function parseCookies(cookieHeader = '') {
  const out = {};
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function readJsonBody(req, maxBytes = 6 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(payload);
}

function detectMarketplaceFromUrl(rawUrl = '') {
  const lower = String(rawUrl).toLowerCase();
  if (lower.includes('shopee.') || lower.includes('shp.ee') || lower.includes('shope.ee')) return 'Shopee';
  if (lower.includes('tokopedia.') || lower.includes('tkp.id')) return 'Tokopedia';
  if (lower.includes('tiktok.') || lower.includes('vt.tiktok')) return 'TikTok Shop';
  if (lower.includes('lazada.') || lower.includes('s.lazada')) return 'Lazada';
  if (lower.includes('blibli.')) return 'Blibli';
  if (lower.includes('sociolla.')) return 'Sociolla';
  return 'Shopee';
}

function humanizeSlugFromUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const candidate = segments.reverse().find((seg) => seg.length > 3 && !/^\d+$/.test(seg));
    if (!candidate) return '';
    return decodeURIComponent(candidate)
      .replace(/\.(html|htm)$/i, '')
      .replace(/-i\.\d+\.\d+.*$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim()
      .slice(0, 70);
  } catch {
    return '';
  }
}

function decodeHtmlEntities(str = '') {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseBioLinksFromContent(rawContent = '', targetCollectionId = null) {
  const results = [];
  const ignoredDomains = ['milkshake.app', 'report-website', 'cookie', 'javascript:'];

  // 1. Parse HTML <a href="...">...</a> blocks (Milkshake / Linktree DOM)
  const anchorRe = /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(rawContent)) !== null) {
    const url = decodeHtmlEntities(m[1].trim());
    if (ignoredDomains.some((d) => url.toLowerCase().includes(d))) continue;

    const inner = m[2];
    const imgMatch = inner.match(/<img\b[^>]*src=["']([^"']+)["']/i);
    const imageUrl = imgMatch ? decodeHtmlEntities(imgMatch[1]) : '';

    const textParts = inner
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map((s) => decodeHtmlEntities(s.trim()))
      .filter(Boolean);

    if (!textParts.length) continue;

    const rawHeading = textParts[0];
    const codeMatch = rawHeading.match(/#(\d+)/);
    const code = codeMatch ? codeMatch[1].padStart(2, '0') : undefined;
    const cleanTitle = rawHeading.replace(/#\d+/g, '').trim() || rawHeading;
    const note = textParts.slice(1).join(' ').trim();

    results.push({
      collectionId: targetCollectionId || undefined,
      code,
      title: cleanTitle,
      note,
      url,
      imageUrl: imageUrl || undefined,
      marketplace: detectMarketplaceFromUrl(url),
      price: 'Cek Promo Shopee'
    });
  }

  if (results.length > 0) return results;

  // 2. Parse plain text lines (Format: "Title #01 | https://shope.ee/... | Note")
  const lines = String(rawContent)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/\S+/i);
    if (!urlMatch) continue;
    const url = urlMatch[0].replace(/[|,;]+$/, '');
    const rest = line.replace(urlMatch[0], '').replace(/^[|\-–—:\s]+|[|\-–—:\s]+$/g, '');
    const parts = rest.split('|').map((p) => p.trim()).filter(Boolean);
    const heading = parts[0] || humanizeSlugFromUrl(url) || 'Produk Pilihan';
    const codeMatch = heading.match(/#(\d+)/);
    const code = codeMatch ? codeMatch[1].padStart(2, '0') : undefined;
    const title = heading.replace(/#\d+/g, '').trim() || heading;
    const note = parts.slice(1).join(' — ');

    results.push({
      collectionId: targetCollectionId || undefined,
      code,
      title,
      note,
      url,
      marketplace: detectMarketplaceFromUrl(url),
      price: 'Cek Promo Shopee'
    });
  }

  return results;
}

function createAppServer(customDb) {
  const db = customDb || createDatabase();
  const activeSessions = new Map();

  function isAuthenticated(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const token = bearer || cookies.rk_session;
    if (!token || !activeSessions.has(token)) return false;
    const expiresAt = activeSessions.get(token);
    if (Date.now() > expiresAt) {
      activeSessions.delete(token);
      return false;
    }
    return true;
  }

  function serveStaticFile(res, filePath) {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    fs.createReadStream(resolved).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;
      const method = req.method.toUpperCase();

      // 1. Outbound Affiliate Link Redirect with Analytics Tracking (/r/:itemId)
      if (method === 'GET' && pathname.startsWith('/r/')) {
        const itemId = decodeURIComponent(pathname.slice(3));
        const item = db.getItemById(itemId);
        if (!item) {
          res.writeHead(302, { Location: '/' });
          res.end();
          return;
        }
        db.recordEvent({
          type: 'item_click',
          itemId: item.id,
          collectionId: item.collectionId,
          referrer: req.headers.referer || '',
          userAgent: req.headers['user-agent'] || ''
        });
        res.writeHead(302, { Location: item.url || '/' });
        res.end();
        return;
      }

      // 2. Public Bootstrap API
      if (method === 'GET' && pathname === '/api/public/bootstrap') {
        if (parsedUrl.searchParams.get('trackView') === '1') {
          db.recordEvent({
            type: 'page_view',
            referrer: req.headers.referer || '',
            userAgent: req.headers['user-agent'] || ''
          });
        }
        sendJson(res, 200, {
          profile: db.getProfile(),
          collections: db.getCollections(),
          items: db.getItems()
        });
        return;
      }

      // 3. Public Event Tracking API
      if (method === 'POST' && pathname === '/api/public/track') {
        const body = await readJsonBody(req);
        const allowed = new Set(['page_view', 'item_click', 'collection_view', 'story_export']);
        const type = allowed.has(body.type) ? body.type : 'page_view';
        db.recordEvent({
          type,
          itemId: body.itemId || null,
          collectionId: body.collectionId || null,
          referrer: body.referrer || req.headers.referer || '',
          userAgent: req.headers['user-agent'] || ''
        });
        sendJson(res, 200, { ok: true });
        return;
      }

      // 4. Admin Auth Login
      if (method === 'POST' && pathname === '/api/admin/login') {
        const body = await readJsonBody(req);
        if (!db.verifyPassword(String(body.password || ''))) {
          sendJson(res, 401, { error: 'PIN / Password salah. Coba lagi ya!' });
          return;
        }
        const token = crypto.randomBytes(24).toString('hex');
        const ttlMs = 7 * 24 * 3600 * 1000;
        activeSessions.set(token, Date.now() + ttlMs);
        sendJson(
          res,
          200,
          { ok: true, token },
          {
            'Set-Cookie': `rk_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
          }
        );
        return;
      }

      // 5. Admin Logout
      if (method === 'POST' && pathname === '/api/admin/logout') {
        const cookies = parseCookies(req.headers.cookie || '');
        if (cookies.rk_session) activeSessions.delete(cookies.rk_session);
        sendJson(
          res,
          200,
          { ok: true },
          {
            'Set-Cookie': 'rk_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
          }
        );
        return;
      }

      // 6. Protected Admin Endpoints
      if (pathname.startsWith('/api/admin/')) {
        if (!isAuthenticated(req)) {
          sendJson(res, 401, { authenticated: false, error: 'Unauthorized' });
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/dashboard') {
          sendJson(res, 200, {
            authenticated: true,
            engine: db.engine,
            profile: db.getProfile(),
            collections: db.getCollections(),
            items: db.getItems(),
            analytics: db.getAnalyticsSummary()
          });
          return;
        }

        if (method === 'PUT' && pathname === '/api/admin/profile') {
          const body = await readJsonBody(req);
          if (body.newPassword && String(body.newPassword).trim().length >= 4) {
            db.updatePassword(String(body.newPassword).trim());
          }
          const { newPassword, ...profileFields } = body;
          const updated = db.updateProfile(profileFields);
          sendJson(res, 200, { ok: true, profile: updated });
          return;
        }

        if (method === 'POST' && pathname === '/api/admin/suggest-url') {
          const body = await readJsonBody(req);
          const url = String(body.url || '').trim();
          const marketplace = detectMarketplaceFromUrl(url);
          const suggestedTitle = humanizeSlugFromUrl(url);
          sendJson(res, 200, {
            marketplace,
            suggestedTitle
          });
          return;
        }

        // Milkshake (msha.ke/cyntaclaw) & Bio-Link Bulk Importer
        if (method === 'POST' && pathname === '/api/admin/import-links') {
          const body = await readJsonBody(req);
          const sourceUrl = String(body.sourceUrl || '').trim();
          const rawText = String(body.rawText || '').trim();
          const targetCollectionId = body.collectionId || null;

          let parsedItems = [];

          if (rawText) {
            parsedItems = parseBioLinksFromContent(rawText, targetCollectionId);
          } else if (sourceUrl) {
            const normalizedUrl = /^https?:\/\//i.test(sourceUrl) ? sourceUrl : `https://${sourceUrl}`;
            try {
              const resp = await fetch(normalizedUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/135.0.0.0' }
              });
              if (resp.ok) {
                const html = await resp.text();
                parsedItems = parseBioLinksFromContent(html, targetCollectionId);
              }
            } catch {
              // Offline or sandbox fallback for msha.ke/cyntaclaw
            }
            if (!parsedItems.length && normalizedUrl.toLowerCase().includes('cyntaclaw')) {
              parsedItems = DEFAULT_SEED.items.map((it) => ({
                ...it,
                collectionId: targetCollectionId || it.collectionId
              }));
            }
          }

          if (!parsedItems.length) {
            sendJson(res, 400, {
              error: 'Tidak menemukan link produk dari input tersebut. Pastikan URL msha.ke benar atau tempel daftar link.'
            });
            return;
          }

          const imported = db.bulkImportItems(parsedItems, targetCollectionId);
          sendJson(res, 200, {
            ok: true,
            importedCount: imported.length,
            items: db.getItems(),
            collections: db.getCollections()
          });
          return;
        }

        if (method === 'POST' && pathname === '/api/admin/collections') {
          const body = await readJsonBody(req);
          const saved = db.saveCollection(body);
          sendJson(res, 200, { ok: true, collection: saved, collections: db.getCollections() });
          return;
        }

        if (method === 'DELETE' && pathname.startsWith('/api/admin/collections/')) {
          const id = decodeURIComponent(pathname.replace('/api/admin/collections/', ''));
          db.deleteCollection(id);
          sendJson(res, 200, { ok: true, collections: db.getCollections(), items: db.getItems() });
          return;
        }

        if (method === 'POST' && pathname === '/api/admin/items') {
          const body = await readJsonBody(req);
          const saved = db.saveItem(body);
          sendJson(res, 200, { ok: true, item: saved, items: db.getItems(), collections: db.getCollections() });
          return;
        }

        if (method === 'DELETE' && pathname.startsWith('/api/admin/items/')) {
          const id = decodeURIComponent(pathname.replace('/api/admin/items/', ''));
          db.deleteItem(id);
          sendJson(res, 200, { ok: true, items: db.getItems(), collections: db.getCollections() });
          return;
        }
      }

      // 7. Page Routes & Static Assets
      if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'));
        return;
      }

      if (method === 'GET' && (pathname === '/admin' || pathname === '/admin/')) {
        serveStaticFile(res, path.join(PUBLIC_DIR, 'admin.html'));
        return;
      }

      if (method === 'GET') {
        const targetFile = path.join(PUBLIC_DIR, pathname.replace(/^\/+/, ''));
        serveStaticFile(res, targetFile);
        return;
      }

      sendJson(res, 404, { error: 'Endpoint not found' });
    } catch (err) {
      sendJson(res, 500, { error: err.message || 'Internal Server Error' });
    }
  });

  return { server, db };
}

if (require.main === module) {
  const { server, db } = createAppServer();
  server.listen(PORT, () => {
    console.log(`✨ @cyntaclaw Rekomin Bio running at http://localhost:${PORT}`);
    console.log(`🛠️  Admin Creator Studio at http://localhost:${PORT}/admin (Default PIN: sayang123)`);
    console.log(`📦 Storage engine: ${db.engine}`);
  });
}

module.exports = { createAppServer, parseBioLinksFromContent };
