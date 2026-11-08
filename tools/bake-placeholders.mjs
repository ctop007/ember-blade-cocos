// Bake canvas placeholders for not-yet-delivered images to PNG (native builds have no full Canvas 2D).
// Needs a running ?debug web build: node tools/bake-placeholders.mjs. Output: assets/resources/placeholders/<key>.png
// + config/placeholders.json. Stale PNGs (art now delivered) are removed. Rebuild web afterwards.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const PAGE = process.env.URL || 'http://127.0.0.1:8942/?debug';
const res = new URL('../assets/resources/', import.meta.url).pathname;
const out = path.join(res, 'placeholders');
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.goto(PAGE);
await page.waitForFunction(() => window.__AI_BRIDGE__ && window.__AI_BRIDGE__.state().phase === 'home', null, { timeout: 30000 });
const avail = JSON.parse(fs.readFileSync(path.join(res, 'config/available.json'), 'utf8'));
const real = new Set(avail.images);
const keys = (await page.evaluate(() => window.__AI_BRIDGE__.pendingImages())).filter(k => !real.has(k));
for (const k of keys) {
    const url = await page.evaluate(k => window.__AI_BRIDGE__.bakePlaceholder(k), k);
    const f = path.join(out, k + '.png');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
}
// drop stale placeholders (and their .meta) for art that is now real
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
let removed = 0;
for (const f of walk(out)) if (f.endsWith('.png')) {
    const k = path.relative(out, f).replace(/\.png$/, '');
    if (!keys.includes(k)) { fs.rmSync(f); if (fs.existsSync(f + '.meta')) fs.rmSync(f + '.meta'); removed++; }
}
fs.writeFileSync(path.join(res, 'config/placeholders.json'), JSON.stringify({ keys }, null, 1));
console.log(`baked ${keys.length}, removed ${removed}`);
await browser.close();
