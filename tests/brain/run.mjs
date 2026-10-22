import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false }, mode: 'test' });
await server.listen();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const id = '654321000000000000000001';
const doc = { _id: id, sourceId: id, rawText: '中文记忆 <img src="https://private-leak.invalid/x">', assetIds: [] };
let memory = { _id: id, sourceId: id, statement: doc.rawText, revision: 1, type: 'fact', reviewStatus: 'candidate', sensitivity: 'normal', tags: [], sourceAnchors: [{ documentId: id, quote: '中文记忆' }] };
let saved = null;
let externalLeaks = 0;
await page.setRequestInterception(true);
page.on('request', req => {
  const url = new URL(req.url());
  if (url.pathname.includes('/api/brain')) {
    const path = url.pathname.split('/brain')[1];
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers });
    let payload = { items: [], nextCursor: null };
    if (path === '/stats') payload = { memories: 1, sources: 1, documents: 1, candidates: 1 };
    else if (path === '/memories' && req.method() === 'GET') payload = { items: [memory], nextCursor: null };
    else if (path.startsWith('/memories') && ['POST', 'PATCH'].includes(req.method())) {
      saved = JSON.parse(req.postData()); memory = { ...memory, ...saved, revision: memory.revision + 1 }; payload = memory;
    } else if (path.includes('/revisions')) payload = { items: [{ _id: id, revisionNumber: 1, action: 'create', editedAt: '2026-01-01', after: memory }], nextCursor: null };
    else if (path.startsWith('/documents/')) payload = doc;
    else if (path === '/sources') payload = { items: [{ _id: id, provider: 'manual', originalSha256: 'a'.repeat(64), status: 'ready' }], nextCursor: null };
    else if (path === '/legacy/conversations') payload = { items: [{ _id: id, sessionId: 'legacy-1', title: 'Old conversation' }], nextCursor: null };
    else if (path === '/legacy/messages') payload = { items: [{ _id: id, content: 'Read only history', images: ['https://private-leak.invalid/x'] }], nextCursor: null };
    return req.respond({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(payload) });
  }
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { if (url.hostname === 'private-leak.invalid') externalLeaks++; else console.log('Blocked pre-existing dependency host', url.hostname); return req.abort(); }
  return req.continue();
});
const textClick = text => page.locator('::-p-text(' + text + ')').click();
try {
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/tests/brain/index.html', { waitUntil: 'networkidle0' });
  assert.ok(await page.$('h1'));
  await textClick('Memories');
  await page.waitForSelector('.vault-card');
  await page.click('.vault-card');
  await page.waitForSelector('[aria-label="Statement"]');
  await page.$eval('[aria-label="Statement"]', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.focus('[aria-label="Statement"]');
  await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
  await page.type('[aria-label="Statement"]', 'Edited memory');
  await textClick('Save revision');
  await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.includes('Saved'));
  assert.equal(saved.statement, 'Edited memory'); assert.equal(saved.expectedRevision, 1);
  await page.locator('button ::-p-text(中文记忆)').click();
  await page.waitForFunction(() => [...document.querySelectorAll('pre')].some(e => e.textContent.includes('<img')));
  assert.equal(await page.$('img'), null);
  await textClick('Legacy Chats'); await textClick('Old conversation');
  await page.waitForFunction(() => document.body.textContent.includes('Read only history'));
  assert.equal(await page.$('textarea'), null);
  assert.equal(externalLeaks, 0);
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await fs.mkdir('test-results/brain', { recursive: true });
  await page.screenshot({ path: 'test-results/brain/vault-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS Phase 1 browser: real render/edit/version payload, escaped evidence, read-only legacy, zero external requests, 390px layout.');
} finally { await browser.close(); await server.close(); }
