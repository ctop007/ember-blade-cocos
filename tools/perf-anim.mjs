// Baseline / comparison for the skeletal-animation switch: exactly 20 live enemies, hero attacking,
// FPS + main-thread CPU per frame (CDP Performance metrics) at 1x/4x/6x CPU throttle.
// node tools/perf-anim.mjs [w h] [label]   (URL env overrides page; add &rig=0/1 later to pick renderer)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { Touch } from './touch.mjs';
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390), LABEL = process.argv[4] || 'run';
const PAGE = process.env.URL || 'http://127.0.0.1:8942/?debug';
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const T = new Touch(page, cdp);
const B = (fn, ...a) => page.evaluate(([f, a]) => window.__AI_BRIDGE__[f](...a), [fn, a]);
await page.goto(PAGE);
await page.waitForFunction(() => window.__AI_BRIDGE__ && window.__AI_BRIDGE__.state().phase === 'home', null, { timeout: 30000 });
await page.waitForTimeout(400);
const sp = await B('uiPos', 0, -88); await T.tap(sp.x, sp.y);
await page.waitForTimeout(2500);
await B('god', true);
const live = async () => (await B('state')).enemies.length;
const topUp = async () => { const n = await live(); if (n < 20) await B('spawn', 'imp', 20 - n); };
await B('spawn', 'lantern', 4); await B('spawn', 'brute', 4); await topUp();
await page.waitForTimeout(2000);
const metrics = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const g = k => m.find(x => x.name === k).value; return { task: g('TaskDuration'), script: g('ScriptDuration') }; };
const measure = (ms) => page.evaluate((ms) => new Promise(res => {
    const ts = []; const t0 = performance.now();
    const f = (t) => { ts.push(t); if (t - t0 < ms) requestAnimationFrame(f); else {
        const d = ts.slice(1).map((t, i) => t - ts[i]); d.sort((a, b) => a - b);
        res({ frames: d.length, fps: +(1000 * d.length / (ts[ts.length - 1] - ts[0])).toFixed(1), p95ms: +d[Math.floor(d.length * 0.95)].toFixed(1), worstMs: +d[d.length - 1].toFixed(1) });
    } }; requestAnimationFrame(f);
}), ms);
const atk = await B('buttonPos', 'attack');
const out = { label: LABEL, viewport: `${W}x${H}`, url: PAGE };
for (const rate of [1, 4, 6]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await topUp(); await page.waitForTimeout(600);
    const m0 = await metrics();
    const p = measure(3000);
    let stop = false; const tapper = (async () => { while (!stop) { await T.tap(atk.x, atk.y, 30); await page.waitForTimeout(180); } })();
    const r = await p; stop = true; await tapper;
    const m1 = await metrics();
    // CDP durations are wall-clock seconds of the throttled main thread
    r.taskMsPerFrame = +((m1.task - m0.task) * 1000 / r.frames).toFixed(2);
    r.scriptMsPerFrame = +((m1.script - m0.script) * 1000 / r.frames).toFixed(2);
    r.enemies = await live();
    out['x' + rate] = r;
}
out.jsHeapMB = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
console.log(JSON.stringify(out));
fs.appendFileSync(new URL('./perf-anim.jsonl', import.meta.url), JSON.stringify({ at: new Date().toISOString(), ...out }) + '\n');
await browser.close();
