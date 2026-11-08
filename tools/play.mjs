// Full playthrough with real multi-touch input. node tools/play.mjs [w h]
// Checks: joystick, 3-hit combo, charge thrust, dodge, jump+slam, 3 skills, ult, draft (tap), boss, result.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { Touch } from './touch.mjs';
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390);
const PAGE = process.env.URL || 'http://127.0.0.1:8942/?debug';
fs.mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
const shot = (n) => new URL(`./shots/${n}_${W}.png`, import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const T = new Touch(page, cdp);
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
const B = (fn, ...a) => page.evaluate(([f, a]) => window.__AI_BRIDGE__[f](...a), [fn, a]);
const S = () => B('state');
const EV = () => B('events');
const wait = (ms) => page.waitForTimeout(ms);
const results = {};
const check = (name, ok, info = '') => { results[name] = ok; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const btn = async (id) => B('buttonPos', id);
const tapBtn = async (id, hold = 60) => { const p = await btn(id); await T.tap(p.x, p.y, hold); };

const t0 = Date.now();
await page.goto(PAGE);
await page.waitForFunction(() => window.__AI_BRIDGE__ && window.__AI_BRIDGE__.state().phase === 'home', null, { timeout: 30000 });
const homeMs = Date.now() - t0;
await wait(500);
const sp = await B('uiPos', 0, -88);
await T.tap(sp.x, sp.y);
await page.waitForFunction(() => window.__AI_BRIDGE__.state().phase !== 'home', null, { timeout: 5000 });
check('start via tap', true, `home ${homeMs}ms`);
await wait(1800);

// ---- joystick: drag right/down from left region ----
{
    const s0 = await S();
    const ox = W * 0.18, oy = H * 0.72;
    const id = await T.down(ox, oy);
    for (let i = 1; i <= 6; i++) { await T.move(id, ox + i * 8, oy); await wait(16); }
    await wait(500);
    const s1 = await S();
    await T.up(id);
    check('joystick moves hero', s1.x - s0.x > 60, `dx=${s1.x - s0.x}`);
}
// ---- 3-hit combo ----
{
    const e0 = await EV();
    for (let i = 0; i < 3; i++) { await tapBtn('attack', 50); await wait(190); }
    await wait(500);
    const e1 = await EV();
    const d = (k) => (e1[k] || 0) - (e0[k] || 0);
    check('3-hit combo', d('swing0') >= 1 && d('swing1') >= 1 && d('swing2') >= 1, `steps ${d('swing0')}/${d('swing1')}/${d('swing2')}`);
}
// ---- charge (hold) -> thrust ----
{
    const e0 = await EV();
    const p = await btn('attack'); const id = await T.down(p.x, p.y);
    await wait(500); await page.screenshot({ path: shot('charge') });
    await T.up(id); await wait(120);
    await page.screenshot({ path: shot('thrust') });
    await wait(400);
    const e1 = await EV();
    check('charge thrust', (e1.thrust || 0) > (e0.thrust || 0));
}
// ---- dodge while holding joystick (multi-touch) ----
{
    const e0 = await EV(); const s0 = await S();
    const ox = W * 0.18, oy = H * 0.72;
    const jid = await T.down(ox, oy); await T.move(jid, ox - 50, oy);
    await wait(80); await tapBtn('dodge', 50); await wait(120);
    await page.screenshot({ path: shot('dodge') });
    await wait(300); await T.up(jid);
    const e1 = await EV(); const s1 = await S();
    check('dodge (joystick held + tap)', (e1.dodge || 0) > (e0.dodge || 0), `dx=${s1.x - s0.x}`);
}
// ---- jump + slam ----
{
    const e0 = await EV();
    await wait(700);
    await tapBtn('jump', 40); await wait(200); await tapBtn('attack', 40); await wait(250);
    await page.screenshot({ path: shot('slam') });
    await wait(500);
    const e1 = await EV();
    check('jump + down slam', (e1.jump || 0) > (e0.jump || 0) && (e1.slamLand || 0) > (e0.slamLand || 0));
}

// ---- steering helpers (joystick finger persists; other fingers tap buttons) ----
const JOY = { x: W * 0.17, y: H * 0.7 };
let joyId = null;
const joy = async (dx, dy) => {
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) { if (joyId !== null) { await T.up(joyId); joyId = null; } return; }
    if (joyId === null) joyId = await T.down(JOY.x, JOY.y);
    const R = Math.min(W, H) * 0.12;
    await T.move(joyId, JOY.x + dx / len * R, JOY.y + dy / len * R);
};
const nearest = (s) => { let b = null, bd = 1e9; for (const e of s.enemies) { if (e.state === 'spawn') continue; const d = Math.abs(e.x - s.x) + Math.abs(e.y - s.y) * 2; if (d < bd) { bd = d; b = e; } } return b; };
const approach = async (maxMs = 2500, dist = 110) => {
    const tEnd = Date.now() + maxMs;
    while (Date.now() < tEnd) {
        const s = await S(); const e = nearest(s); if (!e) break;
        const dx = e.x - s.x, dy = e.y - s.y;
        if (Math.abs(dx) < dist && Math.abs(dy) < 30) { await joy(Math.sign(dx) * 0.2, 0); await wait(40); break; }
        await joy(Math.abs(dx) < dist ? -Math.sign(dx) * 0.2 : dx, dy * 2); await wait(60);
    }
    await joy(0, 0);
};

// ---- 3 skills (screenshots at their peak, near enemies) ----
for (const [id, ev, at, name] of [['skill1', 'crescent', 260, 'skill1_crescent'], ['skill2', 'skyfallStrike', 520, 'skill2_skyfall'], ['skill3', 'spearThrow', 230, 'skill3_meteorSpear']]) {
    await approach(2500, id === 'skill2' ? 200 : 140);
    let s = await S();
    for (let k = 0; k < 40 && (s.mp < 30 || s.heroState !== 'idle'); k++) { await wait(100); s = await S(); }
    const e0 = await EV();
    await tapBtn(id, 50); await wait(at);
    await page.screenshot({ path: shot(name) });
    await wait(700);
    const e1 = await EV();
    const ok = (e1[ev] || 0) > (e0[ev] || 0);
    if (!ok) { const s2 = await S(); console.log('  diag', id, JSON.stringify({ before: { st: s.heroState, mp: s.mp, phase: s.phase, cds: s.cds }, after: { st: s2.heroState, phase: s2.phase, cds: s2.cds }, castFail: (e1.castFail || 0) - (e0.castFail || 0) })); }
    check(`skill ${id} (${ev})`, ok, `mp=${s.mp}`);
}

// ---- autopilot to the end; draft via real card taps, ult when ready ----
let draftsDone = 0, earlyTapIgnored = null, ultDone = false, bossSeen = false, maxEnemies = 0;
const tEnd = Date.now() + 360000;
let lastAtk = 0, lastSkill = 0, lastDodge = 0, lastLog = 0, s = await S();
while (Date.now() < tEnd) {
    s = await S();
    maxEnemies = Math.max(maxEnemies, s.enemies.length);
    if (Date.now() - lastLog > 10000) { lastLog = Date.now(); console.log(`  t=${Math.round(s.stats.time)} wave=${s.wave} phase=${s.phase} hp=${s.hp} rage=${s.rage} en=${s.enemies.length} fps=${s.fps}`); }
    if (s.phase === 'victory' || s.phase === 'defeat') break;
    if (s.phase === 'draft') {
        await joy(0, 0);
        if (earlyTapIgnored === null) {
            // tap during the deal animation must be ignored
            await wait(120); const c = await B('cardPos', 1);
            if (c) { await T.tap(c.x, c.y, 30); await wait(60); const s2 = await S(); earlyTapIgnored = s2.phase === 'draft' && s2.cards.length === s.cards.length; }
        }
        await page.waitForFunction(() => window.__AI_BRIDGE__.state().draftReady, null, { timeout: 5000 });
        await page.screenshot({ path: shot(`draft${draftsDone + 1}`) });
        const n0 = (await S()).cards.length;
        const c = await B('cardPos', draftsDone % 3);
        await T.tap(c.x, c.y, 50);
        await page.waitForFunction((n) => window.__AI_BRIDGE__.state().cards.length > n, n0, { timeout: 3000 });
        draftsDone++;
        await wait(400);
        continue;
    }
    if (s.phase === 'bossIntro' && !bossSeen) { bossSeen = true; await joy(0, 0); await wait(700); await page.screenshot({ path: shot('boss_title') }); continue; }
    if (s.phase === 'advance' || s.phase === 'clear' || s.phase === 'waveIntro') { await joy(1, (580 - s.y) / 200); await wait(80); continue; }
    if (s.ultReady && s.enemies.length >= (ultDone ? 1 : 2) && s.heroState === 'idle') {
        await joy(0, 0);
        await tapBtn('ult', 50);
        if (!ultDone) { await wait(1100); await page.screenshot({ path: shot('ult') }); await wait(900); ultDone = (await EV()).ultStrike > 0; }
        continue;
    }
    const e = nearest(s);
    if (!e) { await joy(0, 0); await wait(80); continue; }
    const dx = e.x - s.x, dy = e.y - s.y;
    const now = Date.now();
    if (Math.abs(dx) < 130 && Math.abs(dy) < 34) {
        // face the target, then attack / skills
        if (Math.sign(dx) !== s.face && Math.abs(dx) > 10) { await joy(Math.sign(dx), 0); await wait(50); }
        await joy(0, 0);
        if (now - lastSkill > 900 && s.heroState === 'idle') {
            const pick = ['skill1', 'skill3', 'skill2'].find(k => { const nm = { skill1: 'crescent', skill2: 'skyfall', skill3: 'meteorSpear' }[k]; return s.cds[nm] <= 0 && s.mp >= 35; });
            if (pick) { await tapBtn(pick, 40); lastSkill = now; continue; }
        }
        if (now - lastAtk > 150) { await tapBtn('attack', 40); lastAtk = now; }
    } else {
        if (s.hp < s.maxHp * 0.6 && now - lastDodge > 1500 && Math.abs(dx) < 90) { await tapBtn('dodge', 40); lastDodge = now; }
        await joy(Math.abs(dx) < 90 ? -Math.sign(dx) * 0.5 : dx, dy * 3);
    }
    await wait(50);
}
await joy(0, 0);
check('draft x3 by tap', draftsDone >= 3, `drafts=${draftsDone}`);
check('draft ignores taps during deal anim', earlyTapIgnored === true);
check('ultimate', ultDone);
check('boss intro', bossSeen);
s = await S();
check('reached result', s.phase === 'victory' || s.phase === 'defeat', `phase=${s.phase} time=${Math.round(s.stats.time)}s hp=${s.hp} kills=${s.stats.kills} maxCombo=${s.stats.maxCombo}`);
await wait(1200);
await page.screenshot({ path: shot('result') });
// tap "再来一局" (panel button at -120,-178)
const again = await B('uiPos', -120, -178);
await T.tap(again.x, again.y, 50); await wait(800);
s = await S();
check('result -> play again', s.phase !== 'victory' && s.phase !== 'defeat' && s.hp === s.maxHp, `phase=${s.phase}`);
console.log('maxEnemies', maxEnemies, 'events', JSON.stringify(await EV()));
console.log('errors', errs.length ? errs.slice(0, 10).join('\n') : 'none');
const fails = Object.entries(results).filter(([, v]) => !v).map(([k]) => k);
console.log(fails.length ? 'FAILED: ' + fails.join(', ') : 'ALL PASS');
await browser.close();
process.exit(fails.length ? 1 : 0);
