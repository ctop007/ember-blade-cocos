// Unified performance protocol agreed with the Godot build owner.
//   scope : same Playwright + same scene (20 enemies, hero attacking constantly), CPU throttle 1x / 4x / 6x
//   metric A : busy time of the engine's requestAnimationFrame callback (performance.now before/after), p50 / p95
//   metric B : wall-clock interval between two consecutive rAF callback starts, p50 / p95
// Both renderers run the identical scene: rig=0 (old single-image) and rig=1 (skeletal).
// node tools/perf-unified.mjs [w h] [label]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { Touch } from './touch.mjs';
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390), LABEL = process.argv[4] || 'run';
const SAMPLE_MS = 3000;
const BASE = process.env.URL || 'http://127.0.0.1:8942/?debug';
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const pct = (arr, p) => { if (!arr.length) return null; const a = arr.slice().sort((x, y) => x - y); return +a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(2); };
const results = [];
for (const rig of [0, 1]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const T = new Touch(page, cdp);
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    // Patch rAF BEFORE any page script runs, so every engine frame callback is wrapped.
    await page.addInitScript(() => {
        const raf = window.requestAnimationFrame.bind(window);
        window.__RAFSTATS__ = { busy: [], start: [] };
        window.requestAnimationFrame = (cb) => raf((ts) => {
            const t0 = performance.now();
            try { cb(ts); } finally {
                const st = window.__RAFSTATS__;
                if (st && st.busy.length < 20000) { st.busy.push(performance.now() - t0); st.start.push(t0); }
            }
        });
    });
    await page.goto(BASE + '&rig=' + rig);
    await page.waitForFunction(() => window.__AI_BRIDGE__?.state().phase === 'home', null, { timeout: 30000 });
    await page.waitForTimeout(500);
    const sp = await page.evaluate(() => window.__AI_BRIDGE__.uiPos(0, -88));
    await T.tap(sp.x, sp.y);
    await page.waitForFunction(() => window.__AI_BRIDGE__.state().phase === 'fight', null, { timeout: 15000 });
    await page.evaluate(() => window.__AI_BRIDGE__.god(true));
    await page.evaluate(() => window.__AI_BRIDGE__.freezeWaves(true)); // no wave transitions / auto spawns during sampling
    // identical scene: 4 lantern + 4 brute + imps up to exactly 20 live enemies
    await page.evaluate(() => window.__AI_BRIDGE__.spawn('lantern', 4));
    await page.evaluate(() => window.__AI_BRIDGE__.spawn('brute', 4));
    await page.waitForTimeout(400);
    const atk = await page.evaluate(() => window.__AI_BRIDGE__.buttonPos('attack'));
    const live = () => page.evaluate(() => window.__AI_BRIDGE__.state().enemies.length);
    const topUp = async () => { const n = await live(); if (n < 20) await page.evaluate((k) => window.__AI_BRIDGE__.spawn('imp', k), 20 - n); };
    await topUp();
    await page.waitForTimeout(1500);
    await topUp();
    for (const rate of [1, 4, 6]) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        await page.waitForTimeout(700);
        await topUp();
        await page.evaluate(() => { window.__RAFSTATS__.busy.length = 0; window.__RAFSTATS__.start.length = 0; });
        let stop = false, minE = 99, maxE = 0;
        const tapper = (async () => { while (!stop) { await T.tap(atk.x, atk.y, 30); await page.waitForTimeout(180); } })();
        const maintain = (async () => {
            while (!stop) { const n = await live(); minE = Math.min(minE, n); maxE = Math.max(maxE, n); if (n < 20) await topUp(); await page.waitForTimeout(220); }
        })();
        await page.waitForTimeout(SAMPLE_MS);
        stop = true; await tapper; await maintain;
        const s = await page.evaluate(() => {
            const st = window.__RAFSTATS__, busy = st.busy.slice(1), start = st.start.slice(1);
            const iv = []; for (let i = 1; i < start.length; i++) iv.push(start[i] - start[i - 1]);
            return { busy, iv };
        });
        results.push({
            rig, rate, label: LABEL, viewport: `${W}x${H}`, enemiesMin: minE, enemiesMax: maxE, frames: s.busy.length,
            busyP50: pct(s.busy, .5), busyP95: pct(s.busy, .95),
            intervalP50: pct(s.iv, .5), intervalP95: pct(s.iv, .95),
        });
        console.log(`rig=${rig} x${rate}`, JSON.stringify(results[results.length - 1]));
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    if (errs.length) console.log('ERRORS', errs);
    await ctx.close();
}
fs.appendFileSync(new URL('./perf-unified.jsonl', import.meta.url), JSON.stringify({ at: new Date().toISOString(), protocol: 'rAF-callback-busy-and-interval', sampleMs: SAMPLE_MS, rows: results }) + '\n');
await browser.close();
