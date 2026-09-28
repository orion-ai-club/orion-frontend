import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ||
    (process.platform === 'win32'
      ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
      : undefined),
  headless: true
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.url().includes('api.imgflip.com'))
    return req.respond({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        success: true,
        data: {
          memes: [
            { id: '1', name: 'Happy Cat', url: 'https://i.imgflip.com/test.gif' },
            { id: '2', name: 'Drake', url: 'https://i.imgflip.com/test.jpg' }
          ]
        }
      })
    });
  if (req.url().includes('/api/'))
    return req.respond({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '[]'
    });
  if (/youtube|vimeo|bilibili|i.imgflip/.test(req.url())) return req.abort();
  return req.continue();
});
try {
  await page.goto(
    `${process.env.JOURNAL_BASE_URL || 'http://127.0.0.1:5178'}/tests/journal/index.html`
  );
  await page.waitForSelector('.tiptap');
  await page.click('.tiptap');
  await page.keyboard.type('Font selection survives toolbar');
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.select('[aria-label="字体"]', 'serif');
  await page.select('[aria-label="字号"]', '28px');
  await page.click('[aria-label="文字颜色"]');
  await page.click('.journal-color-menu [aria-label="紫"]');
  assert(
    await page.$eval(
      '.tiptap',
      (el) =>
        el.innerHTML.includes('font-family: serif') &&
        el.innerHTML.includes('28px') &&
        el.innerHTML.includes('color:')
    )
  );
  console.log('PASS selected text retains font, size and color');
  await page.click('[aria-label="表情包"]');
  await page.click('[aria-label="插入 😂"]');
  assert(await page.$eval('.tiptap', (el) => el.textContent.includes('😂')));
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((el) => el.textContent === '网络热门').click()
  );
  await page.waitForSelector('[aria-label="插入表情包 Happy Cat"]');
  await page.type('[aria-label="搜索网络表情"]', '猫');
  assert.equal((await page.$$('.meme-grid button')).length, 1);
  await page.click('[aria-label="插入表情包 Happy Cat"]');
  assert(await page.$eval('.tiptap img', (el) => el.src.endsWith('.gif')));
  console.log('PASS emoji, online keyword search and GIF insertion');
  await page.click('[aria-label="插入视频"]');
  await page.type('.journal-insert-panel input', 'https://youtu.be/dQw4w9WgXcQ');
  await page.evaluate(() =>
    [...document.querySelectorAll('.journal-insert-panel button')]
      .find((el) => el.textContent === '插入')
      .click()
  );
  await page.waitForSelector('.journal-reader iframe');
  assert(
    await page.$eval(
      '.journal-reader iframe',
      (el) => el.src === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    )
  );
  await page.click('[aria-label="插入视频"]');
  await page.type('.journal-insert-panel input', 'https://example.com/movie.mp4');
  await page.evaluate(() =>
    [...document.querySelectorAll('.journal-insert-panel button')]
      .find((el) => el.textContent === '插入')
      .click()
  );
  await page.waitForSelector('.journal-reader video[controls]');
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((el) => el.textContent === '编辑保存内容').click()
  );
  await page.waitForSelector('.tiptap video');
  assert(await page.$('.tiptap iframe'));
  console.log('PASS platform/native videos survive save, reopen and reading');
  const result = await page.evaluate(() => {
    const api = window.journalTest;
    const html = api.renderContent(
      '<p><span style="color:#102030;font-size:24px">Dark ink</span><span style="color:#ffeeee">Light ink</span></p>'
    );
    const root = document.createElement('div');
    root.className = 'journal-reader';
    root.innerHTML = html;
    document.body.append(root);
    const light = getComputedStyle(root.querySelector('span')).color;
    document.documentElement.classList.add('dark');
    const dark = getComputedStyle(root.querySelector('span')).color;
    root.classList.add('journal-force-light');
    const fixed = getComputedStyle(root.querySelector('span')).color;
    root.remove();
    return {
      light,
      dark,
      fixed,
      editor: getComputedStyle(document.querySelector('.journal-editor')).backgroundColor,
      unsafe: api.videoFromUrl('javascript:alert(1)'),
      bili: api.videoFromUrl('https://www.bilibili.com/video/BV1xx411c7mD'),
      vimeo: api.videoFromUrl('https://vimeo.com/12345')
    };
  });
  assert.notEqual(result.light, result.dark);
  assert.equal(result.light, result.fixed);
  assert.equal(result.editor, 'rgb(8, 13, 25)');
  assert.equal(result.unsafe, null);
  assert(result.bili && result.vimeo);
  console.log('PASS Orion-themed editor and adaptive custom text, safe URL handling');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'test-results/journal/media-dark-reader.png', fullPage: true });
} finally {
  await browser.close();
}
