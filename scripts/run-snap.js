import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import process from 'process';

// 模拟 __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');

// 🔥 配置并发数 (Vercel 建议 3-5)
const CONCURRENCY_LIMIT = 5;

// 1. 静态页面路由
const STATIC_ROUTES = ['/', '/blogs', '/profile', '/footprints', '/404'];

// 2. API 地址
const API_BASE_URL =
  'https://api.samyao.me/api';
const POSTS_URL = API_BASE_URL + '/posts?page=1&limit=1000';

const isVercel = process.env.VERCEL === '1';

// --- 启动预览服务器 ---
function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting preview server...');
    const viteEntry = path.resolve(__dirname, '../node_modules/vite/bin/vite.js');
    const server = spawn(process.execPath, [viteEntry, 'preview', '--port', '4173'], {
      stdio: 'inherit',
      shell: false,
      detached: false
    });
    server.once('error', reject);
    // 等待 3 秒确保服务启动
    setTimeout(() => {
      resolve(server);
    }, 3000);
  });
}

// --- 获取动态路由 (纯 ID 模式) ---
async function fetchPostRoutes() {
  console.log('🌍 Fetching posts from API: ' + POSTS_URL + '...');
  try {
    const response = await fetch(POSTS_URL);
    if (!response.ok) throw new Error(`API responded with ${response.status}`);

    const json = await response.json();

    // 兼容 data 结构
    // 有些 API 返回 { data: [] }, 有些直接返回 []
    const posts = Array.isArray(json) ? json : json.data || [];

    if (!Array.isArray(posts)) {
      console.error('⚠️ Expected posts to be an array but got:', typeof posts);
      return [];
    }

    // Keep prerender paths identical to the canonical/sitemap URL shape.
    const routes = posts
      .filter((post) => !post.isPrivate)
      .map((post) => {
        const id = post._id || post.id;
        const cleanTitle =
          post.name
            ?.replace(/[^\p{L}\p{N}]+/gu, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase() || 'post';
        return `/blogs/${cleanTitle}-${id}`;
      });

    console.log(`📚 Found ${routes.length} posts to prerender.`);
    return routes;
  } catch (error) {
    console.error('⚠️ Failed to fetch posts:', error.message);
    throw error;
  }
}

// --- 单个页面处理任务 ---
async function snapPage(browser, route, index, total) {
  let page = null;
  try {
    page = await browser.newPage();

    // The preview runs on localhost during build while the API only allows the
    // production origin. Proxy API traffic through Node so prerendering sees
    // the same public data without weakening production CORS.
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      const url = req.url();
      if (!url.startsWith(API_BASE_URL)) {
        await req.continue();
        return;
      }

      const previewOrigin = 'http://localhost:4173';
      const corsHeaders = {
        'access-control-allow-origin': previewOrigin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': req.headers()['access-control-request-headers'] || 'content-type,authorization'
      };

      try {
        if (req.method() === 'OPTIONS') {
          await req.respond({ status: 204, headers: corsHeaders, body: '' });
          return;
        }

        const headers = { ...req.headers() };
        delete headers.host;
        delete headers.origin;
        delete headers.referer;
        delete headers['content-length'];

        const init = { method: req.method(), headers };
        if (!['GET', 'HEAD'].includes(req.method()) && req.postData()) {
          init.body = req.postData();
        }

        const upstream = await fetch(url, init);
        const body = Buffer.from(await upstream.arrayBuffer());
        const responseHeaders = {};
        upstream.headers.forEach((value, key) => {
          if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
            responseHeaders[key] = value;
          }
        });
        Object.assign(responseHeaders, corsHeaders);

        await req.respond({
          status: upstream.status,
          headers: responseHeaders,
          body
        });
      } catch (error) {
        console.warn(`⚠️ API proxy failed for ${url}: ${error.message}`);
        await req.abort();
      }
    });

    await page.setViewport({ width: 1280, height: 800 });

    // 访问页面 (纯 ID 路径不需要复杂编码)
    const url = `http://localhost:4173${route}`;

    // 放宽超时时间
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // The app keeps realtime connections open, so networkidle0 never settles.
    // Wait for actual rendered UI instead of network silence.
    await page.waitForSelector('#root > *', { timeout: 15000 });

    // Wait for route-specific content/metadata before serializing the snapshot.
    // The app keeps sockets open, so SEO readiness is based on meaningful DOM/meta.
    if (route === '/') {
      await page.waitForFunction(
        () =>
          document.title.startsWith('Sam Yao') &&
          Boolean(document.querySelector('main h1')) &&
          Boolean(document.querySelector('link[rel="canonical"]')),
        { timeout: 15000 }
      );
    } else if (route.startsWith('/blogs/')) {
      await page.waitForFunction(
        () =>
          document.title.includes('| Orion Journals') &&
          Boolean(document.querySelector('article h1')) &&
          Boolean(document.querySelector('link[rel="canonical"]')),
        { timeout: 15000 }
      );
    } else if (route === '/blogs') {
      await page.waitForFunction(
        () =>
          document.title.includes('Orion Journals') &&
          Boolean(document.querySelector('#latest-posts header')) &&
          Boolean(document.querySelector('link[rel="canonical"]')),
        { timeout: 15000 }
      );
    } else if (route === '/profile') {
      await page.waitForSelector('main h1, main h2', { timeout: 15000 });
    }

    // Stamp the snapshot with the route it was rendered for.
    // The client uses this to avoid hydrating stale/wrong-route HTML.
    await page.evaluate((renderedRoute) => {
      const root = document.getElementById('root');
      if (root) root.setAttribute('data-prerender-path', renderedRoute);

      const absoluteUrl = new URL(renderedRoute === '/' ? '/' : renderedRoute, 'https://samyao.me').href;
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', absoluteUrl);

      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute('content', absoluteUrl);
    }, route);

    const html = await page.content();

    // 计算保存路径
    let filePath;
    if (route === '/404') {
      filePath = path.join(DIST_DIR, '404.html');
    } else if (route === '/') {
      // Keep dist/index.html as the immutable SPA source while the preview
      // server renders the other routes; promote this snapshot at the end.
      filePath = path.join(DIST_DIR, '__root_snapshot.html');
    } else {
      // 路由: /blogs/694b... -> 目录: dist/blogs/694b.../index.html
      // 移除开头的 /
      const routePath = route.startsWith('/') ? route.slice(1) : route;
      const dir = path.join(DIST_DIR, routePath);

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      filePath = path.join(dir, 'index.html');
    }

    fs.writeFileSync(filePath, html);
    console.log(`✅ [${index + 1}/${total}] Saved: ${route}`);
    return true;
  } catch (e) {
    console.error(`❌ [${index + 1}/${total}] Error: ${route} - ${e.message}`);
    return false;
  } finally {
    if (page) await page.close(); // 必须关闭 Tab 释放内存
  }
}

// --- 主流程 ---
(async () => {
  let serverProcess;
  let browser;

  try {
    // 1. 并行：启动服务 + 抓取接口
    const [previewProcess, dynamicRoutes] = await Promise.all([startServer(), fetchPostRoutes()]);
    serverProcess = previewProcess;

    const ALL_ROUTES = [...STATIC_ROUTES, ...dynamicRoutes];
    const total = ALL_ROUTES.length;

    console.log(`🎯 Total pages to snap: ${total} | Concurrency: ${CONCURRENCY_LIMIT}`);

    // 2. 启动浏览器
    let executablePath;
    let launchArgs = [];
    if (isVercel) {
      console.log('☁️ Detected Vercel. Loading @sparticuz/chromium...');
      const chromium = await import('@sparticuz/chromium').then((m) => m.default);
      executablePath = await chromium.executablePath();
      launchArgs = chromium.args;
    } else {
      console.log('💻 Local run. Using Puppeteer...');
      executablePath = puppeteer.executablePath();
      if (!fs.existsSync(executablePath) && fs.existsSync('/usr/bin/google-chrome')) {
        executablePath = '/usr/bin/google-chrome';
      }
      launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
    }

    browser = await puppeteer.launch({
      executablePath,
      headless: 'new',
      args: launchArgs
    });

    // 3. 并发控制队列
    const executing = [];
    const results = [];

    for (let i = 0; i < total; i++) {
      const route = ALL_ROUTES[i];
      const p = snapPage(browser, route, i, total);
      results.push(p);

      if (CONCURRENCY_LIMIT <= total) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= CONCURRENCY_LIMIT) {
          await Promise.race(executing);
        }
      }
    }

    const settled = await Promise.all(results);
    const failedCount = settled.filter((ok) => !ok).length;
    if (failedCount > 0) {
      throw new Error(`Prerender failed for ${failedCount} of ${total} routes`);
    }

    const rootSnapshot = path.join(DIST_DIR, '__root_snapshot.html');
    if (!fs.existsSync(rootSnapshot)) {
      throw new Error('Root prerender snapshot was not created');
    }
    fs.renameSync(rootSnapshot, path.join(DIST_DIR, 'index.html'));
    console.log('🎉 All pages prerendered successfully!');
  } catch (error) {
    console.error('⚠️ Prerender script global error:', error);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.warn('⚠️ Browser was already closed:', error.message);
      }
    }
    if (serverProcess) {
      console.log('🛑 Killing preview server...');
      serverProcess.kill();
    }
    if (process.exitCode == null) process.exitCode = 0;
  }
})().catch((error) => {
  console.error('❌ Prerender failed:', error);
  process.exitCode = 1;
});
