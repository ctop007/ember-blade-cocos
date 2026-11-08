/** Enemy AI + boss. Pure TS. */
import type { World } from './world';
import { Enemy, EnemyType, inEllipse } from './types';

export function createEnemy(w: World, type: EnemyType, x: number, y: number): Enemy {
    const c = w.cfg.enemies[type];
    return {
        id: w.nextId++, type, x, y, z: 0, vz: 0, face: x < w.hero.x ? 1 : -1,
        hp: c.hp, maxHp: c.hp, state: 'spawn', st: 0, stDur: 0, kx: 0, ky: 0,
        atkCd: w.rng.range(0.4, 1.2), token: false, orbitA: w.rng.range(0, Math.PI * 2),
        flashT: 0, hitDone: false, deadT: 0, tx: 0, ty: 0, dirX: 0, dirY: 0, travelled: 0, fromX: x, fromY: y,
        move: '', enraged: false, entered: false,
    };
}

export function killEnemy(w: World, e: Enemy) {
    e.hp = 0; e.state = 'dead'; e.st = 0; e.deadT = 0; e.token = false;
    w.stats.kills++;
    w.addRage(w.cfg.combat.ragePerKill);
    if (w.mods.killHeal > 0) {
        const h = w.hero; const before = h.hp;
        h.hp = Math.min(h.maxHp, h.hp + w.mods.killHeal);
        if (h.hp > before) w.emit('heal', { x: h.x, y: h.y, v: Math.round(h.hp - before) });
    }
    w.emit('kill', { id: e.id, type: e.type, x: e.x, y: e.y });
    if (e.type === 'boss') {
        for (const o of w.enemies) if (o !== e && o.state !== 'dead') { o.hp = 0; o.state = 'dead'; o.deadT = 0; w.emit('kill', { id: o.id, type: o.type, x: o.x, y: o.y }); }
        w.spawnQueue = [];
        w.emit('bossDead', { x: e.x, y: e.y });
    }
}

function set(e: Enemy, s: Enemy['state'], dur = 0) { e.state = s; e.st = 0; e.stDur = dur; e.hitDone = false; }

const MELEE: { [k: string]: boolean } = { imp: true, brute: true };

function assignTokens(w: World) {
    const max = w.cfg.ai.maxMeleeAttackers, h = w.hero;
    const melee = w.enemies.filter(e => MELEE[e.type] && e.state !== 'dead' && e.state !== 'spawn');
    let used = 0;
    for (const e of melee) {
        if (e.state === 'windup' || e.state === 'attack' || e.state === 'charge') { e.token = true; used++; }
        else if (e.token && e.state !== 'hurt') used++;
        else e.token = false;
    }
    if (used > max) {
        // drop the farthest non-attacking holders
        const holders = melee.filter(e => e.token && e.state !== 'windup' && e.state !== 'attack' && e.state !== 'charge')
            .sort((a, b) => Math.abs(b.x - h.x) - Math.abs(a.x - h.x));
        for (const e of holders) { if (used <= max) break; e.token = false; used--; }
    }
    if (used < max) {
        const cands = melee.filter(e => !e.token && e.state !== 'hurt').sort((a, b) => dist(a, h.x, h.y) - dist(b, h.x, h.y));
        for (const e of cands) { if (used >= max) break; e.token = true; used++; }
    }
}

function dist(e: Enemy, x: number, y: number) { const dx = e.x - x, dy = (e.y - y) * 2; return Math.sqrt(dx * dx + dy * dy); }

let thinkAcc = 0;

export function updateEnemies(w: World, dt: number) {
    thinkAcc -= dt;
    if (thinkAcc <= 0) { thinkAcc = w.cfg.ai.thinkInterval; assignTokens(w); }
    const h = w.hero;
    for (const e of w.enemies) {
        e.st += dt;
        e.flashT = Math.max(0, e.flashT - dt);
        e.atkCd = Math.max(0, e.atkCd - dt);
        // knockback / launch physics
        if (e.kx !== 0) { e.x += e.kx * dt; e.kx *= Math.pow(0.002, dt); if (Math.abs(e.kx) < 4) e.kx = 0; }
        if (e.z > 0 || e.vz > 0) {
            e.vz -= w.cfg.world.gravity * dt; e.z += e.vz * dt;
            if (e.z <= 0) { e.z = 0; if (e.vz < -350) w.emit('enemyLand', { id: e.id, x: e.x, y: e.y }); e.vz = 0; }
        }
        if (e.state === 'dead') { e.deadT += dt; continue; }
        if (e.state === 'hurt') {
            if (e.st >= e.stDur && e.z <= 0) set(e, 'chase');
            continue;
        }
        if (e.state === 'spawn') {
            const inX = e.x < w.arenaL + 60 ? 1 : e.x > w.arenaR - 60 ? -1 : 0;
            const c = w.cfg.enemies[e.type];
            if (inX === 0 || e.st > 2.5) { set(e, 'chase'); e.entered = true; }
            else { e.x += inX * c.speed * 1.3 * dt; e.face = inX; }
            continue;
        }
        if (h.state === 'dead') { e.token = false; if (e.state !== 'chase') set(e, 'chase'); continue; }
        switch (e.type) {
            case 'imp': updateImp(w, e, dt); break;
            case 'lantern': updateLantern(w, e, dt); break;
            case 'brute': updateBrute(w, e, dt); break;
            case 'boss': updateBoss(w, e, dt); break;
        }
    }
    separate(w, dt);
}

function moveToward(e: Enemy, tx: number, ty: number, sp: number, dt: number): number {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d > 2) { const s = Math.min(d, sp * dt); e.x += dx / d * s; e.y += dy / d * s * 0.75; }
    return d;
}

function faceHero(w: World, e: Enemy) { e.face = w.hero.x >= e.x ? 1 : -1; }

function updateImp(w: World, e: Enemy, dt: number) {
    const c = w.cfg.enemies.imp, h = w.hero, A = w.cfg.ai;
    switch (e.state) {
        case 'chase': case 'orbit': {
            faceHero(w, e);
            if (e.token) {
                const side = e.x < h.x ? -1 : 1;
                const tx = h.x + side * (c.attackRange - 12), ty = h.y;
                moveToward(e, tx, ty, c.speed, dt);
                const dx = Math.abs(e.x - h.x), dy = Math.abs(e.y - h.y);
                if (e.atkCd <= 0 && dx <= c.attackRange + 14 && dy <= w.cfg.combat.depthTolerance * 0.7 && h.z < 60) {
                    set(e, 'windup', c.windup);
                    w.emit('telegraph', { id: e.id, kind: 'claw', x: e.x, y: e.y, t: c.windup, face: e.face });
                }
            } else {
                // orbit around hero at a distance, slowly drifting
                e.orbitA += A.orbitSpeed * dt * (e.id % 2 ? 1 : -1);
                const tx = h.x + Math.cos(e.orbitA) * A.orbitRadius;
                const ty = h.y + Math.sin(e.orbitA) * A.orbitRadius * 0.35;
                moveToward(e, tx, Math.max(w.groundTop, Math.min(w.groundBottom, ty)), c.speed * 0.6, dt);
            }
            break;
        }
        case 'windup':
            if (e.st >= e.stDur) { set(e, 'attack', c.attackDuration); w.emit('enemyAttack', { id: e.id, kind: 'claw', x: e.x, y: e.y, face: e.face }); }
            break;
        case 'attack':
            e.x += e.face * 120 * dt;
            if (!e.hitDone && e.st >= c.attackDuration * 0.35) {
                e.hitDone = true;
                const f = (h.x - e.x) * e.face;
                if (f > -10 && f < c.attackRange + 20 && Math.abs(h.y - e.y) < w.cfg.combat.depthTolerance && h.z < 60) w.damageHero(c.damage, e.x, 'imp');
            }
            if (e.st >= e.stDur) { set(e, 'recover', 0.35); e.atkCd = c.attackCooldown; }
            break;
        case 'recover':
            if (e.st >= e.stDur) { set(e, 'chase'); e.token = false; }
            break;
        default: set(e, 'chase');
    }
}

function updateLantern(w: World, e: Enemy, dt: number) {
    const c = w.cfg.enemies.lantern, h = w.hero;
    switch (e.state) {
        case 'chase': case 'orbit': {
            faceHero(w, e);
            const side = e.x < h.x ? -1 : 1;
            let tx = h.x + side * c.preferredRange;
            if (tx < w.arenaL + 60 || tx > w.arenaR - 60) tx = h.x - side * c.preferredRange;
            tx = Math.max(w.arenaL + 60, Math.min(w.arenaR - 60, tx));
            const ty = h.y + Math.sin(e.orbitA + w.t * 0.8) * 50;
            const d = moveToward(e, tx, Math.max(w.groundTop, Math.min(w.groundBottom, ty)), c.speed, dt);
            if (e.atkCd <= 0 && (d < 160 || e.st > 2.5) && Math.abs(e.x - h.x) < 700) {
                set(e, 'windup', c.windup);
                w.emit('telegraph', { id: e.id, kind: 'throw', x: e.x, y: e.y, t: c.windup, face: e.face });
            }
            break;
        }
        case 'windup':
            if (e.st >= e.stDur) {
                const P = c.projectile;
                const tx = h.x + (h.moving ? (h.face * 40) : 0), ty = h.y;
                w.addFireball(e.x + e.face * 20, e.y, 90, tx, ty, P.flightTime, P.arcHeight);
                w.emit('fireballWarn', { x: tx, y: ty, r: P.radius, t: P.flightTime });
                w.emit('enemyAttack', { id: e.id, kind: 'throw', x: e.x, y: e.y, face: e.face });
                set(e, 'recover', 0.4); e.atkCd = c.attackCooldown * w.rng.range(0.85, 1.2);
            }
            break;
        case 'recover': if (e.st >= e.stDur) set(e, 'chase'); break;
        default: set(e, 'chase');
    }
}

function updateBrute(w: World, e: Enemy, dt: number) {
    const c = w.cfg.enemies.brute, h = w.hero;
    switch (e.state) {
        case 'chase': case 'orbit': {
            faceHero(w, e);
            const ty = e.token ? h.y : h.y + (e.id % 2 ? -60 : 60);
            moveToward(e, h.x - (e.token ? 0 : e.face * 220), Math.max(w.groundTop, Math.min(w.groundBottom, ty)), c.speed, dt);
            if (e.token && e.atkCd <= 0 && Math.abs(e.x - h.x) < c.triggerRange && Math.abs(e.y - h.y) < 110) {
                set(e, 'windup', c.chargeWindup);
                const dx = h.x - e.x, dy = (h.y - e.y);
                const l = Math.hypot(dx, dy) || 1;
                e.dirX = dx / l; e.dirY = dy / l * 0.5; const l2 = Math.hypot(e.dirX, e.dirY); e.dirX /= l2; e.dirY /= l2;
                e.face = e.dirX >= 0 ? 1 : -1;
                w.emit('chargeWarn', { id: e.id, x: e.x, y: e.y, dx: e.dirX, dy: e.dirY, len: c.chargeDistance, w: c.chargeWidth, t: c.chargeWindup });
            }
            break;
        }
        case 'windup':
            if (e.st >= e.stDur) { set(e, 'charge'); e.travelled = 0; w.emit('enemyAttack', { id: e.id, kind: 'charge', x: e.x, y: e.y, face: e.face }); }
            break;
        case 'charge': {
            const s = c.chargeSpeed * dt;
            e.x += e.dirX * s; e.y += e.dirY * s; e.travelled += s;
            if (!e.hitDone && Math.abs(h.x - e.x) < c.radius + 30 && Math.abs(h.y - e.y) < c.chargeWidth * 0.6 && h.z < 60) {
                if (w.damageHero(c.damage, e.x - e.dirX * 50, 'brute')) e.hitDone = true;
            }
            const out = e.x < w.arenaL + 30 || e.x > w.arenaR - 30 || e.y < w.groundTop || e.y > w.groundBottom;
            if (e.travelled >= c.chargeDistance || out) { set(e, 'recover', c.recover); e.atkCd = c.attackCooldown; w.emit('chargeStop', { id: e.id, x: e.x, y: e.y }); }
            break;
        }
        case 'recover': if (e.st >= e.stDur) { set(e, 'chase'); e.token = false; } break;
        default: set(e, 'chase');
    }
}

function updateBoss(w: World, e: Enemy, dt: number) {
    const B = w.cfg.enemies.boss, M = B.moves, h = w.hero;
    const sp = B.speed * (e.enraged ? B.enrageSpeedMul : 1);
    const cdm = e.enraged ? B.enrageCooldownMul : 1;
    if (!e.enraged && e.hp <= e.maxHp * B.enrageAt && e.state !== 'intro') {
        e.enraged = true; w.emit('bossEnrage', { id: e.id, x: e.x, y: e.y, color: B.enrageColor });
    }
    switch (e.state) {
        case 'intro': if (e.st >= B.titleCardTime) set(e, 'idle', B.idleBetween * 0.5); break;
        case 'idle': {
            faceHero(w, e);
            moveToward(e, h.x - e.face * 160, h.y, sp * 0.5, dt);
            if (e.st >= e.stDur) {
                const imps = w.enemies.filter(o => o.type === 'imp' && o.state !== 'dead').length;
                const opts: [string, number][] = [['sweep', M.sweep.weight], ['leap', M.leap.weight]];
                if (imps < M.summon.maxAlive) opts.push(['summon', M.summon.weight]);
                let tot = 0; for (const o of opts) tot += o[1];
                let r = w.rng.next() * tot, pick = opts[0][0];
                for (const o of opts) { r -= o[1]; if (r <= 0) { pick = o[0]; break; } }
                e.move = pick;
                if (pick === 'sweep') set(e, 'chase', 2.5);
                else if (pick === 'leap') {
                    set(e, 'windup', M.leap.windup * cdm);
                    e.tx = h.x; e.ty = h.y;
                    w.emit('bossLeapWarn', { id: e.id, x: e.tx, y: e.ty, r: M.leap.radius, t: M.leap.windup * cdm + M.leap.airTime });
                    w.emit('telegraph', { id: e.id, kind: 'leap', x: e.x, y: e.y, t: M.leap.windup * cdm, face: e.face });
                } else {
                    set(e, 'windup', M.summon.windup * cdm);
                    w.emit('telegraph', { id: e.id, kind: 'summon', x: e.x, y: e.y, t: M.summon.windup * cdm, face: e.face });
                }
            }
            break;
        }
        case 'chase': {
            faceHero(w, e);
            const d = moveToward(e, h.x - e.face * (M.sweep.range * 0.55), h.y, sp, dt);
            if (d < 40 || e.st >= e.stDur) {
                set(e, 'windup', M.sweep.windup * cdm);
                w.emit('bossSweepWarn', { id: e.id, x: e.x, y: e.y, face: e.face, r: M.sweep.range, angle: M.sweep.angle, t: M.sweep.windup * cdm });
                w.emit('telegraph', { id: e.id, kind: 'sweep', x: e.x, y: e.y, t: M.sweep.windup * cdm, face: e.face });
            }
            break;
        }
        case 'windup':
            if (e.st < e.stDur) break;
            if (e.move === 'sweep') {
                set(e, 'attack', 0.35);
                w.emit('bossSweep', { id: e.id, x: e.x, y: e.y, face: e.face, r: M.sweep.range });
                const dx = h.x - e.x, dy = (h.y - e.y) / 0.5;
                const d = Math.hypot(dx, dy);
                const ang = Math.abs(Math.atan2(dy, dx * e.face)) * 180 / Math.PI;
                if (d <= M.sweep.range + 20 && ang <= M.sweep.angle / 2 && h.z < 80) w.damageHero(M.sweep.damage, e.x, 'boss_sweep');
            } else if (e.move === 'leap') {
                set(e, 'leapAir', M.leap.airTime); e.fromX = e.x; e.fromY = e.y;
                w.emit('bossLeap', { id: e.id, x: e.x, y: e.y });
            } else {
                set(e, 'summon', 0.5);
                for (let i = 0; i < M.summon.count; i++) {
                    const a = (i / M.summon.count) * Math.PI * 2 + w.rng.range(0, 1);
                    const x = Math.max(w.arenaL + 60, Math.min(w.arenaR - 60, e.x + Math.cos(a) * 140));
                    const y = Math.max(w.groundTop, Math.min(w.groundBottom, e.y + Math.sin(a) * 60));
                    const m = w.spawnEnemy(M.summon.type, x, y); m.state = 'chase'; m.entered = true; m.atkCd = 1.0;
                    w.emit('summonImp', { id: m.id, x, y });
                }
            }
            break;
        case 'leapAir': {
            const u = Math.min(1, e.st / e.stDur);
            e.x = e.fromX + (e.tx - e.fromX) * u; e.y = e.fromY + (e.ty - e.fromY) * u;
            e.z = Math.sin(u * Math.PI) * 260; e.vz = 0;
            if (u >= 1) {
                e.z = 0; set(e, 'recover', 0.7 * cdm);
                w.emit('bossSlam', { id: e.id, x: e.x, y: e.y, r: M.leap.radius });
                if (inEllipse(h.x - e.x, h.y - e.y, M.leap.radius + 20) && h.z < 60) w.damageHero(M.leap.damage, e.x, 'boss_leap');
            }
            break;
        }
        case 'attack': if (e.st >= e.stDur) set(e, 'recover', 0.5 * cdm); break;
        case 'summon': case 'recover':
            if (e.st >= e.stDur) set(e, 'idle', B.idleBetween * cdm);
            break;
        default: set(e, 'idle', B.idleBetween);
    }
}

function separate(w: World, dt: number) {
    const S = w.cfg.ai.separation, list = w.enemies, h = w.hero;
    for (let i = 0; i < list.length; i++) {
        const a = list[i]; if (a.state === 'dead') continue;
        const ra = w.cfg.enemies[a.type].radius;
        for (let j = i + 1; j < list.length; j++) {
            const b = list[j]; if (b.state === 'dead') continue;
            const rb = w.cfg.enemies[b.type].radius;
            const min = Math.max(S, ra + rb);
            const dx = b.x - a.x, dy = (b.y - a.y) * 2, d = Math.hypot(dx, dy);
            if (d < min && d > 0.01) {
                const push = (min - d) * 0.5 * Math.min(1, dt * 10);
                const nx = dx / d, ny = dy / d;
                const wa = a.type === 'boss' ? 0 : b.type === 'boss' ? 1 : 0.5, wb = 1 - wa;
                a.x -= nx * push * 2 * wa; a.y -= ny * push * wa; b.x += nx * push * 2 * wb; b.y += ny * push * wb;
            }
        }
        // don't stand inside the hero
        if (a.state !== 'charge' && a.state !== 'leapAir') {
            const dx = a.x - h.x, dy = (a.y - h.y) * 2, d = Math.hypot(dx, dy), min = ra + 22;
            if (d < min && d > 0.01) { a.x += dx / d * (min - d) * 0.5; }
        }
        if (a.entered) {
            a.x = Math.max(w.arenaL + 20, Math.min(w.arenaR - 20, a.x));
        }
        a.y = Math.max(w.groundTop, Math.min(w.groundBottom, a.y));
    }
}
