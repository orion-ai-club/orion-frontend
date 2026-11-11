import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const fixture = await server.transformIndexHtml(
    '/__comment_test',
    '<script type="module">import {contentService} from "/services/contentService.ts"; window.commentsApi = contentService;</script>'
  );
  browser = await puppeteer.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requests = [];
  const receipts = new Map();
  let loseResponse = true;
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (url.origin !== base) return request.abort();
    if (url.pathname === '/__comment_test')
      return request.respond({ status: 200, contentType: 'text/html', body: fixture });
    if (!url.pathname.startsWith('/api/')) return request.continue();
    assert.equal(request.method(), 'POST');
    assert.equal(url.search, '');
    const body = JSON.parse(request.postData());
    const headers = request.headers();
    assert.match(headers.cookie, /orion_session=synthetic-session/);
    const key = headers['idempotency-key'];
    assert.match(key, /^[a-f0-9-]{36}$/i);
    assert.equal('user' in body, false);
    assert.equal('photoURL' in body, false);
    requests.push({ path: url.pathname, body, headers });
    if (!receipts.has(key))
      receipts.set(key, { _id: '507f1f77bcf86cd799439099', comment: body.comment });
    const result = url.pathname.includes('/reply/') ? [receipts.get(key)] : receipts.get(key);
    if (loseResponse) {
      loseResponse = false;
      return request.respond({
        status: 503,
        contentType: 'application/json',
        body: '{"message":"Outcome unknown"}'
      });
    }
    return request.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result)
    });
  });
  const ready = async () => {
    await page.goto(base + '/__comment_test');
    await page.waitForFunction(() => Boolean(window.commentsApi));
  };
  await page.setCookie({ name: 'orion_session', value: 'synthetic-session', url: base });
  const submit = (text, actor = '507f1f77bcf86cd799439011') =>
    page.evaluate(
      async (text, actor) =>
        window.commentsApi.addComment(
          '507f1f77bcf86cd799439022',
          { _id: actor },
          text,
          'private-avatar'
        ),
      text,
      actor
    );
  await ready();
  await assert.rejects(() => submit('Synthetic comment'), /Outcome unknown/);
  assert.equal(requests.length, 1, 'Unknown outcomes never trigger an automatic POST retry');
  const pending = await page.evaluate(() => Object.entries(sessionStorage));
  assert.equal(pending.length, 1);
  assert.equal(JSON.stringify(pending).includes('Synthetic comment'), false);
  const firstKey = requests[0].headers['idempotency-key'];
  assert.equal(requests[0].headers['x-orion-comment-write-canary'], undefined);
  await page.evaluate(() =>
    sessionStorage.setItem('orion:comment-worker-canary:507f1f77bcf86cd799439011', '1')
  );
  await assert.rejects(() => submit('Synthetic comment'), /Restore the original comment routing/);
  assert.equal(requests.length, 1, 'An uncertain operation cannot switch client routing');
  await page.evaluate(() =>
    sessionStorage.removeItem('orion:comment-worker-canary:507f1f77bcf86cd799439011')
  );
  await ready();
  const recovered = await submit('Synthetic comment');
  assert.equal(
    requests[1].headers['idempotency-key'],
    firstKey,
    'Reloaded retry keeps the same key'
  );
  assert.equal(receipts.size, 1, 'Lost response cannot create another Worker receipt');
  assert.equal(recovered.length, 1, 'A single-comment response is normalized');
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  await page.evaluate(() =>
    sessionStorage.setItem('orion:comment-worker-canary:507f1f77bcf86cd799439011', '1')
  );
  await submit('Synthetic comment');
  assert.notEqual(
    requests.at(-1).headers['idempotency-key'],
    firstKey,
    'Confirmed success permits a new intentional comment'
  );
  const before = requests.length;
  await Promise.all([submit('Concurrent comment'), submit('Concurrent comment')]);
  assert.equal(requests.length, before + 1, 'Double submission shares one in-flight operation');
  await page.evaluate(async () => {
    await window.commentsApi.addReply(
      '507f1f77bcf86cd799439099',
      { _id: '507f1f77bcf86cd799439011' },
      'Synthetic reply',
      { _id: '507f1f77bcf86cd799439033' },
      'private-avatar'
    );
  });
  assert.deepEqual(requests.at(-1).body, {
    reply: 'Synthetic reply',
    targetUser: '507f1f77bcf86cd799439033'
  });
  assert.equal(requests.at(-1).headers['x-orion-comment-write-canary'], '1');
  await page.evaluate(() => localStorage.setItem('googleInfo', 'synthetic-google-identity'));
  await submit('Google compatibility');
  assert.equal(requests.at(-1).headers['x-google-auth'], 'synthetic-google-identity');
  assert.equal(
    requests.at(-1).headers['x-orion-comment-write-canary'],
    undefined,
    'Google identity stays on the legacy route'
  );
  await page.evaluate(() => {
    localStorage.removeItem('googleInfo');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('Storage blocked');
      }
    });
  });
  loseResponse = true;
  await assert.rejects(() => submit('Storage unavailable'), /Outcome unknown/);
  const memoryKey = requests.at(-1).headers['idempotency-key'];
  await submit('Storage unavailable');
  assert.equal(requests.at(-1).headers['idempotency-key'], memoryKey);
  loseResponse = true;
  await assert.rejects(() => submit('Account-scoped retry'), /Outcome unknown/);
  const ownerKey = requests.at(-1).headers['idempotency-key'];
  await submit('Account-scoped retry', '507f1f77bcf86cd799439044');
  assert.notEqual(requests.at(-1).headers['idempotency-key'], ownerKey);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: real comment service payloads, unknown outcomes, reload retry, concurrent submit, account isolation, Google compatibility and blocked storage'
  );
} finally {
  await browser?.close();
  await server.close();
}
