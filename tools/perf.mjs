// Perf: 20 enemies + ultimate under 4x CPU throttle. node tools/perf.mjs [w h]
import { chromium } from 'playwright';
import { Touch } from './touch.mjs';
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390);
const PAGE = process.env.URL || 'http://127.0.0.1:8942/?debug';
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'].slice(0, 0) });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const T = new Touch(page, cdp);
const B = (fn, ...a) => page.evaluate(([f, a]) => window.__AI_BRIDGE__[f](...a), [fn, a]);
const t0 = Date.now();
await page.goto(PAGE);
await page.waitForFunction(() => window.__AI_BRIDGE__ && window.__AI_BRIDGE__.state().phase === 'home', null, { timeout: 30000 });
const homeMs = Date.now() - t0;
const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const res = performance.getEntriesByType('resource'); return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), transferKB: Math.round((n.transferSize + res.reduce((a, r) => a + (r.transferSize || 0), 0)) / 1024), requests: res.length + 1 }; });
await page.waitForTimeout(400);
const sp = await B('uiPos', 0, -88); await T.tap(sp.x, sp.y);
await page.waitForTimeout(2500);
await B('god', true);
const s0 = await B('state');
await B('spawn', 'imp', Math.max(0, 12 - s0.enemies.length)); await B('spawn', 'lantern', 4); await B('spawn', 'brute', 4);
await page.waitForTimeout(2500);
const measure = (ms) => page.evaluate((ms) => new Promise(res => {
    const ts = []; const t0 = performance.now();
    const f = (t) => { ts.push(t); if (t - t0 < ms) requestAnimationFrame(f); else {
        const d = ts.slice(1).map((t, i) => t - ts[i]); d.sort((a, b) => a - b);
        res({ fps: +(1000 * d.length / (ts[ts.length - 1] - ts[0])).toFixed(1), p95ms: +d[Math.floor(d.length * 0.95)].toFixed(1), worstMs: +d[d.length - 1].toFixed(1) });
    } }; requestAnimationFrame(f);
}), ms);
const out = { viewport: `${W}x${H}`, homeMs, ...nav };
out.normal1x = await measure(2000);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.waitForTimeout(500);
out.enemies = (await B('state')).enemies.length;
// fight with attacks while measuring
const atk = await B('buttonPos', 'attack');
const fightP = measure(2500);
for (let i = 0; i < 10; i++) { await T.tap(atk.x, atk.y, 40); await page.waitForTimeout(200); }
out.fight4x = await fightP;
await B('fillRage');
const ult = await B('buttonPos', 'ult');
const ultP = measure(2200);
await T.tap(ult.x, ult.y, 40);
out.ult4x = await ultP;
const st = await B('state');
out.enemiesDuringUlt = out.enemies; out.particlesAfter = st.particles; out.ultCast = st.rage < 100;
out.jsHeapMB = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
console.log(JSON.stringify(out, null, 1));
await browser.close();
