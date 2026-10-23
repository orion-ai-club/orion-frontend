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
let failListOnce = false;
let raceHistory = false;
let releaseHistory;
let releaseSearch;
let observeHistory, observeSearch;
const historyObserved = new Promise((resolve) => {
  observeHistory = resolve;
});
const searchObserved = new Promise((resolve) => {
  observeSearch = resolve;
});
const second = {
  ...memory,
  _id: '654321000000000000000002',
  statement: 'Second memory',
  revision: 7
};
const screenshot = async (name) => {
  await fs.mkdir('test-results/brain', { recursive: true });
  await page.screenshot({ path: 'test-results/brain/' + name + '.png', fullPage: true });
};
const fill = async (selector, text) => {
  await page.focus(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  if (text) await page.type(selector, text);
  else await page.keyboard.press('Backspace');
};

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
page.on('request', async (req) => {
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
      assert.equal(body.provider, 'claude');
      const connection = {
        _id: id,
        label: body.label,
        provider: body.provider,
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
      if (search.query === 'slow') {
        await new Promise((resolve) => {
          releaseSearch = resolve;
          observeSearch();
        });
        payload = { items: [{ ...memory, statement: 'STALE_SEARCH' }], nextCursor: null };
      } else
        payload = {
          items: search.kind === 'documents' ? [doc] : search.query === 'empty' ? [] : [memory],
          nextCursor: null
        };
    } else if (path === '/stats')
      payload = { memories: 1, sources: 1, documents: 1, candidates: 1 };
    else if (path === '/memories' && req.method() === 'GET') {
      if (failListOnce) {
        failListOnce = false;
        return req.respond({
          status: 503,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic list unavailable' })
        });
      }
      payload = { items: raceHistory ? [memory, second] : [memory], nextCursor: null };
    } else if (path.startsWith('/memories') && ['POST', 'PATCH'].includes(req.method())) {
      saved = JSON.parse(req.postData());
      memory = { ...memory, ...saved, revision: memory.revision + 1 };
      payload = memory;
    } else if (path.includes('/revisions')) {
      const isSecond = path.includes(second._id);
      if (raceHistory && !isSecond)
        await new Promise((resolve) => {
          releaseHistory = resolve;
          observeHistory();
        });
      payload = {
        items: [
          {
            _id: isSecond ? second._id : id,
            revisionNumber: isSecond ? 7 : 1,
            action: isSecond ? 'SECOND_HISTORY' : 'FIRST_HISTORY',
            editedAt: '2026-01-01',
            after: isSecond ? second : memory
          }
        ],
        nextCursor: null
      };
    } else if (path === '/exports' && req.method() === 'POST') {
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
  assert.equal(await page.$('button .fa-compress-alt'), null);
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
  await page.setViewport({ width: 1440, height: 1000 });
  assert.equal(
    await page.evaluate(() => document.body.textContent.includes('One brain. Every AI.')),
    false
  );
  await screenshot('overview-desktop');
  await page.click('.vault-tools-menu > summary');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.vault-tools-menu', (el) => el.open), false);
  await page.click('.vault-tools-menu > summary');
  await page.click('.vault-head');
  assert.equal(await page.$eval('.vault-tools-menu', (el) => el.open), false);
  await page.click('[data-topic=preference]');
  assert.equal(await page.$eval('[aria-label="Type"]', (el) => el.value), 'preference');
  await navClick('AI Sync');
  await page.waitForSelector('[aria-label="MCP URL"]');
  assert.equal(await page.$eval('[aria-label="MCP URL"]', (el) => el.value), config.mcpUrl);
  assert.equal(await page.$('.knowledge-agreement'), null);
  await screenshot('connections-desktop');
  await page.click('.knowledge-api-details > summary');
  await page.select('[aria-label="Connection provider"]', 'claude');
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
  page.once('dialog', (d) => d.accept());
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
  // Failed list refresh must not turn a committed save into a stale revision retry.
  await fill('[aria-label="Statement"]', 'Saved despite list failure');
  // Clear search so the failing list route participates in refresh.
  await fill('[aria-label="Search memories"]', '');
  await page.waitForFunction(
    () => !document.querySelector('.vault-list')?.getAttribute('aria-busy')?.includes('true')
  );
  failListOnce = true;
  await textClick('Save revision');
  await page.waitForFunction(() =>
    document.querySelector('[role=status]')?.textContent.includes('Saved. List refresh failed')
  );
  assert.equal(saved.expectedRevision, 2);
  await fill('[aria-label="Statement"]', 'Saved after refresh failure');
  await textClick('Save revision');
  await page.waitForFunction(() =>
    document.querySelector('[role=status]')?.textContent.includes('Saved with')
  );
  assert.equal(saved.expectedRevision, 3);
  await screenshot('editor-desktop');

  // Closing an edited record needs an explicit discard; cancelling preserves the draft.
  await page.type('[aria-label="Statement"]', ' unsaved');
  page.once('dialog', (d) => d.dismiss());
  await page.click('[aria-label="Close editor"]');
  assert.ok((await page.$eval('[aria-label="Statement"]', (el) => el.value)).endsWith(' unsaved'));
  page.once('dialog', (d) => d.accept());
  await page.click('[aria-label="Close editor"]');
  assert.equal(await page.$('[aria-label="Statement"]'), null);

  await fill('[aria-label="Search memories"]', 'slow');
  await Promise.race([
    searchObserved,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Delayed search was not observed')), 5000)
    )
  ]);
  await fill('[aria-label="Search memories"]', 'fast');
  await page.waitForFunction(() =>
    document.querySelector('.vault-card')?.textContent.includes('Saved after refresh failure')
  );
  releaseSearch();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    await page.evaluate(() => document.body.textContent.includes('STALE_SEARCH')),
    false
  );
  await fill('[aria-label="Search memories"]', 'empty');
  await page.waitForFunction(() => document.body.textContent.includes('No matching memories'));
  await textClick('Reset');
  await page.waitForSelector('.vault-card');

  // A slow response from another record cannot replace the selected record's history.
  raceHistory = true;
  await textClick('Search');
  await page.waitForFunction(() => document.querySelectorAll('.vault-card').length === 2);
  await page.click('.vault-card');
  await Promise.race([
    historyObserved,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Delayed history was not observed')), 5000)
    )
  ]);
  await page.locator('.vault-card ::-p-text(Second memory)').click();
  await page.waitForFunction(() => document.body.textContent.includes('SECOND_HISTORY'));
  releaseHistory();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    await page.evaluate(() => document.body.textContent.includes('FIRST_HISTORY')),
    false
  );
  assert.equal(await page.$$eval('.vault-card[aria-pressed="true"]', (els) => els.length), 1);

  await page.setViewport({ width: 390, height: 844 });
  await page.click('[aria-label="Close editor"]');
  await page.locator('.vault-card ::-p-text(Second memory)').click();
  await page.waitForFunction(() => {
    const rect = document.querySelector('[aria-label="Statement"]')?.getBoundingClientRect();
    return rect && rect.top >= 0 && rect.top < innerHeight;
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot('editor-mobile');
  raceHistory = false;
  await navClick('Overview');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot('overview-mobile');
  await navClick('AI Sync');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot('connections-mobile');
  for (const width of [320, 768, 1024]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Connections overflow at ' + width
    );
    await navClick('Overview');
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Overview overflow at ' + width
    );
    await navClick('AI Sync');
  }
  await page.setViewport({ width: 1440, height: 1000 });
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
    'PASS Personal UX: no marketing/instructions, menu dismissal, provider payload, unsaved draft guard, stale search/history guards, successful save after refresh failure, selected state, mobile editor visibility; Phase 1 browser: real render/edit/version payload, escaped evidence, read-only legacy, zero external requests, 390px layout; Phase 2 upload/preview/missing-assets/commit UI; Phase 3 encrypted backup/key clearing/restore preview and commit UI.'
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
