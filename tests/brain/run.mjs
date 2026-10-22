import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, open: false },
  mode: 'test'
});
await server.listen();
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--no-sandbox']
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const id = '654321000000000000000001';
const doc = {
  _id: id,
  sourceId: id,
  rawText: '中文记忆 <img src="https://private-leak.invalid/x">',
  assetIds: []
};
let memory = {
  _id: id,
  sourceId: id,
  statement: doc.rawText,
  revision: 1,
  type: 'fact',
  reviewStatus: 'candidate',
  sensitivity: 'normal',
  tags: [],
  sourceAnchors: [{ documentId: id, quote: '中文记忆' }]
};
let saved = null;
let connections = [];
const testToken = 'ov_' + 's'.repeat(43);
const config = {
  mcpUrl: 'https://api.example.invalid/api/brain/sync/mcp',
  openapiUrl: 'https://api.example.invalid/api/brain/sync/openapi.json',
  apiBaseUrl: 'https://api.example.invalid/api/brain/sync/v1'
};
let exportCreated = false;
let externalLeaks = 0;
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = new URL(req.url());
  if (url.pathname.includes('/api/') && !url.pathname.includes('/api/brain'))
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ list: [] })
    });

  if (url.pathname.includes('/api/brain')) {
    const path = url.pathname.split('/brain')[1];
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*'
    };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers });
    let payload = { items: [], nextCursor: null };
    if (url.searchParams.has('query')) assert.fail('Private search text must stay out of URLs');
    if (path === '/dashboard')
      payload = {
        types: { identity: 28, career: 22, instruction: 5, project: 12, preference: 35 },
        sources: { manual: 1 },
        activity: [{ day: new Date().toISOString().slice(0, 10), count: 102 }],
        recent: [memory],
        connections
      };
    else if (path === '/connections' && req.method() === 'GET')
      payload = { items: connections, configuration: config };
    else if (path === '/connections' && req.method() === 'POST') {
      const body = JSON.parse(req.postData());
      assert.deepEqual(body.scopes, ['memory:read', 'memory:write']);
      const connection = {
        _id: id,
        label: body.label,
        provider: 'chatgpt',
        kind: 'api-key',
        scopes: body.scopes,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        revokedAt: null,
        lastUsedAt: null,
        lastWriteAt: null
      };
      connections = [connection];
      payload = { connection, token: testToken };
    } else if (path === '/connections/' + id && req.method() === 'DELETE') {
      connections = connections.map((c) => ({ ...c, revokedAt: new Date().toISOString() }));
      payload = connections[0];
    } else if (path === '/search' && req.method() === 'POST') {
      const search = JSON.parse(req.postData());
      payload = { items: search.kind === 'documents' ? [doc] : [memory], nextCursor: null };
    } else if (path === '/stats')
      payload = { memories: 1, sources: 1, documents: 1, candidates: 1 };
    else if (path === '/memories' && req.method() === 'GET')
      payload = { items: [memory], nextCursor: null };
    else if (path.startsWith('/memories') && ['POST', 'PATCH'].includes(req.method())) {
      saved = JSON.parse(req.postData());
      memory = { ...memory, ...saved, revision: memory.revision + 1 };
      payload = memory;
    } else if (path.includes('/revisions'))
      payload = {
        items: [
          { _id: id, revisionNumber: 1, action: 'create', editedAt: '2026-01-01', after: memory }
        ],
        nextCursor: null
      };
    else if (path === '/exports' && req.method() === 'POST') {
      const body = JSON.parse(req.postData());
      assert.equal(body.passphrase, 'synthetic backup key 123');
      exportCreated = true;
      payload = { _id: id, state: 'complete' };
    } else if (path === '/exports')
      payload = {
        items: exportCreated ? [{ _id: id, state: 'complete', preview: { encrypted: true } }] : [],
        nextCursor: null
      };
    else if (path === '/restore/preview')
      payload = {
        _id: id,
        state: 'preview',
        counts: { added: 1, conflicts: 0 },
        preview: { archiveCounts: { memories: 1 } }
      };
    else if (path === '/imports' && req.method() === 'POST')
      payload = {
        _id: id,
        state: 'preview',
        counts: { added: 1, missingAssets: 1 },
        preview: { warnings: ['Synthetic missing attachment'] }
      };
    else if (path.endsWith('/commit'))
      payload = { _id: id, state: 'complete', counts: { added: 1 } };
    else if (path.startsWith('/documents/')) payload = doc;
    else if (path === '/sources')
      payload = {
        items: [{ _id: id, provider: 'manual', originalSha256: 'a'.repeat(64), status: 'ready' }],
        nextCursor: null
      };
    else if (path === '/legacy/conversations')
      payload = {
        items: [{ _id: id, sessionId: 'legacy-1', title: 'Old conversation' }],
        nextCursor: null
      };
    else if (path === '/legacy/messages')
      payload = {
        items: [
          { _id: id, content: 'Read only history', images: ['https://private-leak.invalid/x'] }
        ],
        nextCursor: null
      };
    return req.respond({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(payload)
    });
  }
  if (url.protocol !== 'data:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    if (url.hostname === 'private-leak.invalid') externalLeaks++;
    else console.log('Blocked pre-existing dependency host', url.hostname);
    return req.abort();
  }
  return req.continue();
});
const textClick = (text) => page.locator('::-p-text(' + text + ')').click();
const navClick = async (text) => {
  if (['Sources', 'Legacy Chats', 'Backup & Restore'].includes(text))
    await page.click('.vault-tools-menu > summary');
  await page.locator('nav button ::-p-text(' + text + ')').click();
};
try {
  await page.goto(
    'http://127.0.0.1:' + server.httpServer.address().port + '/tests/brain/index.html',
    { waitUntil: 'networkidle0' }
  );
  assert.ok(await page.$('.captains-cabin .memory-vault h1'));
  const minimize = await page.$('button .fa-compress-alt');
  if (minimize) await minimize.click();
  assert.equal(
    await page.$eval('.memory-vault', (el) =>
      getComputedStyle(el).getPropertyValue('--vault-accent').trim()
    ),
    '#e11d48'
  );
  await page.waitForSelector('.knowledge-you strong');
  assert.equal(await page.$eval('.knowledge-you strong', (el) => el.textContent), '102');
  assert.equal(await page.$$eval('.knowledge-topic', (els) => els.length), 5);
  await page.click('[data-topic=preference]');
  assert.equal(await page.$eval('[aria-label="Type"]', (el) => el.value), 'preference');
  await navClick('AI Sync');
  await page.waitForSelector('[aria-label="ChatGPT MCP URL"]');
  assert.equal(await page.$eval('[aria-label="Claude MCP URL"]', (el) => el.value), config.mcpUrl);
  assert.ok(await page.evaluate(() => document.body.textContent.includes('Background changes')));
  await page.click('.knowledge-api-details > summary');
  await textClick('Create dedicated key');
  await page.waitForSelector('[aria-label="New connection key"]');
  assert.equal(await page.$eval('[aria-label="New connection key"]', (el) => el.value), testToken);
  assert.equal(
    await page.evaluate(
      (token) => Object.values(localStorage).some((v) => v.includes(token)),
      testToken
    ),
    false
  );
  await textClick('Saved, close');
  assert.equal(await page.$('[aria-label="New connection key"]'), null);
  await textClick('Revoke');
  await page.waitForFunction(() =>
    document.querySelector('.knowledge-connection-list')?.textContent.includes('Revoked')
  );
  await textClick('Memories');
  await page.waitForSelector('.vault-card');
  await page.type('[aria-label="Search memories"]', '中文');
  await page.waitForResponse((r) => r.url().endsWith('/search') && r.request().method() === 'POST');
  await page.click('.vault-card');
  await page.waitForSelector('[aria-label="Statement"]');
  await page.$eval('[aria-label="Statement"]', (el) => {
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.focus('[aria-label="Statement"]');
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.type('[aria-label="Statement"]', 'Edited memory');
  await textClick('Save revision');
  await page.waitForFunction(() =>
    document.querySelector('[role=status]')?.textContent.includes('Saved')
  );
  assert.equal(saved.statement, 'Edited memory');
  assert.equal(saved.expectedRevision, 1);
  await page.locator('button ::-p-text(中文记忆)').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('pre')].some((e) => e.textContent.includes('<img'))
  );
  assert.equal(await page.$('img'), null);
  await navClick('Legacy Chats');
  await textClick('Old conversation');
  await page.waitForFunction(() => document.body.textContent.includes('Read only history'));
  assert.equal(await page.$('textarea'), null);
  assert.equal(externalLeaks, 0);
  await navClick('Sources');
  await page.waitForSelector('input[type=file]');
  const testFile = 'test-results/brain/synthetic-import.md';
  await fs.mkdir('test-results/brain', { recursive: true });
  await fs.writeFile(testFile, 'Synthetic import');
  await (await page.$('input[type=file]')).uploadFile(testFile);
  await textClick('Preview import');
  await page.waitForFunction(() =>
    document.body.textContent.includes('Synthetic missing attachment')
  );
  await textClick('Confirm additive import');
  await page.waitForFunction(
    () =>
      document.body.textContent.includes('Current job') &&
      document.body.textContent.includes('complete')
  );
  await navClick('Backup & Restore');
  await page.type('[aria-label="Backup passphrase"]', 'synthetic backup key 123');
  await textClick('Create & verify backup');
  await page.waitForFunction(() =>
    document.body.textContent.includes('Backup created and verified')
  );
  assert.ok(exportCreated);
  assert.equal(await page.$eval('[aria-label="Backup passphrase"]', (el) => el.value), '');
  await (await page.$('[aria-label="Restore file"]')).uploadFile(testFile);
  await textClick('Verify & preview restore');
  await page.waitForFunction(() => document.body.textContent.includes('Archive coverage'));
  await textClick('Confirm additive restore');
  await page.waitForFunction(() => document.body.textContent.includes('complete'));
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await fs.mkdir('test-results/brain', { recursive: true });
  await page.screenshot({ path: 'test-results/brain/vault-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS Phase 1 browser: real render/edit/version payload, escaped evidence, read-only legacy, zero external requests, 390px layout; Phase 2 upload/preview/missing-assets/commit UI; Phase 3 encrypted backup/key clearing/restore preview and commit UI.'
  );
} catch (error) {
  await fs.mkdir('test-results/brain', { recursive: true });
  await fs.writeFile('test-results/brain/failure.html', await page.content());
  await page.screenshot({ path: 'test-results/brain/failure.png', fullPage: true });
  console.error('BRAIN PAGE ERRORS', JSON.stringify(errors));
  throw error;
} finally {
  await browser.close();
  await server.close();
}
