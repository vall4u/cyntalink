'use strict';

const assert = require('node:assert/strict');
const { Duplex } = require('node:stream');
const { createAppServer } = require('../server');

function invokeServer(server, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve) => {
    const reqStream = new Duplex({ read() {} });
    reqStream.url = url;
    reqStream.method = method;
    reqStream.headers = {
      host: 'localhost:3000',
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
    };
    reqStream.destroy = () => {};

    let statusCode = 200;
    let resHeaders = {};
    const chunks = [];

    const resStream = new Duplex({
      read() {},
      write(chunk, encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        callback();
      }
    });

    resStream.writeHead = (code, hdrs = {}) => {
      statusCode = code;
      resHeaders = { ...resHeaders, ...hdrs };
      return resStream;
    };

    resStream.end = (chunk) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawText = Buffer.concat(chunks).toString('utf8');
      resolve({
        status: statusCode,
        headers: resHeaders,
        text: async () => rawText,
        json: async () => JSON.parse(rawText)
      });
    };

    server.emit('request', reqStream, resStream);

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      reqStream.push(payload);
    }
    reqStream.push(null);
  });
}

async function runTests() {
  const { server, db } = createAppServer();
  console.log(`Running full-stack smoke tests for @cyntaclaw (storage engine: ${db.engine})...`);

  // 1. Public index page
  const indexRes = await invokeServer(server, { method: 'GET', url: '/' });
  assert.equal(indexRes.status, 200);
  const indexHtml = await indexRes.text();
  assert.ok(indexHtml.includes('cyntaclaw'));
  assert.ok(indexHtml.includes('<dialog id="story-dialog" closedby="any"'));
  assert.ok(indexHtml.includes('<search class="search-panel">'));

  // 2. Public bootstrap API — verify @cyntaclaw profile & all 20 msha.ke/cyntaclaw items
  const bootRes = await invokeServer(server, { method: 'GET', url: '/api/public/bootstrap?trackView=1' });
  assert.equal(bootRes.status, 200);
  const bootData = await bootRes.json();
  assert.equal(bootData.profile.handle, 'cyntaclaw');
  assert.equal(bootData.collections.length, 4);
  assert.ok(bootData.items.length >= 20);
  assert.equal(bootData.items[0].code, '01');
  assert.equal(bootData.items[0].url, 'https://shope.ee/20TVOOkPox');

  // 3. Affiliate redirect & click counter
  const firstItem = bootData.items[0];
  const beforeClicks = firstItem.clicksCount;
  const redirRes = await invokeServer(server, { method: 'GET', url: `/r/${firstItem.id}` });
  assert.equal(redirRes.status, 302);
  const afterItem = db.getItemById(firstItem.id);
  assert.equal(afterItem.clicksCount, beforeClicks + 1);

  // 4. Admin login & protected dashboard endpoint
  const loginRes = await invokeServer(server, {
    method: 'POST',
    url: '/api/admin/login',
    headers: { 'Content-Type': 'application/json' },
    body: { password: process.env.ADMIN_PASSWORD || 'sayang123' }
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.token);

  const authHeaders = {
    Authorization: `Bearer ${loginData.token}`,
    'Content-Type': 'application/json'
  };

  // 5. Test msha.ke/cyntaclaw & bulk text importer endpoint (/api/admin/import-links)
  const importRes = await invokeServer(server, {
    method: 'POST',
    url: '/api/admin/import-links',
    headers: authHeaders,
    body: {
      sourceUrl: 'https://www.msha.ke/cyntaclaw',
      collectionId: 'col-complexion'
    }
  });
  assert.equal(importRes.status, 200);
  const importData = await importRes.json();
  assert.equal(importData.ok, true);
  assert.ok(importData.importedCount >= 20);

  // 6. Test adding a new item #21 via text line importer (e.g. Masami Powder from her IG feed)
  const addLineRes = await invokeServer(server, {
    method: 'POST',
    url: '/api/admin/import-links',
    headers: authHeaders,
    body: {
      collectionId: 'col-complexion',
      rawText: 'MASAMI Forever Matte Blurring Foundation Powder #21 | https://shope.ee/masami21 | Blurring matte powder favorit di konten IG'
    }
  });
  assert.equal(addLineRes.status, 200);
  const addLineData = await addLineRes.json();
  assert.equal(addLineData.importedCount, 1);
  assert.ok(addLineData.items.some((i) => i.code === '21' && i.title.includes('MASAMI')));

  // Clean up test item #21 so default seed remains clean #01-#20
  const item21 = addLineData.items.find((i) => i.code === '21');
  if (item21) db.deleteItem(item21.id);

  console.log('✅ All @cyntaclaw + msha.ke/cyntaclaw smoke tests passed!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
